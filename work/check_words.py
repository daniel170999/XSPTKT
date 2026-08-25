#!/usr/bin/env python3
"""Fail CI when a prohibited public-language term appears in a tracked text file."""

from __future__ import annotations

import re
import subprocess
import sys
import unicodedata
from pathlib import Path


TERMS = (
    "\u0073\u006f\u0069 \u0063\u1ea7\u0075",
    "\u0073\u006f\u0069 \u0063\u0061\u0075",
    "\u006c\u00f4 \u0111\u1ec1",
    "\u006c\u006f \u0064\u0065",
    "\u0073\u1ed1 \u0111\u1ec1",
    "\u0111\u00e1\u006e\u0068 \u0111\u1ec1",
    "\u0111\u00e1\u006e\u0068 \u006c\u00f4",
    "\u006c\u00f4 \u0072\u01a1\u0069",
    "\u006c\u00f4 \u0067\u0061\u006e",
    "\u006b\u00e8\u006f",
    "\u0063\u0068\u1ed1\u0074 \u006b\u00e8\u006f",
    "\u006e\u0068\u00e0 \u0063\u00e1\u0069",
    "\u0063\u00e1 \u0063\u01b0\u1ee3\u0063",
    "\u0111\u00e1\u006e\u0068 \u0063\u01b0\u1ee3\u0063",
    "\u0111\u1eb7\u0074 \u0063\u01b0\u1ee3\u0063",
    "\u0062\u1ea1\u0063\u0068 \u0074\u0068\u1ee7",
    "\u0073\u006f\u006e\u0067 \u0074\u0068\u1ee7",
    "\u0064\u00e0\u006e \u0111\u1ec1",
    "\u0063\u1ea7\u0075 \u006c\u00f4",
    "\u006e\u0075\u00f4\u0069 \u006c\u00f4",
    "\u0031 \u0103\u006e",
    "\u0103\u006e \u0074\u0068\u00f4\u006e\u0067",
    "\u0063\u0068\u1ed1\u0074 \u0073\u1ed1",
    "\u0062\u0061\u006f \u006c\u00f4",
    "\u0078\u0069\u00ea\u006e",
    "\u0067\u0069\u1ea3\u0069 \u006d\u00e3 \u0067\u0069\u1ea5\u0063 \u006d\u01a1",
    "\u0073\u1ed5 \u006d\u01a1",
)
# "càng" là từ tiếng Việt thông dụng trong tài liệu kỹ thuật; chỉ chặn cụm số học
# có ngữ cảnh không phù hợp thay vì chặn mọi lần xuất hiện của từ này.
CONTEXT_PATTERNS = (r"(?<!\w)(?:3|ba)\s+càng(?!\w)",)


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], check=True, stdout=subprocess.PIPE
    )
    return [Path(item.decode("utf-8")) for item in result.stdout.split(b"\0") if item]


def is_binary(raw: bytes) -> bool:
    return b"\0" in raw


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    regex = re.compile(
        r"(?<!\w)(?:" + "|".join(map(re.escape, TERMS)) + r")(?!\w)|"
        + "|".join(CONTEXT_PATTERNS),
        re.IGNORECASE,
    )
    hits: list[str] = []
    for path in tracked_paths():
        # Cho phép chạy giữa lúc một file tracked đang được đổi tên; Git index
        # chưa cập nhật nhưng filesystem đã không còn file cũ.
        if not path.exists():
            continue
        raw = path.read_bytes()
        if is_binary(raw):
            continue
        text = unicodedata.normalize("NFC", raw.decode("utf-8", errors="replace"))
        for lineno, line in enumerate(text.splitlines(), start=1):
            match = regex.search(line)
            if match:
                hits.append(f"{path}:{lineno}: {match.group(0)}")
    if hits:
        print("Phát hiện cụm từ không được phép:")
        print("\n".join(hits))
        return 1
    print("check_words: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
