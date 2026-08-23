# -*- coding: utf-8 -*-
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date

from update import (DATA_DIR, XSKT_BACKUP, expected_mn_draws, fetch,
                    parse_xsmn_backup_page)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

with open(os.path.join(DATA_DIR, "xsmn.json"), encoding="utf-8") as handle:
    store = json.load(handle)

for ds, current in sorted(store.items()):
    if not current:
        continue
    year, month, day = map(int, ds.split("-"))
    expected = expected_mn_draws(date(year, month, day))
    if len(current) >= expected:
        continue
    html, _ = fetch(f"{XSKT_BACKUP}/ngay/{day}-{month}-{year}")
    backup = parse_xsmn_backup_page(html or "")
    print(ds, "current", len(current), "backup", len(backup), [p for p, _ in backup], flush=True)
