# Settle performance — results

Measured on the production build with `bench/` (headless Edge over the DevTools protocol, no Lighthouse). **low** = budget Android (CPU 4× slower, 1.6 Mbps / 750 Kbps, 150 ms RTT, 360×800); **mid** = an unthrottled phone. Heavy data = 60 friends, 12 groups, 1,500 expenses (150 itemised bills), two years; one group with 300 expenses. Every number is a median of 5 runs.

## Summary — baseline (298bdd2) → now (e4d826a)

Fair comparisons only: each row comes from an **interleaved A/B** (before and after measured alternately in one browser, so machine noise hits both alike). Startup rows: `bench/ab.mjs --a dist-298bdd2 --b dist-final --only cold,warm` (`results/ab-final-vs-baseline-startup.json`); screen-open and scrolling rows: that fix's own A/B.

| user moment (low profile unless noted) | before | now | change | from |
| --- | --- | --- | --- | --- |
| **Open the app again** (warm, 2 years of data): Home content painted | 8.47 s | **6.52 s** | **−23%** | fix 1 |
| Open the app again: interactive / balance finished counting | 8.47 s / 10.08 s | 6.52 s / 7.98 s | −23% / −21% | fix 1 |
| Open the app again: data layer (parse + validate) | 2.61 s | 0.81 s | **−69%** | fix 1 |
| Open with data but an empty browser cache (after an update or cache eviction): Home interactive | 10.30 s | 8.65 s | −16% | fix 1 |
| First visit to `/app` (welcome): content / interactive | 5.29 s / 5.97 s | 5.39 s / 5.70 s | ±5% (noise) | — |
| A friend opens a `/pay` link: content / interactive | 6.53 s / 6.53 s | 6.57 s / 6.57 s | ±1% (noise) | — (see deferred 4–5) |
| **Open a group with 300 expenses** | 7.69 s | **1.59 s** | **−79%** | fix 2 |
| Open a group with 300 expenses — mid phone | 783 ms | 185 ms | −76% | fix 2 |
| **Scroll Activity to the oldest of 1,500** (jump) | 164.9 s | **66.1 s** | **−60%** | fix 3 |
| … p95 frame / long-task time while doing it | 5.80 s / 162.8 s | 1.75 s / 64.0 s | −70% / −61% | fix 3 |
| Fling a 300-expense group to its oldest row | 4.01 s | 10.86 s | **+171%** (trade-off of fix 2; mid unchanged at 3.9 s) | fix 2 |

What is still slow, in order of user impact: warm start is still 6.5 s on a budget phone (the data layer and Home's first render — fixes live in src/data and src/lib, see **Deferred wins**); first visits are bound by 186–212 KB of JS and ~3.5 s of main-thread work at 4× CPU; loading older rows is a ~1.5 s long task per page on the low profile (**Open issues** 1). Bytes: up-front JS grew 532 → 547 KB raw (175 → 180 KB gzip) from the feature work merged meanwhile (the `data` chunk +12.9 KB); the perf fixes themselves added ~0.5 KB (the shared pager).


## How this is measured

`npm run bench` (= `node bench/run.mjs`) drives headless Edge over the DevTools protocol against the **production build** served by the real server (`node dist/server/index.js`: same compression, cache headers, service worker), no Lighthouse.

| profile | CPU | network | screen |
| --- | --- | --- | --- |
| **low** (budget Android) | 4× slower (CDP throttling) | 1.6 Mbps down / 750 Kbps up / 150 ms RTT, shaped by the bench's own TCP proxy | 360×800 @2x |
| **mid** | not throttled | not throttled | 375×812 @3x |

Data sets: **empty** (a first visit) and **heavy** (seeded into localStorage through the app's own engine and schemas: 60 friends, 12 groups, 1,500 expenses incl. 150 itemised bills, two years of history; one group with 300 expenses). Every metric is the median of 5 runs with the min–max spread.

- **Cold first visit** (no HTTP cache, no service worker) to `/app` and to a friend's `/pay#…` link: TTFB, FCP, LCP, *content* (the screen's real content is in the DOM and painted), *interactive* (content painted and no long task for 500 ms), TBT, bytes by type.
- **Warm repeat visit** (heavy data; HTTP + service-worker caches warm, worker stopped): Home content, the balance finished counting up, interactive; the data layer's own `performance.measure` marks (src/lib/perfMarks.ts).
- **Screen opens** (heavy data): tap → target content painted (rAF + message after the selector matches).
- **Scrolling to the oldest row**: Activity (1,500) and the 300-expense group, *fling* (10,000 px/s, frame times and jank) and *jump* (to the bottom every frame: how fast older rows can load at all).
- **Bundle**: every JS/CSS file raw, gzip and brotli, and what the HTML shell loads up front.

Tools: `bench/ab.mjs` (interleaved before/after of two builds, used to decide every fix), `bench/profile.mjs` (CPU profile, trace, coverage, source-mapped), `bench/composition.mjs` (what's in each chunk), `bench/dom.mjs` (DOM census of a painted screen), `bench/micro.mjs` (data layer in Node), `bench/compare.mjs` (the summary table below from two full runs).

**Honesty notes.** The baseline is a clean build of **298bdd2** — the commit before the first fix — made from `git archive` in a temp directory (an earlier partial baseline from a working-tree snapshot turned out to differ from 298bdd2 in Home's CSS and was discarded). While the baseline ran, A/B runs and profiles for the fixes were running on the same 8-core machine, which can inflate some absolute baseline numbers (look at the spreads); each fix's keep/revert decision comes only from its own interleaved A/B, which is immune to that.

## Baseline — 298bdd2, before any fix (`bench/run.mjs`, `results/baseline-298bdd2.json`)

##### Bundle (54 JS + 30 CSS files, 11 fonts)

Up front in the HTML shell: JS 532.1 KB raw / 175.4 KB gzip / 153.2 KB br; CSS 132.0 KB raw / 25.6 KB gzip / 22.3 KB br
All: JS 924.1 KB raw / 324.1 KB gzip; CSS 268.8 KB raw / 63.0 KB gzip; fonts 143.4 KB

##### Largest files

| file | raw | gzip | brotli |
| --- | --- | --- | --- |
| /assets/index-bghwgJEe.js | 317.3 KB | 101.3 KB | 87.7 KB |
| /assets/router-B-ARkD_S.js | 122.2 KB | 41.0 KB | 35.7 KB |
| /assets/router-CU04_HZP.css | 80.3 KB | 15.0 KB | 13.0 KB |
| /assets/BillFlow-DAV765ya.js | 66.9 KB | 22.4 KB | 19.9 KB |
| /assets/index-b-nDrp8MDp.js | 54.1 KB | 20.2 KB | 17.9 KB |
| /assets/index-DrczD3L9.css | 51.7 KB | 10.6 KB | 9.4 KB |
| /assets/data-Dbq1o_J2.js | 36.3 KB | 12.6 KB | 11.3 KB |
| /assets/LandingPage-oi9WDrFj.js | 35.5 KB | 11.5 KB | 10.1 KB |
| /assets/categories-BTIXsA70.js | 30.6 KB | 10.1 KB | 9.0 KB |
| /assets/geist-latin-wght-normal-BgDaEnEv.woff2 | 28.7 KB | 28.7 KB | 28.7 KB |
| /assets/LandingPage-Bh7VY-4b.css | 27.3 KB | 5.8 KB | 5.1 KB |
| /assets/YouScreen-CqgMCsJZ.js | 24.5 KB | 8.7 KB | 7.8 KB |
| /assets/geist-mono-latin-wght-normal-XN7g48iV.woff2 | 22.6 KB | 22.6 KB | 22.6 KB |
| /assets/BillFlow-DuDyBDlO.css | 20.5 KB | 4.4 KB | 3.9 KB |
| /assets/NewSplitScreen-nMU7a-en.js | 18.2 KB | 7.0 KB | 6.3 KB |

#### Profile: low (CPU 4× slower, 1.6 Mbps / 150 ms RTT)

##### Cold first visit — low

| page | TTFB | FCP | LCP | content | interactive | TBT | JS | CSS | fonts | requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app (empty) | 492 ms (484 ms–503 ms) | 5.16 s (4.08 s–6.34 s) | 5.16 s (4.81 s–6.47 s) | 5.13 s (4.06 s–5.89 s) | 5.13 s (5.00 s–6.82 s) | 2.78 s | 186.4 KB | 28.4 KB | 30.0 KB | 14 |
| pay link | 484 ms (467 ms–509 ms) | 5.94 s (5.52 s–8.38 s) | 6.92 s (5.77 s–9.56 s) | 7.18 s (6.19 s–9.55 s) | 7.18 s (6.19 s–9.55 s) | 4.27 s | 206.9 KB | 34.1 KB | 30.0 KB | 22 |
| app (heavy) | 485 ms (480 ms–489 ms) | 10.94 s (9.84 s–11.22 s) | 10.94 s (9.84 s–11.22 s) | 10.73 s (9.95 s–11.34 s) | 11.54 s (10.17 s–12.41 s) | 9.08 s | 186.4 KB | 28.4 KB | 47.3 KB | 15 |

##### Warm repeat visit, heavy data — low

| TTFB | FCP | Home content | balance final | interactive | TBT | network |
| --- | --- | --- | --- | --- | --- | --- |
| 200 ms (194 ms–206 ms) | 9.57 s (8.83 s–14.34 s) | 9.68 s (8.92 s–14.58 s) | 11.12 s (10.34 s–15.80 s) | 11.01 s (9.02 s–14.58 s) | 9.18 s | 1.4 KB |

##### Data layer startup (performance marks), heavy data — low

| phase | p50 (min–max) |
| --- | --- |
| derive:sortExpenses | 10.7 ms (7.5 ms–23.5 ms) |
| derive:summary | 151.3 ms (149.7 ms–320.7 ms) |
| load:parse:settle.v3.expenses | 196.6 ms (188.6 ms–252.4 ms) |
| load:parse:settle.v3.friends | 1.0 ms (0.8 ms–4.1 ms) |
| load:parse:settle.v3.groups | 0.9 ms (0.8 ms–2.8 ms) |
| load:parse:settle.v3.profile | 0.8 ms (0.5 ms–1.4 ms) |
| load:parse:settle.v3.recurring | 0.4 ms (0.4 ms–0.6 ms) |
| load:total | 3507.7 ms (2803.9 ms–5681.5 ms) |
| load:validate:settle.v3.expenses | 3079.1 ms (2409.8 ms–5127.4 ms) |
| load:validate:settle.v3.friends | 67.3 ms (48.7 ms–133.9 ms) |
| load:validate:settle.v3.groups | 48.0 ms (37.1 ms–99.2 ms) |
| load:validate:settle.v3.profile | 47.6 ms (46.1 ms–63.0 ms) |
| load:validate:settle.v3.recurring | 11.4 ms (7.3 ms–16.6 ms) |

##### Screen opens (tap → content painted), heavy data — low

| transition | p50 (min–max) | long tasks |
| --- | --- | --- |
| Home → Activity (tab) | 2.12 s (1.79 s–4.36 s) | 2.10 s |
| Activity → Expense (bill) | 1.33 s (1.18 s–2.73 s) | 1.33 s |
| Activity → Groups (tab) | 1.19 s (1.11 s–1.34 s) | 1.18 s |
| Groups → Group detail (300) | 7.43 s (2.10 s–9.67 s) | 7.42 s |
| Groups → Home (tab) | 645 ms (589 ms–1.10 s) | 641 ms |
| Home → New split | 1.82 s (1.71 s–2.44 s) | 1.79 s |
| Home → Bill flow | 364 ms (250 ms–423 ms) | 315 ms |
| Home → You (tab) | 883 ms (794 ms–929 ms) | 873 ms |
| You → Home (tab) | 696 ms (348 ms–833 ms) | 688 ms |

##### Scrolling to the oldest item, heavy data — low

| list (mode) | time to oldest | frames >16.7 ms | dropped frames | p95 frame | long tasks | stalled | DOM nodes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| activity:fling | 141.09 s (126.99 s–144.69 s) | 108 | 8339 | 4.75 s | 130 (138.76 s) | 20.71 s | 26023 |
| activity:jump | 158.49 s (141.73 s–196.15 s) | 124 | 9372 | 5.37 s | 130 (156.15 s) | 149.98 s | 26023 |
| group:fling | 4.03 s (4.01 s–4.33 s) | 21 | 200 | 317 ms | 14 (3.36 s) | 0 ms | 6227 |

#### Profile: mid (no CPU throttling, no network throttling)

##### Cold first visit — mid

| page | TTFB | FCP | LCP | content | interactive | TBT | JS | CSS | fonts | requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app (empty) | 12 ms (9 ms–13 ms) | 972 ms (904 ms–1.12 s) | 1.09 s (988 ms–1.24 s) | 935 ms (868 ms–1.10 s) | 935 ms (868 ms–1.10 s) | 308 ms | 186.4 KB | 28.4 KB | 30.0 KB | 14 |
| pay link | 13 ms (12 ms–13 ms) | 1.24 s (1.19 s–1.40 s) | 1.24 s (1.19 s–1.40 s) | 1.32 s (1.29 s–1.39 s) | 1.32 s (1.29 s–1.39 s) | 363 ms | 206.9 KB | 34.1 KB | 47.3 KB | 22 |
| app (heavy) | 12 ms (10 ms–14 ms) | 1.56 s (1.36 s–1.68 s) | 1.59 s (1.40 s–1.71 s) | 1.51 s (1.32 s–1.62 s) | 1.81 s (1.54 s–2.17 s) | 1.08 s | 244.4 KB | 40.0 KB | 47.3 KB | 31 |

##### Warm repeat visit, heavy data — mid

| TTFB | FCP | Home content | balance final | interactive | TBT | network |
| --- | --- | --- | --- | --- | --- | --- |
| 69 ms (59 ms–100 ms) | 1.57 s (1.40 s–1.82 s) | 1.51 s (1.36 s–1.77 s) | 2.18 s (2.01 s–2.41 s) | 1.68 s (1.55 s–2.02 s) | 1.05 s | 1.4 KB |

##### Data layer startup (performance marks), heavy data — mid

| phase | p50 (min–max) |
| --- | --- |
| derive:sortExpenses | 2.0 ms (1.8 ms–2.0 ms) |
| derive:summary | 22.5 ms (18.3 ms–26.5 ms) |
| load:parse:settle.v3.expenses | 39.1 ms (34.4 ms–40.3 ms) |
| load:parse:settle.v3.friends | 0.1 ms (0.1 ms–0.2 ms) |
| load:parse:settle.v3.groups | 0.2 ms (0.1 ms–0.2 ms) |
| load:parse:settle.v3.profile | 0.1 ms (0.0 ms–0.1 ms) |
| load:parse:settle.v3.recurring | 0.1 ms (0.0 ms–0.1 ms) |
| load:total | 348.6 ms (284.1 ms–365.1 ms) |
| load:validate:settle.v3.expenses | 286.6 ms (228.6 ms–309.1 ms) |
| load:validate:settle.v3.friends | 6.4 ms (4.0 ms–7.0 ms) |
| load:validate:settle.v3.groups | 4.4 ms (3.8 ms–6.6 ms) |
| load:validate:settle.v3.profile | 5.8 ms (5.5 ms–6.2 ms) |
| load:validate:settle.v3.recurring | 0.9 ms (0.8 ms–2.2 ms) |

##### Screen opens (tap → content painted), heavy data — mid

| transition | p50 (min–max) | long tasks |
| --- | --- | --- |
| Home → Activity (tab) | 238 ms (228 ms–251 ms) | 213 ms |
| Activity → Expense (bill) | 152 ms (126 ms–176 ms) | 140 ms |
| Activity → Groups (tab) | 160 ms (132 ms–180 ms) | 147 ms |
| Groups → Group detail (300) | 807 ms (691 ms–831 ms) | 806 ms |
| Groups → Home (tab) | 103 ms (79 ms–116 ms) | 88 ms |
| Home → New split | 203 ms (177 ms–372 ms) | 173 ms |
| Home → Bill flow | 44 ms (38 ms–67 ms) | 0 ms |
| Home → You (tab) | 138 ms (114 ms–163 ms) | 98 ms |
| You → Home (tab) | 93 ms (75 ms–109 ms) | 81 ms |

##### Scrolling to the oldest item, heavy data — mid

| list (mode) | time to oldest | frames >16.7 ms | dropped frames | p95 frame | long tasks | stalled | DOM nodes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| activity:fling | 16.41 s (14.86 s–17.01 s) | 100 | 768 | 400 ms | 87 (12.85 s) | 600 ms | 26023 |
| activity:jump | 12.03 s (11.21 s–12.86 s) | 80 | 612 | 367 ms | 78 (10.08 s) | 10.75 s | 26023 |
| group:fling | 3.92 s (3.91 s–3.92 s) | 16 | 16 | 33 ms | 0 (0 ms) | 0 ms | 6227 |


## Fixes, one at a time

Every fix was judged by `bench/ab.mjs`: the build before and the build after, served side by side and measured **interleaved** (A B, B A, …) in one browser so machine noise hits both alike; 5 runs each, median (min–max). Both builds come from the same snapshot of the working tree with only the fix's files differing (`git show HEAD:<file>` for the "before" side). Raw runs: `bench/results/ab-*.json`.

### Fix 1 — load saved expenses without re-validating what the app wrote (7980c8d, kept)

**Why.** The warm-start trace showed zod re-validating all 1,500 stored expenses on every start: 2.5–3.1 s of main thread on the low profile, before Home could render.
**What.** `isCanonicalExpense` (src/data/schemas.ts) recognises records already in exactly the shape the schema outputs and skips zod for them; anything else still goes through the schema (repaired or dropped). A differential test proves the fast path equals the schema's output (single-field variants, 4,000 random records, everything the app saves). Also: no grapheme segmentation for text shorter than its limit, month lengths by arithmetic.
**Result** (low profile, warm repeat visit, heavy data, `ab-fix1-data-fastpath.json`):

| metric | before | after | change |
| --- | --- | --- | --- |
| data load (parse + validate) | 2.88 s | 0.81 s | −72% |
| expense validation | 2.46 s | 0.40 s | −84% |
| Home content painted | 8.87 s | 6.95 s | −22% |
| Home interactive | 9.98 s | 7.59 s | −24% |

Node micro-benchmark (`bench/micro.mjs`): validating 1,500 expenses 186 ms → 17 ms. *Caveat:* that A/B's "before" build was an earlier snapshot (`dist-baseline`, built 01:19) whose Home CSS differed slightly from 298bdd2; the clean 298bdd2 baseline above shows the same validation cost (3.08 s), so the effect size stands.

### Fix 2 — open a group with its latest 40 entries, older ones as you scroll (4674f0e, kept)

**Why.** Groups → Group detail with 300 expenses took **7.4–7.7 s** on the low profile (the slowest screen open by far). The CPU profile showed the whole timeline rendered at once: React work for 300 rows plus a forced layout of all of them (the FAB's scroll setup reads `scrollY`, which pays for laying out the full list before the first paint).
**What.** The timeline shows its newest 40 entries (by day; a day is cut short if the page ends inside it) and loads 40 more as you near the end (`LoadMore`, the IntersectionObserver pager Activity already had, now shared in src/kit with a "Show N more" button as fallback). How far each group's list had grown is remembered for the visit, so Back from an expense or a tab switch restores the same rows (and the history driver's scroll position still fits). Timeline rows are memoised. Tests: `timelineHead`/`timelineSize` (incl. agreement with a flat slice for every limit), the memory module, and a screen test (40 shown, "Show 5 more", remembered across tab switch and remount).
**Result** (`ab-fix2-group-paging.json`):

| metric | profile | before | after | change |
| --- | --- | --- | --- | --- |
| Groups → Group detail (300) | low | 7.69 s (6.24–7.77) | **1.59 s** (1.32–1.74) | **−79%** |
| Groups → Group detail (300) | mid | 783 ms (754–830) | **185 ms** (169–204) | **−76%** |
| Home → Groups (control) | low / mid | 1.30 s / 181 ms | 1.28 s / 187 ms | ±3% (noise) |
| fling to the oldest of 300 rows | low | 4.01 s | 10.86 s | +171% |
| fling to the oldest of 300 rows | mid | 3.92 s | 3.92 s | 0% (speed-limited) |

**Trade-off, stated plainly:** on the budget profile, flinging all the way to a 300-entry group's very first expense now waits for 7 pages (each a ~1 s long task there), so it takes ~7 s longer; on the mid phone it is unchanged. Opening a group happens on nearly every visit; scrolling two years down a group is rare, so the fix stays. Open issue: each page still re-renders more than its own 40 rows (profile shows `updateProperties`/`useStore` work for existing rows per page) — worth chasing next.
**Tried and dropped:** `content-visibility: auto` on day sections to make each page cheaper (`ab-fix2b-group-paging-cv.json`): open −85% as before, but the scroll was no better (4.0 → 12.6 s in that run) — no measurable gain, so it was not kept.

### Fix 3 — Activity renders only the new rows when the next page loads (e4d826a, kept)

**Why.** Reaching the oldest of 1,500 expenses took **2½ minutes** on the low profile (baseline: 141 s fling / 158 s jump; 16 s / 12 s on the mid phone). The CPU profile of that scroll (mid) put ~9 of 17 s in React re-rendering: every page of 40 rows re-rendered all the rows already on screen — date labels, money formatting and icons for up to 1,460 rows, 37 times — quadratic in the list length.
**What.** Activity's rows are memoised on their expense object (and today's date, so "Today"/"Yesterday" still roll over at midnight); a new page renders its own 40 rows. Tests: rows already shown stay unchanged as the next page loads while an edited expense still updates its row; "Today" becomes "Yesterday" after midnight.
**Result** (low profile, `ab-fix3-activity-memo-rows.json`):

| metric | before | after | change |
| --- | --- | --- | --- |
| scroll to the oldest of 1,500 (jump) | 164.9 s (136.9–175.2) | **66.1 s** (58.9–75.1) | **−60%** |
| long-task time while scrolling | 162.8 s | 64.0 s | −61% |
| p95 frame while scrolling | 5.80 s | 1.75 s | −70% |
| dropped frames | 9,765 | 3,826 | −61% |
| Home → Activity (control) | 2.61 s (1.20–3.05) | 2.90 s (1.55–2.98) | noise |
| Activity → Expense (control) | 1.92 s | 1.86 s | noise |

Still slow on a budget phone (each page is a ~1.5 s long task there): see open issues.

### Tried and dropped — skip the chip row's measurement when Activity opens on "All" (reverted)

**Why it looked promising.** On the mid phone, the Activity tab open (254 ms) spent ~90 ms inside the filter chips' layout effect (it reads `offsetLeft` to slide a remembered chip into view, forcing a layout of the whole new screen before its first paint).
**Result** (`ab-fix4-filters-no-forced-layout.json`): mid Home → Activity 232 → 218 ms (−6%, spreads overlap: 202–330 vs 171–278 ms); low 1.78 → 1.83 s (+3%). The layout simply moves to the browser's next frame — no measurable win, so the change was **reverted**. Its tests stayed (they pin the existing slide-into-view behaviour).

## Second pass (perf-2, 23 Oct 06:25–08:30): the deferred wins and the Activity open issue

Same method, tightened for a busier machine (six feature agents building and testing alongside): **7–9 interleaved runs** per A/B, and both sides built from a clean `git archive HEAD` in which only the fix's files differ (scratchpad `perf2/mkab.sh`; other agents' uncommitted work never reaches either side). Where an end-to-end number can't resolve a small change through the noise, the fix is judged by a direct measurement of the work it removes (the data layer's own marks, transferred bytes, `bench/intl.mjs`), and that is said plainly. Harness additions: `data:start` (when the data layer starts = the app's code has loaded and run), every `data:*` mark in A/B tables, `bench/intl.mjs` (first-use cost of Intl objects in a fresh browser), `bench/micro.mjs` first-call times and schema-only rows, a 60 s server start-up wait, and the heavy seed now carries the v4 fields (`language`, `travelCurrency`, `roundSize`), so it is exactly what the current app writes and takes the fast paths.

### Fix 4 — currency names built on first use, not on every start (61fa33c, kept)

**Why.** `src/lib/currencies.ts` built `Intl.DisplayNames` while the main bundle evaluated; only the currency pickers and a few labels use it.
**What.** A getter creates it the first time `currencyName()` runs (same `null` fallback; a browser that can't build it isn't asked again). Tests: not built at import, built once, fallback names.
**Result.** `bench/intl.mjs` (low profile, fresh browser per sample, 7 samples): building it *after* the Intl objects the app makes anyway (money, dates, graphemes) costs **38 ms median (6–99 ms)** of main thread — now off every start; cold, in a fresh renderer, it costs 495 ms (286–727 ms), which a currency picker now pays on first open instead. End to end (`ab-perf2-t1-lazy-currency-names*.json`, 7 cold + 9 warm runs): every row inside the spread (warm Home content 7.64 → 8.14 s, `data:start` 2.47 → 2.64 s, ranges 6.3–11.3 s) — no regression, and a 40 ms gain is below what the end-to-end runs can resolve on this machine. Kept for the measured main-thread saving. (The previous estimate of 93 ms was the profile's self time including ICU data the app loads anyway.)

### Fix 5 — the profile, friends, groups and templates load without re-checking what the app wrote (0ee5d49, kept)

**Why.** After fix 1 the expense list skipped zod for canonical records, but the four small collections still went through it on every start.
**What.** `isCanonicalProfile` / `isCanonicalFriend` / `isCanonicalGroup` / `isCanonicalRecurring` in src/data/schemas.ts recognise records already in exactly the shape their schema returns; the lists use them through `records()`, the profile through `canonicalOr()` (success, failure and output exactly the schema's). Everything else still goes through the schema. Exported schemas unchanged; src/data/store.ts needed no change. Tests (src/data/canonical.test.ts): per collection, hand-written records, every single-field variant (names, UPI IDs, phones, emoji incl. ZWJ sequences, flags, lone surrogates, members, settlements, timestamps incl. −0/NaN, trip currency, round size, periods), 2,000 random records, extra / `__proto__` / inherited keys, lists (order, repeats, bad records, owner first) and everything the app itself saves; mutation-checked.
**Result** (low profile, warm start with 2 years of data, 9 runs, `ab-perf2-t2-small-collections-fast-path.json`):

| data-layer mark | before | after | change |
| --- | --- | --- | --- |
| validate friends (60) | 46 ms (4–103) | **2 ms** (1–44) | −95% |
| validate groups (12) | 139 ms (15–696) | **30 ms** (2–76) | −78% |
| validate profile | 96 ms (5–194) | 49 ms (3–97) | −49% |
| validate recurring | 9 ms | 7 ms | (noise) |
| data layer total | 1.34 s (316 ms–1.97 s) | **1.06 s** (156 ms–1.79 s) | −21% |
| Home content painted | 11.59 s (9.63–16.27) | 9.83 s (6.76–16.53) | −15% (inside the spread) |

Node, steady state (`bench/micro.mjs`): friends 3.08 → 0.83 ms, groups 3.20 → 0.71 ms. Caveat: a profile or group saved before v4 (no `language` / `travelCurrency` / `roundSize`) still takes the schema path until the app next saves it — correct, just not faster yet.

### Fix 6 — brotli for hashed assets from the Node server (c3a13a4, kept)

**Why.** `hono/compress` sends gzip; brotli is ~13% smaller on this bundle. Cloudflare Pages compresses by itself, so this is for the Render-only deployment.
**What.** The client build writes `<file>.br` (quality 11) beside each compressible asset (`precompress()` in vite.config.ts, `node:zlib`, no new dependency; skipped for the server build and when `CF_PAGES` is set); server/web.ts serves `/assets/*` with `serveStatic({ precompressed: true })`: `Content-Encoding: br` + `Vary: Accept-Encoding` when the browser takes br, gzip on the fly otherwise. Headless Edge sends `br` to `http://127.0.0.1` too, so the bench sees it. Tests: br / gzip / identity, an asset without a copy, non-asset files, missing files.
**Result** (low profile, cold, 7 runs, `ab-perf2-t3-brotli.json`; bytes are transferred bytes until interactive):

| cold visit | JS | CSS | content painted |
| --- | --- | --- | --- |
| `/app` first visit | 240.5 → **194.1 KB** (−19%) | 33.2 → 24.9 KB (−25%) | 9.72 → 9.62 s |
| `/pay` link | 252.9 → **224.6 KB** (−11%) | 37.4 → 33.1 KB (−11%) | 13.15 → **11.74 s** (−11%) |
| `/app` with data, empty cache | 220.8 → 194.1 KB (−12%) | 28.4 → 24.9 KB (−12%) | 16.27 → 14.40 s (−12%) |

The byte savings are exact; the times come from the busiest hour of the night (absolute values ~2× the baseline run's) and their spreads overlap, but every content/FCP/LCP median moved the right way.

### Fix 7 — a link page preloads its own code with the page (6b16182, kept)

**Why.** `/pay`, `/claim` and `/pool` pages are lazy chunks: the browser only learned about them after the main bundle had downloaded and run, one more round trip on a 150 ms-RTT phone.
**What.** The client build writes its manifest (`build.manifest`); server/web.ts adds `<link rel="modulepreload">` for that route's chunk and its imports when it serves a link page.
**Result** (low profile, cold, 7 runs, `ab-perf2-t4-link-page-preload.json`):

| cold visit | first paint | content painted | bytes |
| --- | --- | --- | --- |
| `/pay` link | 13.23 → **11.97 s** (−10%) | 15.15 → **13.21 s** (−13%) | 327 → 327 KB (same files, earlier) |
| `/app` (control, no preload) | 10.45 → 9.77 s | 10.48 → 9.78 s | 302 → 304 KB |

The control moved too (machine noise), so read the `/pay` win as ~10%, not 13%.

### Fix 8 — Activity's "Show more" pages join without the entrance animation, and only the month they land in re-renders (kept)

**Why.** Every page of 40 rows started 40 entrance animations at once, and every page re-rendered every month section already on screen — a ~1.5 s long task per page on the budget phone (open issue from the first pass).
**What.** `MonthList` is memoised on its rows (`shallowArrayEqual`), and once a second page is in, rows join with `animation: none` (`.calm`). `ExpenseRow` now subscribes to the other side of a 1:1 entry, so a memoised row still follows a rename (test added).
**Result** (low profile, 1,500 expenses, scroll Activity to the oldest entry, 7 runs, `ab-perf2-t5-activity-calm-rows.json`):

| | before | after | change |
| --- | --- | --- | --- |
| time to oldest entry | 78.0 s | **59.1 s** | −24% |
| long-task time | 75.4 s | **56.2 s** | −26% |
| stalled time | 72.3 s | 56.3 s | −22% |
| p95 frame | 2.23 s | 2.28 s | (same) |

Pages still cost a long task each on a budget phone; list virtualisation is the next step (open).

## Third pass (24 Oct, perf-3): Activity's fling, and the first-paint budget

Same method: measure, fix, interleaved A/B (`bench/ab.mjs`, low profile), keep only measured wins. Both sides are clean `git archive` trees (`scratchpad` tools `buildrev.sh` / `buildwith.sh`), so other agents' work-in-progress never enters a measurement.

### Activity with 1,500 expenses: the windowed list, measured both ways

The windowing itself landed earlier tonight (8e9871d, see the note there). Its A/B is `bench/results/ab-perf3-t1-activity-window.json` (7 runs, jump to the oldest row): time to the oldest 43.6 s → 1.6 s, long-task time 41.7 s → 1.6 s, DOM 26,081 → 611 elements.

The jump is not what a user does. **Fling** (10,000 px/s, the scroll a user actually makes) is the number to compare with the 59 s in the task. `bench/results/ab-perf3-t1b-activity-window-fling.json`, low profile, 5 runs, medians (min–max):

| metric (Activity, 1,500 expenses) | before (the paged list, the build before 8e9871d) | after (8e9871d) | change |
| --- | --- | --- | --- |
| time to the oldest row | 58.13 s (40.86–59.25 s) | 14.87 s (14.03–15.33 s) | −74% |
| long-task time while scrolling | 55.02 s | 14.46 s | −74% |
| long frames / dropped frames | 95 / 3,368 | 22 / 872 | −77% / −74% |
| stalled at the bottom | 2.30 s | 0 ms | −100% |
| DOM elements | 26,081 | 611–1,005 | −96% |
| JS heap after GC | 19.6 MB | 6.2 MB | −68% |

Mid profile (no throttling), same runs: time to the oldest 14.05 s both sides (it is the scroll distance: ~140,000 px at 10,000 px/s), long frames 9 → 0, DOM 26,081 → 823, heap 19.7 → 6.6 MB. So on a phone without a CPU throttle the list no longer janks; the remaining 14.9 s on the budget profile is frame time.

**Where the remaining fling time goes** (low profile, `node bench/profile.mjs --scenario scroll:activity:fling --trace`, source positions mapped by hand): 22 frames of ~650 ms each carry the 14.5 s. In the trace, 1,881 forced style-and-layout calls cost 6.5 s, of which only 16 are full layouts (3.7 s). About 560 of the forced calls (6.2 s) sit under React's scheduler and commit, and 1,150 (0.25 s) under the layout-effect height read in `MonthList`. The cost tracks mounting rows (each row mounted once while the fling passes it), not the number of window moves.

Two changes were tried and reverted, with one trace each (not an A/B, so not kept): (1) asking for a window check only when a commit measured a new height or changed rows: 1,808 forced calls, 14.6 s, no change; (2) a wider window (two screens either way, hysteresis three): 1,567 forced calls, 16.2 s, no gain. The next step is to find what in React's commit forces the style recalculation (candidates: selection and focus restore around commits; per-row `ExpenseRow` markup, 20 or so elements per row) before changing the list again.

### First-paint JavaScript against tonight's start (`bench/firstpaint.mjs`, `bench/results/firstpaint-24oct-0630.json`)

What the HTML shell loads before first paint (entry plus its static imports and modulepreloads, CSS included), brotli bytes, from production builds:

| build | `/app` JS | `/app` CSS | `/app` files | `/pay` JS (+ link preloads) | `/pay` CSS | `/pay` files |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `6acbb80` — tonight's start | 185.35 KB | 23.25 KB | 27 | 198.02 KB | 26.11 KB | 42 |
| `963e285` — the commit before the i18n work (no code change from `6acbb80`) | 185.35 KB | 23.25 KB | 27 | 198.02 KB | 26.11 KB | 42 |
| `4c6eaa7` — HEAD at 06:25 | 200.89 KB | 24.18 KB | 36 | 213.21 KB | 27.04 KB | 51 |
| delta vs tonight's start | **+15.5 KB** | +0.9 KB | +9 | **+15.2 KB** | +0.9 KB | +9 |

**The i18n budget (+3 KB brotli on first paint) is exceeded by about 12.5 KB** on both `/app` and `/pay`. Where it comes from (names from the build manifest): a shared `people` chunk that now holds React's runtime and is statically imported by the entry (30.1 KB brotli, absent from tonight's start's shell); `index-a` (8.2 KB, new in the shell); `router` and `format`/`amountWords`/`FriendAvatar` (about 2 KB together); `schemas` grew by 2 KB; and `rolldown-runtime` split out. The old `runtime` chunk (13.1 KB) is gone into `index`. The main chunk shrank by about 8 KB, so the module graph moved more than it grew. Reported to `i18n-core` as a Needs item (a chunking change to keep the shared runtime with the entry, or to make the catalog-bearing modules lazy).

Also on the first-paint path: zod. `schemas-DDhCsTSD.js` (the zod runtime, 7.9 KB brotli) and the app's own schema module (10.6 KB brotli) are in every shell. Taking zod off first paint needs the schema modules loaded lazily, which the data layer's synchronous load does not allow yet (open).

### Warm Home with 2 years of data: what the cold profile shows (and one dropped change)

`bench/profile.mjs --scenario cold --data heavy --sourcemap`-style build of HEAD 68409f4 (`--dist` on a source-mapped build; profile in the cache, not committed): of ~6 s of script work on low, the largest self-time items are (a) the **English catalogs**: the chunk named `people` is an eager shared chunk that holds React and every `src/i18n/en/*` namespace (33 files, 43.7 KB brotli in total) plus the i18n runtime. Its top-level evaluation (where the catalogs are built; not split further) is ~0.73 s self on low. (b) `JSON.parse` of the 1.1 MB expense blob (`load:parse`, ~0.2–0.3 s; deferred win 3). (c) `isCanonicalExpense` and the canonical helpers (~0.4 s cold, JIT not warm yet). (d) `balances`/`derive:summary` (~0.2 s). All 1,500 seeded expenses and every friend, group and template pass the canonical fast path (checked on the seed), so the fast path that deferred win 2 asked for is already in place (fix 5, 0ee5d49).

Dropped (A/B measured, 7 runs, low, warm Home, heavy data, `bench/results/ab-zod-list.json`): `records()` checking the list with `z.custom(Array.isArray)` instead of `z.array(z.unknown())`. Each stored-list parse fell from one zod pass over 1,500 items (about 0.7 ms warm in Node, but about 450 ms cold on the budget profile, per the trace) to a plain check. The A/B did not show it: `data:load:validate:settle.v3.expenses` 427 ms → 491 ms, `data:load:total` 691 ms → 795 ms, interactive 8.03 s → 8.68 s (noise is large: the B spread reaches 16 s while other agents ran builds on the same 8 cores). Reverted; the cold profile's zod time must come from somewhere else in the first-run JIT path, not from the list wrapper. Not kept.

Second checkpoint (07:15) is in the section below.

## Deferred wins (files the perf agent doesn't own — ready for the lead to apply)

Each is measured the same way as the fixes above: build before/after into `node_modules/.cache/settle-bench/dist-*` and run `node bench/ab.mjs --a <before> --b <after> …` (interleaved, 5 runs, medians). Numbers below come from the low-profile CPU profile / trace of a cold start with heavy data (`node bench/profile.mjs --sourcemap --scenario cold --data heavy --trace`), so "expected" = self time that goes away, not yet an A/B result.

1. **`src/lib/currencies.ts` — build `Intl.DisplayNames` on first use, not at import.**
   `const displayNames = (() => new Intl.DisplayNames(undefined, { type: 'currency' }))()` runs while the eager bundle evaluates, on every start, although only the currency pickers and a few labels call `currencyName()`. It costs **93 ms of main thread on the low profile** (largest single function after the data layer in the cold-start profile). Change: `let displayNames: Intl.DisplayNames | null | undefined` and a `currencyNames()` getter that creates it once (same try/catch → null fallback); `currencyName()` calls the getter. Expected: −80–90 ms on cold and warm start (low), ~−20 ms (mid). Measure: `bench/ab.mjs --only cold,warm --profile low`.

2. **`src/data/schemas.ts` + `src/data/store.ts` — the canonical fast path for the small collections too.**
   After 7980c8d the expense list skips zod when records are already canonical, but friends, groups, profile and recurring still go through `z.safeParse` on every start: 67 + 48 + 48 + 11 ms ≈ **175 ms on the low profile** (warm data marks, baseline table) — and more since the new group fields landed (final run: groups 159 ms). Same pattern as `isCanonicalExpense` (exact-shape checks, differential test against the schema over single-field variants and random records). Expected −150 ms warm start (low). Measure: the `data:load:validate:*` marks in `bench/run.mjs --only warm`.

3. **`src/data/store.ts` — parse the 1.1 MB expense blob off the critical path.**
   `JSON.parse` of the stored expenses is 190–200 ms on the low profile (`load:parse:settle.v3.expenses`) and blocks Home's first render. Options, in order of effort: (a) render Home from a small derived snapshot written beside the list (`settle.v3.home` — balance, recent 5 rows) and load the full list in an idle callback; (b) split storage per year so the first screen parses only the newest chunk. Expected up to −200 ms warm Home content (low); (a) also removes most of `derive:summary` (≈150 ms) from first paint.

4. **`server/web.ts` — serve pre-compressed brotli.** `hono/compress` sends gzip. What the shell loads up front is 175.4 KB gzip vs 153.2 KB brotli for JS and 25.6 vs 22.3 KB for CSS (bundle report) — 25 KB less on every first visit, ≈130 ms at 1.6 Mbps. Change: emit `.br` files at build (a tiny `closeBundle` step using `zlib.brotliCompressSync`, quality 11 — dev-time only, no new dependency) and, for `/assets/*`, answer `Accept-Encoding: br` with the `.br` file, `Content-Encoding: br` and `Vary: Accept-Encoding`. Cloudflare Pages already does this itself, so it matters for the Render-only deployment. Measure: `bench/run.mjs --only cold` (the throttled proxy counts transferred bytes).

5. **`/pay` cold visit — start the pay screen's code with the HTML.** The pay page's own chunk and CSS (`PayPage-*.js` + `.css`, 15.8 KB + 9.0 KB raw) are discovered only after the 317 KB entry chunk has downloaded and run, a full extra round trip on 3G (150 ms RTT × slow start) before the friend sees their name. Change (server/web.ts + `build.manifest: true` in vite.config.ts, which the perf agent can add on request): for `GET /pay`, add `Link: </assets/PayPage-….js>; rel=modulepreload, </assets/PayPage-….css>; rel=preload; as=style` from `dist/client/.vite/manifest.json` (and `103 Early Hints` where the host supports it — Cloudflare does). Expected −300–600 ms `/pay` content on the low profile. Measure: `bench/ab.mjs --only cold --data empty --profile low` (the `cold /pay` rows).

6. **`src/features/split/NewSplitScreen.tsx` / `src/features/expense/*` — the two slowest screen opens left.** After the fixes above, Home → New split (≈1.8 s low) and Activity → Expense (bill) (≈1.3 s low) are the slowest taps. Not profiled to a patch yet — next step: `node bench/profile.mjs --sourcemap --scenario "tap:Home → New split"`.

## Open issues (measured, not yet fixed)

1. **Loading older rows is still a long task per page on a budget phone.** After fix 3, reaching the oldest of 1,500 Activity rows takes ~1 minute on the low profile (each page of 40 is a ~1.5 s long task there), and after fix 2 the 300-entry group needs ~11 s. The profile of a group page still shows React updating props of rows already on screen (`updateProperties`, `useStore`, `cx`) — something above the memoised rows changes per page. Next: find that prop (likely the `List`/`Card` wrapper of the last, partially shown day/month) and try larger pages deeper in the list; `content-visibility` on day sections did not help (fix 2).
2. **Text layout on cold start.** In the low-profile cold traces, one layout pass took 0.85 s (welcome slides) to 2.7 s (Home with data), 0.5–1.5 s of it text shaping, for a DOM of only ~380 elements. It may be first-use font fallback in a fresh headless-Edge renderer on Windows rather than something a phone pays; verify on a real Android device (Chrome remote debugging) before touching fonts (variable Geist vs static weights would need a new dependency).
3. **The data layer and the pay link** — see Deferred wins (1–5).
4. **The final build includes the foundations agent's work since 298bdd2** (loans, trip currency, fees, link signing): the up-front `data` chunk grew 37.2 → 50.1 KB raw (+12.9 KB; +15 KB up-front JS in all), which the cold-start rows of the summary absorb.

## Final full run — e4d826a (`bench/run.mjs`, `results/final-e4d826a.json`) vs the baseline run

`node bench/compare.mjs bench/results/baseline-298bdd2.json bench/results/final-e4d826a.json`. **Read with care:** these two full runs were *not* interleaved and the machine was shared (other agents' builds and tests; the A/B runs above), so rows a fix didn't touch drift with load — e.g. every mid-phone screen open looks 15–35% faster and several low-profile ones 45–90% slower, which no change explains. Trust a row here only when it agrees with an interleaved A/B (the summary at the top). Rows that do agree: Group detail −70% (low) / −82% (mid); Activity scroll to the oldest −61% (fling) / −67% (jump) on low, long tasks −78% and p95 frame 400 → 67 ms on mid; data layer −63% / −68%; group fling scroll slower on low (the stated trade-off).

#### Budget Android (low: CPU 4×, 1.6 Mbps, 150 ms RTT)

| | metric | before | after | change |
| --- | --- | --- | --- | --- |
| Cold first visit | /app (first visit): first paint | 5.16 s | 5.60 s | +8% |
|  | /app (first visit): interactive | 5.13 s | 6.47 s | +26% |
|  | /app (first visit): JS transferred | 186.4 KB | 191.2 KB | +3% |
|  | /pay link: first paint | 5.94 s | 5.79 s | -3% |
|  | /pay link: content (who's asking + names) | 7.18 s | 6.67 s | -7% |
|  | /pay link: interactive | 7.18 s | 7.08 s | -1% |
|  | /app with 2 years of data: Home interactive | 11.54 s | 8.72 s | -24% |
| Warm repeat visit (heavy) | Home content painted | 9.68 s | 8.99 s | -7% |
|  | Home interactive | 11.01 s | 10.26 s | -7% |
|  | Balance finished counting | 11.12 s | 11.91 s | +7% |
|  | Data layer load (parse + validate) | 3.51 s | 1.29 s | -63% |
| Screen opens (heavy) | Home → Activity | 2.12 s | 3.11 s | +47% |
|  | Activity → Expense (bill) | 1.33 s | 2.13 s | +61% |
|  | Activity → Groups | 1.19 s | 2.30 s | +93% |
|  | Groups → Group detail (300 expenses) | 7.43 s | 2.23 s | -70% |
|  | Groups → Home | 645 ms | 700 ms | +9% |
|  | Home → New split | 1.82 s | 2.63 s | +45% |
|  | Home → Bill flow | 364 ms | 388 ms | +7% |
|  | Home → You | 883 ms | 1.01 s | +15% |
|  | You → Home | 696 ms | 1.17 s | +68% |
| Scrolling to the oldest row | Activity (1,500), fling: time to oldest | 141.09 s | 54.47 s | -61% |
|  | Activity (1,500), fling: long-task time | 138.76 s | 52.20 s | -62% |
|  | Activity (1,500), fling: p95 frame | 4.75 s | 1.33 s | -72% |
|  | Activity (1,500), jump: time to oldest | 158.49 s | 51.97 s | -67% |
|  | Group (300), fling: time to oldest | 4.03 s | 8.56 s | +112% |
|  | Group (300), fling: long-task time | 3.36 s | 7.71 s | +130% |
|  | Group (300), fling: p95 frame | 317 ms | 1.05 s | +232% |

#### Mid phone (no throttling)

| | metric | before | after | change |
| --- | --- | --- | --- | --- |
| Cold first visit | /app (first visit): first paint | 972 ms | 652 ms | -33% |
|  | /app (first visit): interactive | 935 ms | 626 ms | -33% |
|  | /app (first visit): JS transferred | 186.4 KB | 191.2 KB | +3% |
|  | /pay link: first paint | 1.24 s | 1.00 s | -19% |
|  | /pay link: content (who's asking + names) | 1.32 s | 1.03 s | -22% |
|  | /pay link: interactive | 1.32 s | 1.03 s | -22% |
|  | /app with 2 years of data: Home interactive | 1.81 s | 1.12 s | -38% |
| Warm repeat visit (heavy) | Home content painted | 1.51 s | 1.06 s | -30% |
|  | Home interactive | 1.68 s | 1.24 s | -26% |
|  | Balance finished counting | 2.18 s | 1.70 s | -22% |
|  | Data layer load (parse + validate) | 349 ms | 111 ms | -68% |
| Screen opens (heavy) | Home → Activity | 238 ms | 183 ms | -23% |
|  | Activity → Expense (bill) | 152 ms | 127 ms | -16% |
|  | Activity → Groups | 160 ms | 131 ms | -18% |
|  | Groups → Group detail (300 expenses) | 807 ms | 146 ms | -82% |
|  | Groups → Home | 103 ms | 67 ms | -35% |
|  | Home → New split | 203 ms | 188 ms | -7% |
|  | Home → Bill flow | 44 ms | 37 ms | -15% |
|  | Home → You | 138 ms | 109 ms | -21% |
|  | You → Home | 93 ms | 67 ms | -29% |
| Scrolling to the oldest row | Activity (1,500), fling: time to oldest | 16.41 s | 14.05 s | -14% |
|  | Activity (1,500), fling: long-task time | 12.85 s | 2.83 s | -78% |
|  | Activity (1,500), fling: p95 frame | 400 ms | 67 ms | -83% |
|  | Activity (1,500), jump: time to oldest | 12.03 s | 5.77 s | -52% |
|  | Group (300), fling: time to oldest | 3.92 s | 3.92 s | +0% |
|  | Group (300), fling: long-task time | 0 ms | 471 ms | — |
|  | Group (300), fling: p95 frame | 33 ms | 33 ms | +0% |

### Final run, every metric

##### Bundle (54 JS + 30 CSS files, 11 fonts)

Up front in the HTML shell: JS 547.1 KB raw / 180.2 KB gzip / 157.3 KB br; CSS 132.0 KB raw / 25.6 KB gzip / 22.3 KB br
All: JS 941.0 KB raw / 330.0 KB gzip; CSS 268.8 KB raw / 63.0 KB gzip; fonts 143.4 KB

##### Largest files

| file | raw | gzip | brotli |
| --- | --- | --- | --- |
| /assets/index-CNfCo_Jh.js | 317.8 KB | 101.4 KB | 87.8 KB |
| /assets/router-DFh9eard.js | 122.5 KB | 41.1 KB | 35.8 KB |
| /assets/router-CU04_HZP.css | 80.3 KB | 15.0 KB | 13.0 KB |
| /assets/BillFlow-DXsnhSCc.js | 66.9 KB | 22.4 KB | 20.0 KB |
| /assets/index-b-_MvZWDu6.js | 55.4 KB | 20.9 KB | 18.5 KB |
| /assets/index-DrczD3L9.css | 51.7 KB | 10.6 KB | 9.4 KB |
| /assets/data-f6K-Mb8S.js | 49.0 KB | 16.7 KB | 14.8 KB |
| /assets/LandingPage-vYZ4Ls4C.js | 35.5 KB | 11.5 KB | 10.1 KB |
| /assets/categories-Dp9zjVny.js | 31.8 KB | 10.4 KB | 9.3 KB |
| /assets/geist-latin-wght-normal-BgDaEnEv.woff2 | 28.7 KB | 28.7 KB | 28.7 KB |
| /assets/LandingPage-Bh7VY-4b.css | 27.3 KB | 5.8 KB | 5.1 KB |
| /assets/YouScreen-D93CnwwD.js | 24.5 KB | 8.7 KB | 7.8 KB |
| /assets/geist-mono-latin-wght-normal-XN7g48iV.woff2 | 22.6 KB | 22.6 KB | 22.6 KB |
| /assets/BillFlow-DuDyBDlO.css | 20.5 KB | 4.4 KB | 3.9 KB |
| /assets/NewSplitScreen-DO-5vszH.js | 18.2 KB | 7.0 KB | 6.3 KB |

#### Profile: low (CPU 4× slower, 1.6 Mbps / 150 ms RTT)

##### Cold first visit — low

| page | TTFB | FCP | LCP | content | interactive | TBT | JS | CSS | fonts | requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app (empty) | 479 ms (478 ms–485 ms) | 5.60 s (3.18 s–6.52 s) | 6.22 s (3.82 s–6.72 s) | 5.59 s (3.14 s–6.06 s) | 6.47 s (4.13 s–6.87 s) | 3.39 s | 191.2 KB | 28.4 KB | 30.0 KB | 31 |
| pay link | 482 ms (478 ms–482 ms) | 5.79 s (5.33 s–6.44 s) | 6.26 s (5.33 s–7.19 s) | 6.67 s (6.48 s–7.10 s) | 7.08 s (6.52 s–7.10 s) | 3.61 s | 211.8 KB | 34.1 KB | 30.0 KB | 22 |
| app (heavy) | 483 ms (471 ms–497 ms) | 8.28 s (7.75 s–12.47 s) | 8.58 s (8.07 s–14.92 s) | 8.31 s (7.81 s–12.75 s) | 8.72 s (8.31 s–15.55 s) | 6.02 s | 191.2 KB | 28.4 KB | 47.3 KB | 15 |

##### Warm repeat visit, heavy data — low

| TTFB | FCP | Home content | balance final | interactive | TBT | network |
| --- | --- | --- | --- | --- | --- | --- |
| 198 ms (194 ms–206 ms) | 8.72 s (7.11 s–11.04 s) | 8.99 s (7.35 s–11.34 s) | 11.91 s (10.44 s–14.10 s) | 10.26 s (7.35 s–11.39 s) | 9.13 s | 1.4 KB |

##### Data layer startup (performance marks), heavy data — low

| phase | p50 (min–max) |
| --- | --- |
| derive:sortExpenses | 9.0 ms (6.6 ms–26.1 ms) |
| derive:summary | 226.7 ms (127.0 ms–331.0 ms) |
| load:parse:settle.v3.expenses | 202.8 ms (178.3 ms–433.8 ms) |
| load:parse:settle.v3.friends | 1.2 ms (1.0 ms–7.4 ms) |
| load:parse:settle.v3.groups | 1.0 ms (0.2 ms–3.0 ms) |
| load:parse:settle.v3.profile | 0.5 ms (0.4 ms–2.4 ms) |
| load:parse:settle.v3.recurring | 0.5 ms (0.4 ms–1.3 ms) |
| load:total | 1286.6 ms (698.9 ms–1982.3 ms) |
| load:validate:settle.v3.expenses | 824.3 ms (291.3 ms–1106.2 ms) |
| load:validate:settle.v3.friends | 43.9 ms (37.1 ms–102.3 ms) |
| load:validate:settle.v3.groups | 158.9 ms (75.4 ms–248.1 ms) |
| load:validate:settle.v3.profile | 70.5 ms (51.0 ms–133.2 ms) |
| load:validate:settle.v3.recurring | 12.8 ms (7.0 ms–42.0 ms) |

##### Screen opens (tap → content painted), heavy data — low

| transition | p50 (min–max) | long tasks |
| --- | --- | --- |
| Home → Activity (tab) | 3.11 s (1.78 s–4.08 s) | 3.09 s |
| Activity → Expense (bill) | 2.13 s (1.26 s–2.77 s) | 2.13 s |
| Activity → Groups (tab) | 2.30 s (996 ms–2.40 s) | 2.28 s |
| Groups → Group detail (300) | 2.23 s (1.73 s–3.35 s) | 2.24 s |
| Groups → Home (tab) | 700 ms (596 ms–1.42 s) | 697 ms |
| Home → New split | 2.63 s (1.94 s–3.83 s) | 2.60 s |
| Home → Bill flow | 388 ms (131 ms–750 ms) | 360 ms |
| Home → You (tab) | 1.01 s (766 ms–2.13 s) | 997 ms |
| You → Home (tab) | 1.17 s (667 ms–1.48 s) | 1.16 s |

##### Scrolling to the oldest item, heavy data — low

| list (mode) | time to oldest | frames >16.7 ms | dropped frames | p95 frame | long tasks | stalled | DOM nodes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| activity:fling | 54.47 s (53.21 s–62.14 s) | 115 | 3145 | 1.33 s | 127 (52.20 s) | 9.25 s | 26023 |
| activity:jump | 51.97 s (49.04 s–54.75 s) | 128 | 2983 | 1.23 s | 138 (50.34 s) | 48.26 s | 26023 |
| group:fling | 8.56 s (7.56 s–9.75 s) | 28 | 478 | 1.05 s | 24 (7.71 s) | 867 ms | 6227 |

#### Profile: mid (no CPU throttling, no network throttling)

##### Cold first visit — mid

| page | TTFB | FCP | LCP | content | interactive | TBT | JS | CSS | fonts | requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| app (empty) | 10 ms (9 ms–13 ms) | 652 ms (632 ms–692 ms) | 752 ms (716 ms–792 ms) | 626 ms (602 ms–667 ms) | 626 ms (602 ms–667 ms) | 250 ms | 191.2 KB | 28.4 KB | 30.0 KB | 14 |
| pay link | 9 ms (8 ms–10 ms) | 1.00 s (944 ms–1.05 s) | 1.00 s (944 ms–1.05 s) | 1.03 s (972 ms–1.08 s) | 1.03 s (972 ms–1.08 s) | 275 ms | 211.8 KB | 34.1 KB | 0.0 KB | 22 |
| app (heavy) | 11 ms (8 ms–13 ms) | 1.04 s (972 ms–1.09 s) | 1.10 s (1.06 s–1.16 s) | 982 ms (925 ms–1.04 s) | 1.12 s (1.05 s–1.27 s) | 645 ms | 191.2 KB | 28.4 KB | 47.3 KB | 15 |

##### Warm repeat visit, heavy data — mid

| TTFB | FCP | Home content | balance final | interactive | TBT | network |
| --- | --- | --- | --- | --- | --- | --- |
| 44 ms (40 ms–70 ms) | 1.11 s (1.02 s–1.31 s) | 1.06 s (969 ms–1.25 s) | 1.70 s (1.61 s–1.90 s) | 1.24 s (1.10 s–1.40 s) | 696 ms | 1.4 KB |

##### Data layer startup (performance marks), heavy data — mid

| phase | p50 (min–max) |
| --- | --- |
| derive:sortExpenses | 2.2 ms (2.0 ms–5.3 ms) |
| derive:summary | 20.2 ms (17.7 ms–23.7 ms) |
| load:parse:settle.v3.expenses | 31.0 ms (27.8 ms–34.3 ms) |
| load:parse:settle.v3.friends | 0.2 ms (0.1 ms–0.2 ms) |
| load:parse:settle.v3.groups | 0.2 ms (0.1 ms–0.2 ms) |
| load:parse:settle.v3.profile | 0.1 ms (0.0 ms–0.2 ms) |
| load:parse:settle.v3.recurring | 0.1 ms (0.0 ms–0.2 ms) |
| load:total | 111.3 ms (102.3 ms–119.0 ms) |
| load:validate:settle.v3.expenses | 56.2 ms (49.3 ms–61.9 ms) |
| load:validate:settle.v3.friends | 4.1 ms (2.2 ms–4.8 ms) |
| load:validate:settle.v3.groups | 9.5 ms (8.8 ms–10.1 ms) |
| load:validate:settle.v3.profile | 9.4 ms (7.6 ms–10.5 ms) |
| load:validate:settle.v3.recurring | 1.4 ms (1.3 ms–2.7 ms) |

##### Screen opens (tap → content painted), heavy data — mid

| transition | p50 (min–max) | long tasks |
| --- | --- | --- |
| Home → Activity (tab) | 183 ms (137 ms–199 ms) | 164 ms |
| Activity → Expense (bill) | 127 ms (108 ms–136 ms) | 115 ms |
| Activity → Groups (tab) | 131 ms (105 ms–134 ms) | 122 ms |
| Groups → Group detail (300) | 146 ms (123 ms–156 ms) | 127 ms |
| Groups → Home (tab) | 67 ms (55 ms–82 ms) | 59 ms |
| Home → New split | 188 ms (143 ms–207 ms) | 164 ms |
| Home → Bill flow | 37 ms (33 ms–39 ms) | 0 ms |
| Home → You (tab) | 109 ms (96 ms–130 ms) | 85 ms |
| You → Home (tab) | 67 ms (62 ms–69 ms) | 55 ms |

##### Scrolling to the oldest item, heavy data — mid

| list (mode) | time to oldest | frames >16.7 ms | dropped frames | p95 frame | long tasks | stalled | DOM nodes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| activity:fling | 14.05 s (14.05 s–14.05 s) | 129 | 256 | 67 ms | 36 (2.83 s) | 0 ms | 26023 |
| activity:jump | 5.77 s (4.95 s–6.15 s) | 79 | 240 | 117 ms | 37 (3.00 s) | 4.68 s | 26023 |
| group:fling | 3.92 s (3.91 s–3.92 s) | 14 | 34 | 33 ms | 7 (471 ms) | 0 ms | 6227 |

