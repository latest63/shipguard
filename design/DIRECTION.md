# ShipGuard — design direction

## Brief (self-authored)

LATI's instruction: *"use the web designer skill to make the app look good."*
No further brief was given, so this section answers Step 0 itself.

1. **What it is:** ShipGuard — a **web app** (not a marketing site) for
   AI-verified, escrowed crypto fundraising on GenLayer Studio Next. The core
   screen is **Explore Raises**: live 5-hour rounds, an escrowed GEN balance,
   a community poll, and a settlement that either releases to the team or
   refunds backers.
2. **The one job (app):** a backer opens the page to answer *"what round is
   open, how long is left, do I trust it, and how do I put GEN in?"* — and a
   judge opens it to see the whole escrow story in ten seconds.
3. **Three words:** *credible, tense, handson.* References from outside the
   web: a **harbour departure/berth board** (deadlines that really leave),
   a **bank escrow statement** (money that is provably held), and a
   **shipping manifest** (ShipGuard → cargo that is guarded until cleared).
4. **What exists:** name SHIPGUARD + wordmark, lemon/lime accent
   (`#d4ff00`-ish `primary`), dark neutral shell, Next.js 15 + Tailwind +
   lucide-react, real data (rounds, tallies, chain values), a real logo asset
   (`public/logo.png`, `favicon.png`).
5. **Image generation:** none connected in this session — all imagery must be
   the product's own live data, type, or code-drawn marks. No stock, no
   placeholders.

## Current (before)

Shot: `design/shots/before-explore/`, `design/shots/before-home/`.

**Scan FAILs (mechanical, free wins):**

| page | FAIL |
|---|---|
| explore | Contrast below AA — 12px metric value `0` at **2.70:1**, 11px captions at **3.26:1** (6 elements) |
| home | **Coloured glow shadow** on a button (slop: light comes from a scene, not buttons) |
| home | Text over image/gradient fails contrast at 390px — `"work ships"` at **1.16:1** (needs 3:1) |

**Scan warns:** 9–10 elements at **11px** on both pages (tiny metadata tell),
running body copy at 12px, **10 letter-spaced uppercase eyebrows** on home,
3 em dashes in visible copy.

**Data bug:** `GET …/rest/v1/raises?select=*&order=progress.desc` returns
**HTTP 401** from the anon key — the landing carousel gets no rows.

**Worn slop faces (redesign.md §2):** *The shadcn Dashboard* + *The Dark
Dev Tool* — a row of four KPI cards as the first thing on the app, zinc
greys on near-black, icon+label+number cards, boxes inside boxes (cards in
bordered panels in bordered dialogs), status hue for every state (green/red/
amber pills), everything at 11–14px.

**What works and must survive (keep list):**

- SHIPGUARD wordmark + logo asset, lemon accent as brand memory
- The four facts the metrics try to say (projects, GEN raised, verified, live
  rounds) — as one quiet line, not four cards
- The raise card: company, tagline, countdown, raised GEN, repo, verified
- The poll: tally bar, Yes/No, decided states with commit + settlement links
- The How-to dialog (content, shortened) and the detail dialog's deposit flow
- Filter tabs All / Live / Ended, empty state copy
- Live data everywhere (chain totals, tallies, countdowns) — never fake data

**Lose list:** KPI card row as the hero, 11px grey captions, glow shadow,
uppercase eyebrow per section, letter-spaced microlabels, em-dash copy,
low-contrast text over gradients.

**Decisions for the user (not taken silently):** none structural — no page,
feature, name or logo changes. Direction and tokens only.

## Category default we refuse

Dark zinc dashboard with a four-KPI card row, lime accents on every pill, and
11px grey captions — i.e. shipping *The Dark Dev Tool* face with a brand
colour poured in. Also refused: indigo/violet gradients, glow orbs, dot grids.

## Three concept sentences

1. **A — Instrument (dark, tool-first):** "ShipGuard is a berth board for
   money: every round is a departure with a clock, a load and a manifest."
   ground dark colour-field · type condensed grotesk + tabular mono numerals ·
   richness live data as instruments · accent signal amber · shell split
   (list + round) · motion countdown-tick + tally instrument.
2. **B — Statement (paper, document):** "ShipGuard is an escrow statement:
   ruled rows, a stamped seal, and a balance anyone can read."
   ground paper · type editorial serif + mono figures · richness hairline
   engraving and a code-drawn seal · accent oxblood · shell document ·
   motion print/stamp.
3. **C — Cargo (light, catalogue):** "ShipGuard is a freight catalogue: real
   project marks, generous plates, one decisive load meter."
   ground light/cool · type expanded grotesk display · richness real logos +
   colour plates · accent deep teal · shell catalogue grid · motion plate
   reveal.

(One paper only — B. The other two must not drift into it.)

## Tokens — chosen after exploration

**Choice: concept A — the berth board** (`explore/a.html`), merged with the
existing lemon accent as brand memory (amber in the study; `--primary`
lemon in the build — same signal job, keeps the wordmark's colour story).

Colour roles (dark is the only mode; the app is an instrument):

| role | token | value |
|---|---|---|
| ground | `--background` | `#0d1110` (ink-green black, not zinc) |
| panel | `--panel` | `#121715` manifest column |
| hairline | `--hair` | `#232b27` — structure by rule, not box |
| ink | `--foreground` | `#eef2ee` |
| dim | `--muted` | `#9aa69e` (AA at 13px+ on ground) |
| signal | `--primary` | lemon `#d4ff00`-family — the ONE accent: live state, active tab, meter fill, CTA |
| go | `--ok` | `#5fd08a` — status only: LIVE dot, verified, released |

Type: **condensed grotesk display** (Roboto Condensed, self-hosted via
next/font; metric-close fallbacks Arial Narrow / Liberation Sans Narrow)
for headings and round titles — departures are set narrow. **Inter** for
running body (variable weights already self-hosted; it recedes and lets
the data speak). **JetBrains Mono with tabular figures** for every number,
clock, hash, gate code and label — chosen, not default: a board's data
column must align digit-under-digit, and JBM is the repo's existing mono
with 100–800 weights self-hosted. Scale: 44/34 display, 26 clock, 20/18
round title, 14 body, 13 metadata, 12 mono labels (nothing at 11px).

Spacing/geometry: rows separated by hairlines edge-to-edge (no card grid,
no nested boxes), radius 3px only on controls, page max 1160, gutters 20.
Meter = 6px flat bar, no gradient. Shadows: none.

Grammar: **split board** — one vertical list of round rows, each row
carrying gate/status · manifest · clock · load columns; the metric cards
become one quiet mono line under the headline.

Signature: **the clock ticks** — every live round's countdown is tabular
mono updating each second; under 30 min (the decision window) it turns
signal colour and the LIVE dot pulses. Reduced motion: static text, no
pulse, clock still updates once per second (it is data, not decoration).

Voice: port authority. Short, factual, uppercase only for statuses.
"Backed", "escrowed", "released", "refunded" — never "unlock", "seamless",
"empower".

## Choice

**A — the berth board** won: it is the only study that is *this product*
(ShipGuard → guarded cargo → a board where rounds literally depart on a
clock), it puts the escrow story in ten seconds for a judge, and the row
grammar scales from 3 rounds to 30 without redesign.

- **B (paper statement) lost:** most trustworthy of the three, but the
  document metaphor freezes the thing that matters — rounds are *live and
  leaving*. A statement is read after the fact.
- **C (freight catalogue) lost:** the card grid is the exact category
  default we refused (KPI-ish plates, status pills, three-up), and it
  carried 3 contrast FAILs on the coloured bands. Semi-distinctive at best.

Merged from the others: from B, the balance line's plain-language framing
("money stays in the Vault either way"); from C, the settled-round strip
staying visible under the live rows.
