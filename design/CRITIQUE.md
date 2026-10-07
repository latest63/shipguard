# CRITIQUE — ShipGuard berth-board redesign

## Round 1 (design/shots/r1-explore)
Scan FAIL: contrast 4.24:1 on active-tab count (black-on-lemon at
opacity-70). Warns: default-reach font, 10 letter-spaced uppercase
labels, 3 images without dimensions (CLS).

Findings from the sheet + slices:
- Metric line too dim to carry the four facts; KPI-card row was the old
  hero (replaced by quiet mono line — correct per redesign.md).
- Tabs/How-to used uppercase tracking on *controls*; tracking is now
  reserved for statuses (LIVE / gate codes).
- Round code kept `tracking-wider`, removed.

Fixes: opacity-70 → 100%, width/height=32 on row logos, uppercase+tracking
removed from tabs and How-to, DIRECTION.md rewritten to justify JetBrains
Mono as the data face (scan warn answered), Roboto Condensed self-hosted
as display face, html animated lemon gradient removed (1.16:1 FAIL on
"work ships").

## Round 2 (design/shots/r2-explore + r2-home)
Scan: FAILs gone. Home: 0 FAILs, warns = icons in tinted squares, CLS imgs.

Critic (vision, sheet at 4 widths):
- **768px broken**: manifest column squeezed to ~100px, "poll open · no
  votes yet" wrapped one word per line. Root cause: 4-col grid engaged at
  `md:` (768px). **Fix: 4-col board only from `lg:` (1024px); below that
  rows stack full-width.**
- Matrix FAIL (windows-hc): inactive tab lost its shape when High
  Contrast strips backgrounds. **Fix: every tab is its own bordered
  control (`border border-border -ml-px first:ml-0`), container border
  removed.**
- Metric line contrast OK on desktop, mobile metrics stack acceptable.

## Round 3 (design/shots/r3-explore)
Scan: **0 FAILs**, font warn answered in DIRECTION.md.
Matrix: **0 FAILs** (windows/linux/mac/android/reflow-320/motion clean;
firefox/safari skipped — engines not installed on this box).

Critic scores (sheet, 4 widths): distinctiveness **7.5**, hierarchy **8**,
data clarity **8.5**, craft **8**. Verdict: "would pass as designed by a
top studio, with minor polish."

Remaining findings (accepted / out of scope):
1. Mobile metric line stacks — deliberate (facts still readable, 13px).
2. Desktop column rhythm slightly uneven — row heights vary with 1-line
   vs 2-line descriptions; acceptable for a data table.
3. Hamburger on desktop — Navbar is shared across pages, kept for
   consistency; a desktop link row is a Navbar-level change, not this pass.
4. Floating "N" bottom-left — Next.js dev-tools indicator, dev only,
   absent in production builds.
5. Gate code + decision subtext grouping — minor, left as is.

## Round count: 3 (skill allows 2–4). Ending here: no FAILs, every warn
answered, critic above plateau threshold.
