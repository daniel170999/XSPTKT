# -*- coding: utf-8 -*-
import tempfile
import unittest
from pathlib import Path
from datetime import date
from unittest.mock import patch

import update
from update import (LATEST_LIMIT, latest_js_body, load_js_lines, merge_xsmn_store,
                    official_confirms_numbers, parse_xsmn_backup_page, parse_xsmn_page)


PRIMARY_HTML = """
<table class="table table-bordered table-striped table-xsmn">
<tr><th>Giải</th><th><a>Đồng Nai</a></th></tr>
<tr><td>G.8</td><td><b>07</b></td></tr>
<tr><td>G.7</td><td><b>123</b></td></tr>
<tr><td>G.6</td><td><b>0001</b><b>0002</b><b>0003</b></td></tr>
<tr><td>G.5</td><td><b>0004</b></td></tr>
<tr><td>G.4</td><td><b>00005</b><b>00006</b><b>00007</b><b>00008</b><b>00009</b><b>00010</b><b>00011</b></td></tr>
<tr><td>G.3</td><td><b>00012</b><b>00013</b></td></tr>
<tr><td>G.2</td><td><b>00014</b></td></tr>
<tr><td>G.1</td><td><b>00015</b></td></tr>
<tr><td>G.ĐB</td><td><b>000016</b></td></tr>
</table>
"""

BACKUP_HTML = """
<table class="tbl-xsmn col3" id="MN0">
<tr><th>Thứ 4<br>24/02</th><th><a href="/xsdn">Đồng Nai</a></th></tr>
<tr><td>G.8</td><td><b>07</b></td></tr>
<tr><td>G.7</td><td>123</td></tr>
<tr><td>G.6</td><td>0001<br>0002<br>0003</td></tr>
<tr><td>G.5</td><td>0004</td></tr>
<tr><td>G.4</td><td>00005<br>00006<br>00007<br>00008<br>00009<br>00010<br>00011</td></tr>
<tr><td>G.3</td><td>00012<br>00013</td></tr>
<tr><td>G.2</td><td>00014</td></tr>
<tr><td>G.1</td><td>00015</td></tr>
<tr><td>ĐB</td><td><b>000016</b></td></tr>
</table>
"""


class ParserTests(unittest.TestCase):
    def assert_valid_draw(self, rows):
        self.assertEqual(len(rows), 1)
        province, nums = rows[0]
        self.assertEqual(province, "Đồng Nai")
        self.assertEqual(len(nums), 18)
        self.assertEqual(nums[0], "07")
        self.assertEqual(nums[-1], "000016")

    def test_primary_xsmn_parser(self):
        self.assert_valid_draw(parse_xsmn_page(PRIMARY_HTML))

    def test_backup_xsmn_parser(self):
        self.assert_valid_draw(parse_xsmn_backup_page(BACKUP_HTML))

    def test_merge_never_downgrades_existing_draw(self):
        old = {"2010-02-24": [["Dong Nai", ["1"]], ["Can Tho", ["2"]]]}
        self.assertEqual(merge_xsmn_store(old, {"2010-02-24": []}), old)
        same_size = {"2010-02-24": [["A", ["3"]], ["B", ["4"]]]}
        self.assertEqual(merge_xsmn_store(old, same_size), old)

        improved = {"2010-02-24": old["2010-02-24"] + [["Soc Trang", ["5"]]]}
        self.assertEqual(len(merge_xsmn_store(old, improved)["2010-02-24"]), 3)

    def test_merge_keeps_verified_empty_only_for_new_day(self):
        merged = merge_xsmn_store({}, {"2008-01-02": []})
        self.assertIn("2008-01-02", merged)
        self.assertEqual(merged["2008-01-02"], [])

    def test_latest_payload_keeps_only_the_newest_days(self):
        mb = ["2026-01-%02d,00000" % (i + 1) for i in range(LATEST_LIMIT + 4)]
        mn = ["2026-02-%02d|A:00" % (i + 1) for i in range(LATEST_LIMIT + 4)]
        body = latest_js_body(mb, mn, "2026-08-25 16:42")
        self.assertIn('window.XS_LATEST = {', body)
        self.assertIn('"updated": "2026-08-25 16:42"', body)
        self.assertIn(mb[-1], body)
        self.assertIn(mn[-1], body)
        self.assertNotIn(mb[0], body)
        self.assertNotIn(mn[0], body)

    def test_official_check_requires_full_ordered_draw(self):
        nums = ["07", "123", "0001", "0002", "0003", "0004", "00005", "00006", "00007", "00008", "00009", "00010", "00011", "00012", "00013", "00014", "00015", "000016"]
        page = "<main>" + " ".join("<b>%s</b>" % value for value in nums) + "</main>"
        self.assertTrue(official_confirms_numbers(page, nums))
        self.assertFalse(official_confirms_numbers(page, nums[::-1]))
        self.assertFalse(official_confirms_numbers(page, nums[:-1]))

    def test_load_js_lines_rejects_non_string_values(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rows.js"
            path.write_text('window.XSMB_LINES = ["2026-01-01,00000"];\n', encoding="utf-8")
            self.assertEqual(load_js_lines(str(path), "XSMB_LINES"), ["2026-01-01,00000"])
            path.write_text('window.XSMB_LINES = [1];\n', encoding="utf-8")
            self.assertEqual(load_js_lines(str(path), "XSMB_LINES"), [])

    def test_xsmb_keeps_existing_lines_when_all_sources_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            old_dir = update.DATA_DIR
            try:
                update.DATA_DIR = folder
                today = date.today().isoformat()
                row = today + "," + ",".join(["00000"] * 27)
                Path(folder, "xsmb.js").write_text('window.XSMB_LINES = ["%s"];\n' % row, encoding="utf-8")
                with patch("update.fetch", return_value=(None, None)):
                    count, last, rows = update.update_xsmb(1)
                self.assertEqual((count, last, rows), (1, today, [row]))
            finally:
                update.DATA_DIR = old_dir


if __name__ == "__main__":
    unittest.main()
