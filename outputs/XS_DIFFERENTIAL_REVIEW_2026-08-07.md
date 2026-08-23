# Independent v1.0 differential review — 2026-08-07

## Executive result

- Review scope: final v1.0 polish described in `ROADMAP.md` §4–5 (dead-code removal, pin/exclude, multi-window modal, favicon/manifest, facts/tooltips/docs).
- Historical diff limitation: this folder is **not a Git repository**, so no commit/diff history exists to compare. Scope was reconstructed from file timestamps, `ROADMAP.md`, the supplied change list, and direct source inspection.
- Findings fixed: **2** (1 state-corruption crash, 1 redundant modal computation). No statistical formula, score, signal, or data-selection rule changed.
- Remaining review findings: none at release-blocking severity.

## Findings and fixes

### F1 — malformed but parseable pin/exclude storage could crash the UI (fixed)

`pxLoad()` caught invalid JSON, but accepted valid JSON with wrong field types, for example `{"pin":"323","excl":[null]}`. Subsequent `.filter()` / `.includes()` in pin, exclude, and quick-pick paths could then throw.

Fix in `ui.js`: accept only unique string values matching 2 or 3 digits; otherwise return empty arrays. Invalid JSON remains caught. Regression test `work/audit_v1_regression.cjs` was first observed failing, then passing after the fix.

### F2 — modal recomputed the already-available full-window analysis (fixed)

The four comparison windows (90/365/1000/all) legitimately require three independent analyses. When the active scope was already `TẤT CẢ`, the fourth, `Toàn bộ`, repeated the current `Ax` analysis. `openNum()` now reuses `Ax` only in that identical case. The modal still calculates all four displayed windows when a smaller active scope is selected.

Browser timing after the fix: 344 ms to open a 3-digit XSMN modal with all four comparison rows.

## Reviewed without defect

- Dead-code cleanup is safe: no `NEXT.actual`, `.nb.hit`, `.nb.miss`, or `.nb .res` references remain. `jResolve()` still returns `aHit`/`aExp`, and `journalFlash()` still uses `aHit` for notification text.
- `unbiasedPick()` keeps the required sequential prefix in the app’s supported use range. Regression test checked `n=1…10`, 100 seeds, for U=100 and U=1000 against the prefix of the full stream.
- Rapid pin/exclude clicks do not create a read/write race: handlers have no `await` or async boundary; each click reads, mutates, stores, then rerenders synchronously. A pin is deliberately global across MB/MN, while 2- and 3-digit entries are separated by length.
- Pin/exclude UI test: pin `323` became the first quick pick; excluding it removed it; the opposite list was cleared; cleanup left no exclusion.
- `openNum()` is descriptive only; it calls `analyze()` for comparison rows and does not rank or alter the score model.
- `manifest.json` parses, `icon.svg` parses as XML, links exist in `index.html`, and no service-worker registration exists.
- The help table facts #23–25 match BLUEPRINT §4. All 29 glossary keys have a visible tooltip reference across `ui.js` and `index.html` (including `doichung` on the journal’s machine-pick button).

## Verification evidence

| Check | Result |
|---|---|
| `node --check app.js`, `node --check ui.js` | exit 0 |
| `node test_model.cjs` | `test_model: OK` |
| `node work/audit_v1_regression.cjs` | `audit_v1_regression: OK` |
| `python.exe test_update.py` | 4 tests, OK |
| LIVE `/api/status` | `live:true`; MB 7,514 / MN 6,659, both through 2026-08-06 |
| UI navigation | 6/6 tabs and 3/3 Analysis subviews passed |
| MB/MN × 2/3 digits | 4/4 showed `MÁY CHỌN ĐỀU`, no console errors |
| Responsive | 0 px horizontal overflow for all 6 tabs at 375 px and 1280 px |
| Backtest | 300 XSMN/all/3-digit, W=365, dàn 10: 1.8 s; top-1 p=0.752 |
| `update.py` | 3 s; counts unchanged before/after: MB 7,514, MN 6,659 |

## Scope and conclusion

The review found no basis to change the locked statistical model. The 300-day backtest remains non-predictive: OOS uplift +5.1% in this one run, but top-1 p=0.752 while the in-sample comparator is +117.0%, consistent with overfit/noise rather than usable edge. v1.0 is ready to use as the documented historical-statistics tool; it does not provide evidence for a profitable forecast.
