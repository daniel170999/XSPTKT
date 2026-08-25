#!/usr/bin/env python3
"""Tạo các trang kết quả tĩnh từ kho dữ liệu công khai của Kết Số.

Chỉ dùng Python chuẩn. ``templates/index.template.html`` là nguồn của SPA;
file ``index.html`` và các thư mục route là đầu ra có thể tái tạo.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
TEMPLATE = ROOT / "templates" / "index.template.html"
GENERATED = "<!-- KETSO-GENERATED -->"
DATE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TZ_VN = timezone(timedelta(hours=7))


@dataclass(frozen=True)
class MBDay:
    day: str
    nums: tuple[str, ...]


@dataclass(frozen=True)
class MNDay:
    day: str
    draws: tuple[tuple[str, tuple[str, ...]], ...]


def fail(message: str) -> None:
    raise ValueError(message)


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Không đọc được {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, dict):
        fail(f"{path.relative_to(ROOT)} phải là object JSON")
    return value


def load_window_array(path: Path, variable: str) -> list[str]:
    text = path.read_text(encoding="utf-8")
    match = re.fullmatch(
        rf"\s*window\.{re.escape(variable)}\s*=\s*(\[.*\])\s*;?\s*",
        text,
        re.DOTALL,
    )
    if not match:
        fail(f"Không đọc được mảng {variable} trong {path.relative_to(ROOT)}")
    try:
        rows = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        fail(f"JSON không hợp lệ trong {path.relative_to(ROOT)}: {exc}")
    if not isinstance(rows, list) or not all(isinstance(item, str) for item in rows):
        fail(f"{variable} phải là mảng chuỗi")
    return rows


def check_day(value: str) -> str:
    try:
        date.fromisoformat(value)
    except ValueError:
        fail(f"Ngày không hợp lệ: {value}")
    return value


def parse_mb(line: str, groups: list[dict]) -> MBDay:
    parts = line.split(",")
    expected = sum(int(group["c"]) for group in groups)
    if len(parts) != expected + 1:
        fail(f"XSMB {parts[0] if parts else '?'} có {len(parts)-1} số, cần {expected}")
    if not all(re.fullmatch(r"\d{2,6}", value or "") for value in parts[1:]):
        fail(f"XSMB {parts[0]} có số không hợp lệ")
    return MBDay(check_day(parts[0]), tuple(parts[1:]))


def parse_mn(line: str, groups: list[dict]) -> MNDay:
    parts = line.split("|")
    if len(parts) < 2:
        fail(f"XSMN thiếu đài: {line[:40]}")
    expected = sum(int(group["c"]) for group in groups)
    draws: list[tuple[str, tuple[str, ...]]] = []
    seen: set[str] = set()
    for item in parts[1:]:
        province, sep, raw_nums = item.partition(":")
        nums = raw_nums.split(",") if sep else []
        if not province or province in seen or len(nums) != expected:
            fail(f"XSMN {parts[0]} có dữ liệu đài không hợp lệ")
        if not all(re.fullmatch(r"\d{2,6}", value or "") for value in nums):
            fail(f"XSMN {parts[0]} có số không hợp lệ")
        seen.add(province)
        draws.append((province, tuple(nums)))
    return MNDay(check_day(parts[0]), tuple(draws))


def e(value: object) -> str:
    return html.escape(str(value), quote=True)


def format_date(value: str) -> str:
    d = date.fromisoformat(value)
    weekdays = ("Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật")
    return f"{weekdays[d.weekday()]}, {d.day:02d}/{d.month:02d}/{d.year}"


def canonical(origin: str, route: str) -> str:
    route = route.strip("/")
    if route.endswith(".html"):
        return f"{origin}/{route}"
    return f"{origin}/{route}/" if route else f"{origin}/"


def crumbs(items: Iterable[tuple[str, str | None]]) -> str:
    rendered = []
    for label, href in items:
        item = f'<a href="{e(href)}">{e(label)}</a>' if href else f"<span>{e(label)}</span>"
        rendered.append(item)
    return '<nav class="breadcrumb" aria-label="Đường dẫn">' + '<span aria-hidden="true">/</span>'.join(rendered) + "</nav>"


def header() -> str:
    return """<header class=\"static-shell static-nav\">
  <a class=\"static-brand\" href=\"/\"><img src=\"/icon.svg\" width=\"34\" height=\"34\" alt=\"\"><span>Kết Số</span></a>
  <nav class=\"static-links\" aria-label=\"Điều hướng\">
    <a href=\"/\">Kết quả</a><a href=\"/xsmn/\">XSMN</a><a href=\"/xsmb/\">XSMB</a><a href=\"/nguon-du-lieu/\">Nguồn dữ liệu</a>
  </nav>
</header>"""


def footer() -> str:
    return """<footer class=\"static-shell static-footer\"><p>Kết Số tổng hợp kết quả và dữ liệu đã công bố. Dữ liệu quá khứ chỉ dùng để tra cứu và mô tả.</p></footer>"""


def page_document(
    *,
    title: str,
    description: str,
    url: str,
    h1: str,
    content: str,
    modified: str,
) -> str:
    description = description[:155]
    parts = url.split("/", 3)
    site_url = "/".join(parts[:3]) + "/"
    schema = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": h1,
            "url": url,
            "inLanguage": "vi-VN",
            "dateModified": modified,
            "isPartOf": {"@type": "WebSite", "name": "Kết Số", "url": site_url},
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return f"""{GENERATED}
<!doctype html>
<html lang=\"vi\">
<head>
<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
<title>{e(title)}</title><meta name=\"description\" content=\"{e(description)}\"><meta name=\"robots\" content=\"index,follow\">
<link rel=\"canonical\" href=\"{e(url)}\"><link rel=\"icon\" href=\"/icon.svg\" type=\"image/svg+xml\"><link rel=\"stylesheet\" href=\"/app.css\">
<meta property=\"og:type\" content=\"website\"><meta property=\"og:locale\" content=\"vi_VN\"><meta property=\"og:site_name\" content=\"Kết Số\"><meta property=\"og:title\" content=\"{e(title)}\"><meta property=\"og:description\" content=\"{e(description)}\"><meta property=\"og:url\" content=\"{e(url)}\"><meta property=\"og:image\" content=\"{e(site_url + 'social-card.png')}\">
<meta name=\"twitter:card\" content=\"summary_large_image\"><meta name=\"theme-color\" content=\"#f6f8fb\"><script type=\"application/ld+json\">{schema}</script>
</head>
<body class=\"static-page\">{header()}<main class=\"static-shell static-main\"><section class=\"static-hero\"><p class=\"static-kicker\">Dữ liệu đã công bố</p><h1>{e(h1)}</h1></section>{content}</main>{footer()}</body></html>
"""


def numbers(values: Iterable[str], special: bool = False) -> str:
    class_name = "static-number static-number--special" if special else "static-number"
    return '<div class="static-number-list">' + "".join(f'<span class="{class_name}">{e(value)}</span>' for value in values) + "</div>"


def grouped_rows(groups: list[dict], values: tuple[str, ...]) -> list[tuple[dict, tuple[str, ...]]]:
    cursor = 0
    rows = []
    for group in groups:
        count = int(group["c"])
        rows.append((group, values[cursor : cursor + count]))
        cursor += count
    if cursor != len(values):
        fail("Bảng giải và dữ liệu không cùng số lượng")
    return rows


def result_table(groups: list[dict], values: tuple[str, ...]) -> str:
    rows = "".join(
        f'<tr><th scope="row">{e(group["n"])}</th><td>{numbers(vals, group.get("kind") == "special")}</td></tr>'
        for group, vals in grouped_rows(groups, values)
    )
    return f'<div class="static-table-wrap"><table class="static-table"><tbody>{rows}</tbody></table></div>'


def mb_card(day: MBDay, groups: list[dict], *, compact: bool = False) -> str:
    table = result_table(groups if not compact else groups[:2], day.nums if not compact else day.nums[:2])
    return f"""<article class=\"static-card\"><div class=\"static-card-head\"><h2>XSMB</h2><time datetime=\"{day.day}\">{e(format_date(day.day))}</time></div>{table}</article>"""


def mn_cards(day: MNDay, groups: list[dict], *, compact: bool = False, only: str | None = None, wrap: bool = True) -> str:
    draws = [(province, values) for province, values in day.draws if only is None or province == only]
    cards = []
    for province, values in draws:
        shown_groups = groups if not compact else [groups[0], groups[-1]]
        shown_values = values if not compact else values[: int(groups[0]["c"])] + values[-int(groups[-1]["c"]) :]
        cards.append(
            f'<article class="static-card"><div class="static-card-head"><h2>{e(province)}</h2><time datetime="{day.day}">{e(format_date(day.day))}</time></div>{result_table(shown_groups, shown_values)}</article>'
        )
    output = "".join(cards)
    return '<div class="static-grid">' + output + "</div>" if wrap else output


def static_home(mb: MBDay, mn: MNDay, schema: dict, latest: str) -> str:
    return f"""<div class=\"static-page\">{header()}<main class=\"static-shell static-main\">
  <section class=\"static-hero\"><p class=\"static-kicker\">Kết quả mới nhất</p><h1>Kết quả xổ số XSMN và XSMB hôm nay</h1><p>Xem nhanh các kết quả đã công bố gần nhất. Bật JavaScript để tra cứu lịch sử và xem bản đồ dữ liệu.</p></section>
  <div class=\"static-grid\">{mb_card(mb, schema["resultGroups"]["MB"], compact=True)}{mn_cards(mn, schema["resultGroups"]["MN"], compact=True, wrap=False)}</div>
  <p class=\"static-note\">Kho dữ liệu cập nhật đến {e(format_date(latest))}. Kết quả có thể được điều chỉnh nếu nguồn công bố cập nhật lại.</p>
</main>{footer()}</div>"""


def region_hub(region: str, days: list[MBDay] | list[MNDay], schema: dict, origin: str, modified: str) -> str:
    key = "MB" if region == "xsmb" else "MN"
    label = "Xổ số Miền Bắc" if key == "MB" else "Xổ số Miền Nam"
    latest = days[-1]
    content = crumbs((("Trang chủ", "/"), (label, None)))
    content += f"<p class=\"static-copy\">Kết quả {e(label)} đầy đủ theo từng giải. Chọn một ngày trong danh sách để xem lại.</p>"
    content += mb_card(latest, schema["resultGroups"]["MB"]) if key == "MB" else mn_cards(latest, schema["resultGroups"]["MN"])
    listing = "".join(
        f'<li><a href=\"/{region}/{day.day}/\"><span>{e(format_date(day.day))}</span><span aria-hidden=\"true\">Xem kết quả →</span></a></li>'
        for day in reversed(days[-30:])
    )
    content += f"<section class=\"static-copy\"><h2>Các kỳ gần đây</h2><ul class=\"static-list\">{listing}</ul></section>"
    if key == "MN":
        provinces = schema["provinces"]
        links = "".join(f'<li><a href=\"/xsmn/{e(p["slug"])}/\"><span>{e(p["label"])}</span><span aria-hidden=\"true\">→</span></a></li>' for p in provinces)
        content += f"<section class=\"static-copy\"><h2>Tra cứu theo đài</h2><ul class=\"static-list\">{links}</ul></section>"
    return page_document(title=f"{label} hôm nay và các kỳ gần nhất | Kết Số", description=f"Xem {label} mới nhất, đầy đủ các giải và lịch sử các kỳ đã công bố.", url=canonical(origin, region), h1=label, content=content, modified=modified)


def daily_page(region: str, day: MBDay | MNDay, schema: dict, origin: str, modified: str) -> str:
    key = "MB" if region == "xsmb" else "MN"
    label = "Xổ số Miền Bắc" if key == "MB" else "Xổ số Miền Nam"
    content = crumbs((("Trang chủ", "/"), ("XSMB" if key == "MB" else "XSMN", f"/{region}/"), (format_date(day.day), None)))
    content += mb_card(day, schema["resultGroups"]["MB"]) if key == "MB" else mn_cards(day, schema["resultGroups"]["MN"])
    title = f"Kết quả {label} ngày {day.day} | Kết Số"
    return page_document(title=title, description=f"Kết quả {label} ngày {format_date(day.day)}, đầy đủ các giải đã công bố.", url=canonical(origin, f"{region}/{day.day}"), h1=f"Kết quả {label} ngày {format_date(day.day)}", content=content, modified=modified)


def province_hub(province: dict, days: list[MNDay], schema: dict, origin: str, modified: str) -> str:
    matches = [(day, values) for day in days for name, values in day.draws if name == province["name"]]
    if not matches:
        fail(f"Không có dữ liệu cho {province['name']}")
    latest_day, latest_values = matches[-1]
    content = crumbs((("Trang chủ", "/"), ("XSMN", "/xsmn/"), (province["label"], None)))
    content += f'<p class="static-copy">Kết quả {e(province["label"])} theo từng giải trong các kỳ gần đây.</p>'
    content += f'<article class="static-card"><div class="static-card-head"><h2>{e(province["label"])}</h2><time datetime="{latest_day.day}">{e(format_date(latest_day.day))}</time></div>{result_table(schema["resultGroups"]["MN"], latest_values)}</article>'
    links = "".join(f'<li><a href="/xsmn/{day.day}/"><span>{e(format_date(day.day))}</span><span aria-hidden="true">Xem kỳ →</span></a></li>' for day, _ in reversed(matches[-30:]))
    content += f'<section class="static-copy"><h2>Các kỳ gần đây</h2><ul class="static-list">{links}</ul></section>'
    label = f"Xổ số {province['label']}"
    return page_document(title=f"{label} hôm nay và các kỳ gần nhất | Kết Số", description=f"Xem kết quả {label} theo từng giải và lịch sử các kỳ đã công bố.", url=canonical(origin, f"xsmn/{province['slug']}"), h1=label, content=content, modified=modified)


def static_document(route: str, title: str, heading: str, body: str, origin: str, modified: str) -> str:
    content = crumbs((("Trang chủ", "/"), (heading, None))) + f'<div class="static-copy">{body}</div>'
    return page_document(title=title, description=heading + " — Kết Số.", url=canonical(origin, route), h1=heading, content=content, modified=modified)


def safe_write(path: Path, value: str, check: bool) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == value:
        return False
    if check:
        print(f"Cần tạo lại: {path.relative_to(ROOT)}")
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(value, encoding="utf-8", newline="\n")
    os.replace(temp, path)
    return True


def prune_days(region: str, wanted: set[str], check: bool) -> int:
    directory = ROOT / region
    if not directory.exists():
        return 0
    removed = 0
    for child in directory.iterdir():
        if not child.is_dir() or not DATE_DIR.fullmatch(child.name) or child.name in wanted:
            continue
        target = child / "index.html"
        if not target.exists() or GENERATED not in target.read_text(encoding="utf-8", errors="replace"):
            continue
        if ROOT not in child.resolve().parents:
            fail(f"Từ chối dọn đường dẫn ngoài project: {child}")
        if check:
            print(f"Cần dọn: {child.relative_to(ROOT)}")
        else:
            shutil.rmtree(child)
        removed += 1
    return removed


def build(root: Path, days_limit: int, check: bool) -> int:
    global ROOT, DATA, TEMPLATE
    ROOT = root.resolve()
    DATA = ROOT / "data"
    TEMPLATE = ROOT / "templates" / "index.template.html"
    config = read_json(DATA / "config.json")
    schema = read_json(DATA / "site-schema.json")
    origin = str(config.get("site_origin", "")).rstrip("/")
    if not re.fullmatch(r"https://[^/]+", origin):
        fail("data/config.json cần site_origin HTTPS không có path")
    if not isinstance(schema.get("resultGroups"), dict) or not isinstance(schema.get("provinces"), list):
        fail("data/site-schema.json thiếu resultGroups hoặc provinces")
    groups_mb = schema["resultGroups"].get("MB")
    groups_mn = schema["resultGroups"].get("MN")
    if not isinstance(groups_mb, list) or not isinstance(groups_mn, list):
        fail("site-schema thiếu nhóm giải XSMB/XSMN")
    mb_days = [parse_mb(line, groups_mb) for line in load_window_array(DATA / "xsmb.js", "XSMB_LINES")]
    mn_days = [parse_mn(line, groups_mn) for line in load_window_array(DATA / "xsmn.js", "XSMN_LINES")]
    mb_days.sort(key=lambda item: item.day)
    mn_days.sort(key=lambda item: item.day)
    if not mb_days or not mn_days:
        fail("Không có dữ liệu để tạo trang")
    last = max(mb_days[-1].day, mn_days[-1].day)
    modified = f"{last}T23:59:59+07:00"
    runtime_schema = "window.XS_SITE_SCHEMA=" + json.dumps(schema, ensure_ascii=False, separators=(",", ":")) + ";\n"

    template = TEMPLATE.read_text(encoding="utf-8")
    if template.count("{{STATIC_HOME}}") != 1 or template.count("{{SITE_ORIGIN}}") < 1:
        fail("Template phải có đúng một STATIC_HOME và ít nhất một SITE_ORIGIN")
    root_html = template.replace("{{STATIC_HOME}}", static_home(mb_days[-1], mn_days[-1], schema, last)).replace("{{SITE_ORIGIN}}", origin)

    changes = 0
    changes += safe_write(ROOT / "site-schema.js", runtime_schema, check)
    changes += safe_write(ROOT / "index.html", root_html, check)
    changes += safe_write(ROOT / "xsmn" / "index.html", region_hub("xsmn", mn_days, schema, origin, modified), check)
    changes += safe_write(ROOT / "xsmb" / "index.html", region_hub("xsmb", mb_days, schema, origin, modified), check)

    wanted_routes: dict[str, set[str]] = {"xsmn": set(), "xsmb": set()}
    for region, source in (("xsmb", mb_days[-days_limit:]), ("xsmn", mn_days[-days_limit:])):
        for day in source:
            wanted_routes[region].add(day.day)
            changes += safe_write(ROOT / region / day.day / "index.html", daily_page(region, day, schema, origin, modified), check)
    for region, wanted in wanted_routes.items():
        changes += prune_days(region, wanted, check)

    for province in schema["provinces"]:
        if not all(isinstance(province.get(key), str) and province[key] for key in ("name", "label", "slug")):
            fail("Tên đài hoặc slug không hợp lệ")
        changes += safe_write(ROOT / "xsmn" / province["slug"] / "index.html", province_hub(province, mn_days, schema, origin, modified), check)

    docs = {
        "gioi-thieu": ("Giới thiệu Kết Số | Kết Số", "Giới thiệu Kết Số", "<p>Kết Số là trang tra cứu kết quả XSMN và XSMB, trình bày lại dữ liệu đã công bố theo hướng dễ xem trên điện thoại và máy tính.</p><p>Thông tin đơn vị vận hành và đầu mối liên hệ sẽ được công bố cùng kênh tiếp nhận chính thức.</p>"),
        "nguon-du-lieu": ("Nguồn dữ liệu | Kết Số", "Nguồn dữ liệu", "<p>Dữ liệu được tổng hợp từ các nguồn công bố kết quả và kiểm tra cấu trúc trước khi cập nhật vào kho.</p><p>Crawler dùng nguồn dự phòng khi nguồn đầu tiên thiếu bảng; một số trang công ty xổ số kiến thiết được đối chiếu thêm khi robots.txt cho phép và HTML đủ cấu trúc. Dữ liệu cũ không bị thay bằng kết quả rỗng khi nguồn gặp sự cố.</p><p>GitHub Actions chạy sau giờ quay; thời điểm cập nhật hiển thị ngay trong ứng dụng.</p>"),
        "phuong-phap": ("Phương pháp thống kê | Kết Số", "Phương pháp", "<p>Các bảng tần suất, bản đồ nhiệt và khoảng cách chỉ mô tả dữ liệu đã công bố trong phạm vi người xem chọn.</p><p>Các phép so sánh được đặt cạnh mức nền và kiểm tra trên dữ liệu tách riêng. Dữ liệu quá khứ không dự báo kết quả tương lai.</p><section id=\"backtestApp\"><h2>Kiểm chứng dữ liệu</h2><p>Bản kiểm chứng chạy trong ứng dụng khi JavaScript được bật; phần này luôn giữ phần giải thích cơ bản để có thể đọc độc lập.</p></section>"),
        "lien-he": ("Liên hệ | Kết Số", "Liên hệ", "<p>Kênh liên hệ chính thức đang được hoàn thiện. Chúng tôi không công bố email cho đến khi chủ quản xác nhận đầu mối tiếp nhận.</p><p>Nếu phát hiện kết quả cần đối chiếu, vui lòng quay lại nguồn công bố của công ty xổ số kiến thiết tương ứng.</p>"),
    }
    for route, (title, heading, body) in docs.items():
        changes += safe_write(ROOT / route / "index.html", static_document(route, title, heading, body, origin, modified), check)
    privacy = static_document("privacy.html", "Quyền riêng tư | Kết Số", "Quyền riêng tư", "<p>Kết Số không yêu cầu tạo tài khoản. Giao diện chỉ lưu tùy chọn hiển thị và danh sách theo dõi cục bộ trên trình duyệt của người dùng.</p><p>Website không thu thập thông tin định danh qua biểu mẫu trong phiên bản hiện tại.</p>", origin, modified)
    changes += safe_write(ROOT / "privacy.html", privacy, check)

    static_routes = ["", "xsmn", "xsmb", "gioi-thieu", "nguon-du-lieu", "phuong-phap", "lien-he", "privacy.html"]
    static_routes.extend(f"xsmn/{province['slug']}" for province in schema["provinces"])
    urlset = "\n".join(f"  <url><loc>{e(canonical(origin, route))}</loc><lastmod>{modified}</lastmod></url>" for route in static_routes)
    sitemap = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urlset}\n</urlset>\n'
    changes += safe_write(ROOT / "sitemap.xml", sitemap, check)
    robots = f"User-agent: *\nAllow: /\nDisallow: /data/\nDisallow: /work/\nDisallow: /outputs/\nDisallow: /templates/\nDisallow: /*.md$\nDisallow: /*.py$\nDisallow: /*.cjs$\nDisallow: /*.bat$\nDisallow: /*.json$\n\nSitemap: {origin}/sitemap.xml\n"
    changes += safe_write(ROOT / "robots.txt", robots, check)
    print(f"build_pages: {changes} thay đổi, {len(wanted_routes['xsmb']) + len(wanted_routes['xsmn'])} trang theo ngày, {len(schema['provinces'])} trang theo đài")
    return 1 if check and changes else 0


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    parser = argparse.ArgumentParser(description="Tạo trang kết quả tĩnh Kết Số")
    parser.add_argument("--root", type=Path, default=ROOT, help="Thư mục project")
    parser.add_argument("--days", type=int, default=90, help="Số ngày thực tế mỗi miền")
    parser.add_argument("--check", action="store_true", help="Chỉ kiểm tra đầu ra có mới hay không")
    args = parser.parse_args()
    if args.days < 1 or args.days > 365:
        parser.error("--days phải từ 1 đến 365")
    try:
        return build(args.root, args.days, args.check)
    except ValueError as exc:
        print(f"build_pages: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
