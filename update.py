# -*- coding: utf-8 -*-
"""
update.py — Tai & cap nhat kho du lieu XSMB / XSMN cho app thong ke.

Muc tieu: giu MOT kho du lieu day du nhat co the (toan bo lich su crawl duoc),
moi ngay chi can them ngay moi vao.

Chay:
    py update.py                 # cap nhat ngay moi (nhanh, vai giay)
    py update.py --all           # tai TOAN BO lich su con thieu (lan dau: ~10-20 phut)
    py update.py --days 3000     # chi dam bao du sau 3000 ngay
    py update.py --workers 8     # so luong tai song song (mac dinh 8)

Chi dung thu vien chuan cua Python — khong can cai them gi.
Nguon:
  XSMB: dataset GitHub (khiemdoan/vietnam-lottery-xsmb-analysis) tu 01/10/2005
        + tu crawl xosodaiphat.com cho nhung ngay dataset chua kip cap nhat.
  XSMN: crawl xosodaiphat.com (kho luu tru tu ~2008).
"""
import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from html import unescape

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

XSMB_CSV_URL = ("https://raw.githubusercontent.com/khiemdoan/"
                "vietnam-lottery-xsmb-analysis/main/data/xsmb.csv")
DAIPHAT = "https://xosodaiphat.com"
XSKT_BACKUP = "https://xskt.com.vn"

# Ngay som nhat kho luu tru con du lieu (do bang binary search).
EARLIEST_MN = date(2008, 1, 1)
EARLIEST_MB = date(2005, 10, 1)


def expected_mn_draws(dt):
    """So dai theo lich su: thu Bay co 4 dai tu 04/04/2009, cac ky khac 3."""
    return 4 if dt.weekday() == 5 and dt >= date(2009, 4, 4) else 3


def merge_xsmn_store(base, incoming):
    """Merge don dieu: chi them moi hoac thay bang ban co NHIEU dai hon.

    [] chi duoc ghi cho ngay chua tung co trong kho (ngay lich su da kiem tra
    nhung khong quay). Loi mang/loi ca hai nguon khong duoc xoa mot ban ket qua
    dang co, ke ca ban do con thieu dai.
    """
    merged = dict(base)
    for ds, draws in incoming.items():
        old = merged.get(ds)
        if draws:
            if not old or len(draws) > len(old):
                merged[ds] = draws
        elif ds not in merged:
            merged[ds] = []
    return merged

# XSMB trong CSV: GDB, G1, G2x2, G3x6, G4x4, G5x6, G6x3, G7x4 = 27 so
MB_WIDTHS = [5] * 10 + [4] * 10 + [3] * 3 + [2] * 4
# (nhan chuan hoa, so luong, do dai) khi parse HTML
MB_SPEC = [("ĐB", 1, 5), ("1", 1, 5), ("2", 2, 5), ("3", 6, 5),
           ("4", 4, 4), ("5", 6, 4), ("6", 3, 3), ("7", 4, 2)]
MN_SPEC = [("8", 1, 2), ("7", 1, 3), ("6", 3, 4), ("5", 1, 4),
           ("4", 7, 5), ("3", 2, 5), ("2", 1, 5), ("1", 1, 5),
           ("ĐB", 1, 6)]

# Ten dai bi doi cach viet theo thoi ky -> gop ve mot ten chuan.
# Vi du: "TP.HCM" dung 2008-2014, "TPHCM" tu 2014 tro di — cung mot dai.
PROV_ALIAS = {
    "TP.HCM": "TPHCM",
    "TP HCM": "TPHCM",
    "TP. HCM": "TPHCM",
    "Hồ Chí Minh": "TPHCM",
    "TP.Hồ Chí Minh": "TPHCM",
    "Lâm Đồng": "Đà Lạt",
    "Vũng Tầu": "Vũng Tàu",
    "Bà Rịa - Vũng Tàu": "Vũng Tàu",
}


def norm_prov(p):
    p = " ".join(p.split())
    return PROV_ALIAS.get(p, p)

_print_lock = threading.Lock()


def log(msg):
    with _print_lock:
        print(msg, flush=True)


def norm_label(s):
    """'G.8'->'8', 'G.ĐB'->'ĐB', 'ĐB'->'ĐB' (template cac trang khac nhau)."""
    s = s.strip()
    if s.startswith("G."):
        s = s[2:]
    elif s.startswith("G") and len(s) > 1:
        s = s[1:]
    return s.strip()


def fetch(url, timeout=15, retries=2):
    """Tai 1 URL -> (html, final_url) hoac (None, None)."""
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", errors="ignore"), r.geturl()
        except Exception:
            if i < retries:
                time.sleep(0.8 * (i + 1))
    return None, None


def _nums_in(cell):
    return re.findall(r">\s*(\d{2,6})\s*<", cell)


def _text_in(cell):
    """Bo tag HTML, chuan hoa khoang trang va entity."""
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", cell)).split())


def parse_xsmn_page(html):
    """Trang xsmn-DD-MM-YYYY.html -> [(ten_dai, [18 so])]; [] neu khong co."""
    m = re.search(
        r'<table class="table table-bordered table-striped table-xsmn.*?</table>',
        html, re.S)
    if not m:
        return []
    rows = m.group(0).split("<tr")
    provinces, prize_rows = [], {}
    for row in rows:
        if "<th" in row:
            found = [p.strip() for p in re.findall(r"<a[^>]*>([^<]+)</a>", row)]
            if found:
                provinces = found
            continue
        parts = row.split("<td")
        if len(parts) < 3:
            continue
        prize_rows[norm_label(parts[1].lstrip(">").split("<")[0])] = parts[2:]
    if not provinces:
        return []
    out = []
    for i, prov in enumerate(provinces):
        nums, ok = [], True
        for label, count, width in MN_SPEC:
            cells = prize_rows.get(label)
            if not cells or i >= len(cells):
                ok = False
                break
            got = _nums_in(cells[i])
            if len(got) != count:
                ok = False
                break
            for g in got:
                if len(g) > width:
                    ok = False
                    break
                nums.append(g.zfill(width))
            if not ok:
                break
        if ok and len(nums) == 18:
            out.append((prov, nums))
    return out


def parse_xsmn_backup_page(html):
    """Trang xskt.com.vn/ngay/D-M-YYYY -> [(ten_dai, [18 so])]."""
    m = re.search(r'<table class="tbl-xsmn.*?</table>', html, re.S)
    if not m:
        return []
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S)
    if not rows:
        return []
    heads = re.findall(r"<th[^>]*>(.*?)</th>", rows[0], re.S)
    provinces = [_text_in(cell) for cell in heads[1:]]
    if not provinces:
        return []

    prize_rows = {}
    for row in rows[1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 2:
            continue
        prize_rows[norm_label(_text_in(cells[0]))] = cells[1:]

    out = []
    for i, prov in enumerate(provinces):
        nums, ok = [], True
        for label, count, width in MN_SPEC:
            cells = prize_rows.get(label)
            if not cells or i >= len(cells):
                ok = False
                break
            got = re.findall(r"(?<!\d)(\d{2,6})(?!\d)", _text_in(cells[i]))
            if len(got) != count:
                ok = False
                break
            for value in got:
                if len(value) > width:
                    ok = False
                    break
                nums.append(value.zfill(width))
            if not ok:
                break
        if ok and len(nums) == 18:
            out.append((prov, nums))
    return out


def parse_xsmb_page(html):
    """Trang xsmb-DD-MM-YYYY.html -> [27 so] theo thu tu CSV, hoac None."""
    m = re.search(
        r'<table class="table table-bordered table-striped table-xsmb.*?</table>',
        html, re.S)
    if not m:
        return None
    rows = m.group(0).split("<tr")
    prize_rows = {}
    for row in rows:
        parts = row.split("<td")
        if len(parts) < 3:
            continue
        prize_rows[norm_label(parts[1].lstrip(">").split("<")[0])] = "".join(parts[2:])
    nums = []
    for label, count, width in MB_SPEC:
        cell = prize_rows.get(label)
        if cell is None:
            return None
        got = _nums_in(cell)
        if len(got) != count:
            return None
        for g in got:
            if len(g) > width:
                return None
            nums.append(g.zfill(width))
    return nums if len(nums) == 27 else None


# ---------- luu tru ----------
def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


def write_js(path, var, lines):
    body = "[\n" + ",\n".join(json.dumps(s, ensure_ascii=False) for s in lines) + "\n]"
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("window.%s = %s;\n" % (var, body))
    os.replace(tmp, path)


LATEST_LIMIT = 90


def latest_js_body(mb_lines, mn_lines, updated="", limit=LATEST_LIMIT):
    """Payload nhe cho man hinh ket qua ban dau.

    Tach rieng payload nhanh khoi bien toan kho de hai script dong khong the
    tao DB nua cu nua day du. app.js nhan mang tuong minh khi khoi tao.
    """
    mb = mb_lines[-limit:]
    mn = mn_lines[-limit:]
    return "window.XS_LATEST = %s;\n" % json.dumps(
        {"updated": updated, "mb": mb, "mn": mn}, ensure_ascii=False
    )


def write_latest_js(path, mb_lines, mn_lines, updated):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(latest_js_body(mb_lines, mn_lines, updated))
    os.replace(tmp, path)


def crawl_parallel(items, work_fn, workers, label, on_progress=None):
    """items: list; work_fn(item) -> (key, value or None). Tra ve dict ket qua."""
    out, done, t0 = {}, [0], time.time()
    lock = threading.Lock()

    def run(it):
        try:
            k, v = work_fn(it)
        except Exception:
            k, v = None, None
        with lock:
            done[0] += 1
            if k is not None:
                out[k] = v
            n = done[0]
            if n % 100 == 0:
                rate = n / max(time.time() - t0, 1e-9)
                eta = (len(items) - n) / max(rate, 1e-9)
                log("  ... %s %d/%d (%.1f req/s, con ~%d phut)"
                    % (label, n, len(items), rate, eta / 60 + 0.5))
                if on_progress:
                    on_progress(dict(out))
        return None

    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(run, items))
    return out


# ---------- XSMB ----------
def update_xsmb(workers):
    log("== XSMB ==")
    rows = {}
    csv_text, _ = fetch(XSMB_CSV_URL, timeout=45)
    if csv_text:
        for line in csv_text.strip().splitlines()[1:]:
            cols = line.strip().split(",")
            if len(cols) != 28:
                continue
            d = cols[0]
            rows[d] = d + "," + ",".join(c.zfill(w) for c, w in zip(cols[1:], MB_WIDTHS))
        log("  Dataset GitHub: %d ngay (moi nhat %s)" % (len(rows), max(rows) if rows else "?"))
    else:
        log("  ! Khong tai duoc dataset GitHub — dung du lieu da luu.")

    extra_path = os.path.join(DATA_DIR, "xsmb_extra.json")
    extra = {d: v for d, v in load_json(extra_path, {}).items() if d not in rows}

    # crawl bu nhung ngay dataset chua co (thuong la 1-3 ngay moi nhat)
    today = date.today()
    have = set(rows) | set(extra)
    if have:
        last = max(have)
        y, m, dd = map(int, last[:10].split("-"))
        pending = []
        d = date(y, m, dd) + timedelta(days=1)
        while d <= today:
            pending.append(d)
            d += timedelta(days=1)
        if pending:
            def work(dt):
                url = "%s/xsmb-%02d-%02d-%d.html" % (DAIPHAT, dt.day, dt.month, dt.year)
                html, _ = fetch(url)
                nums = parse_xsmb_page(html) if html else None
                ds = dt.isoformat()
                return (ds, ds + "," + ",".join(nums)) if nums else (None, None)
            got = crawl_parallel(pending[:30], work, min(workers, 4), "xsmb")
            for k, v in got.items():
                extra[k] = v
                log("  + crawl bo sung %s" % k)

    save_json(extra_path, extra)
    allrows = dict(rows)
    allrows.update({d: v for d, v in extra.items() if d not in allrows})
    out = [allrows[d] for d in sorted(allrows)]
    write_js(os.path.join(DATA_DIR, "xsmb.js"), "XSMB_LINES", out)
    log("  -> data/xsmb.js: %d ngay" % len(out))
    return len(out), (max(allrows) if allrows else ""), out


# ---------- XSMN ----------
def update_xsmn(target_days, fetch_all, workers, max_fetch):
    log("== XSMN ==")
    store_path = os.path.join(DATA_DIR, "xsmn.json")
    store = load_json(store_path, {})
    today = date.today()

    if fetch_all:
        oldest = EARLIEST_MN
    else:
        oldest = max(EARLIEST_MN, today - timedelta(days=target_days - 1))

    missing, d = [], today
    while d >= oldest:
        if d.isoformat() not in store:
            missing.append(d)
        d -= timedelta(days=1)

    # Nguon chinh co mot so ngay lich su chi luu 2/3 dai. Thu tai lai cac
    # ngay do va doi chieu nguon du phong thay vi im lang coi la day du.
    repair = []
    for ds, draws in store.items():
        if not draws:
            continue
        y, m, dd = map(int, ds.split("-"))
        dt = date(y, m, dd)
        expected = expected_mn_draws(dt)
        if len(draws) < expected and dt >= oldest:
            repair.append(dt)
    queued = {dt.isoformat() for dt in missing}
    missing.extend(dt for dt in repair if dt.isoformat() not in queued)

    have_ok = sum(1 for v in store.values() if v)
    log("  Kho hien co: %d ngay co ket qua | can tai/doi chieu: %d ngay (%d ngay thieu dai)"
        % (have_ok, len(missing), len(repair)))
    if not missing:
        log("  Da day du, khong can tai them.")
    else:
        if max_fetch and len(missing) > max_fetch:
            missing = missing[:max_fetch]
            log("  (gioi han %d ngay lan nay — chay lai de tai tiep)" % max_fetch)

        def work(dt):
            slug = "xsmn-%02d-%02d-%d.html" % (dt.day, dt.month, dt.year)
            html, final = fetch("%s/%s" % (DAIPHAT, slug))
            ds = dt.isoformat()
            res = parse_xsmn_page(html) if (html and final and slug in final) else []
            expected = expected_mn_draws(dt)
            if len(res) < expected:
                backup_url = "%s/ngay/%d-%d-%d" % (XSKT_BACKUP, dt.day, dt.month, dt.year)
                backup_html, _ = fetch(backup_url)
                backup = parse_xsmn_backup_page(backup_html) if backup_html else []
                if len(backup) > len(res):
                    res = backup
            if res:
                return ds, [[p, n] for p, n in res]
            # hom nay chua quay -> khong ghi nhan, de lan sau thu lai
            return (None, None) if dt == today else (ds, [])

        def snapshot(partial):
            merged = merge_xsmn_store(store, partial)
            save_json(store_path, merged)

        got = crawl_parallel(missing, work, workers, "xsmn", snapshot)
        before = {ds: len(v) for ds, v in store.items()}
        store = merge_xsmn_store(store, got)
        added = sum(1 for ds, v in store.items() if v and not before.get(ds))
        improved = sum(1 for ds, v in store.items() if before.get(ds, 0) and len(v) > before[ds])
        save_json(store_path, store)
        log("  Tai xong: them %d ngay, sua du %d ngay thieu dai" % (added, improved))

    out = []
    for ds in sorted(store):
        provs = store[ds]
        if provs:
            out.append(ds + "|" + "|".join(norm_prov(p) + ":" + ",".join(n) for p, n in provs))
    write_js(os.path.join(DATA_DIR, "xsmn.js"), "XSMN_LINES", out)
    log("  -> data/xsmn.js: %d ngay co ket qua" % len(out))
    return len(out), (out[-1][:10] if out else ""), out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true",
                    help="tai TOAN BO lich su con thieu (tu 2008 den nay)")
    ap.add_argument("--days", type=int, default=None,
                    help="dam bao du sau bao nhieu ngay (mac dinh: giu nguyen kho hien co)")
    ap.add_argument("--workers", type=int, default=8, help="so luong tai song song")
    ap.add_argument("--max-fetch", type=int, default=0,
                    help="gioi han so request moi lan chay (0 = khong gioi han)")
    args = ap.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    lock = os.path.join(DATA_DIR, ".update.lock")
    if os.path.exists(lock) and time.time() - os.path.getmtime(lock) < 60 * 60:
        log("Dang co tien trinh cap nhat khac chay (data/.update.lock). Bo qua lan nay.")
        return
    with open(lock, "w") as f:
        f.write(str(os.getpid()))

    cfg_path = os.path.join(DATA_DIR, "config.json")
    cfg = load_json(cfg_path, {})
    if args.all:
        cfg["fetch_all"] = True
    fetch_all = args.all or cfg.get("fetch_all", False)
    target = args.days or cfg.get("target_days", 1000)
    cfg["target_days"] = max(target, cfg.get("target_days", 0))
    save_json(cfg_path, cfg)

    t0 = time.time()
    try:
        mb_n, mb_last, mb_lines = update_xsmb(args.workers)
        mn_n, mn_last, mn_lines = update_xsmn(target, fetch_all, args.workers, args.max_fetch)
        updated = time.strftime("%Y-%m-%d %H:%M")
        write_latest_js(os.path.join(DATA_DIR, "latest.js"), mb_lines, mn_lines, updated)
    finally:
        try:
            os.remove(lock)
        except OSError:
            pass

    meta = {
        "updated": updated,
        "xsmb_days": mb_n, "xsmb_last": mb_last,
        "xsmn_days": mn_n, "xsmn_last": mn_last,
    }
    with open(os.path.join(DATA_DIR, "meta.js"), "w", encoding="utf-8") as f:
        f.write("window.XS_META = %s;\n" % json.dumps(meta, ensure_ascii=False))
    log("Xong sau %.0fs. XSMB %d ngay (den %s) | XSMN %d ngay (den %s)"
        % (time.time() - t0, mb_n, mb_last, mn_n, mn_last))


if __name__ == "__main__":
    main()
