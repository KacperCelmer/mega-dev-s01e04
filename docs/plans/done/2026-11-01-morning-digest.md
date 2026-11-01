---
plan: morning-digest
status: done
owner: rook
opened: 2026-10-29
closed: 2026-11-01
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link and plan issues have been sent, and the reviewer has confirmed
they looked at the preview. Keep the preview issue open while review is pending.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Issues

| # | Issue | Blocked by | Worker | Closed |
|---|-------|-----------|--------|--------|
| 1 | [Read and aggregate the night run log](https://github.com/KacperCelmer/mega-dev-s01e04/issues/1) | — | codex · gpt-6-astra · high | 2026-11-01 |
| 2 | [Render the digest HTML page](https://github.com/KacperCelmer/mega-dev-s01e04/issues/2) | #1 types commit | codex · gpt-6-luna · medium | 2026-11-01 |
| 3 | [Expose the same digest rows as JSON](https://github.com/KacperCelmer/mega-dev-s01e04/issues/3) | #1 types commit | codex · gpt-6-luna · medium | 2026-11-01 |
| 4 | [Link nights and show status counts on the board](https://github.com/KacperCelmer/mega-dev-s01e04/issues/4) | #1 types commit | codex · gpt-6-luna · medium | 2026-11-01 |
| 5 | [Test digest HTML and JSON route states](https://github.com/KacperCelmer/mega-dev-s01e04/issues/5) | #1 types commit; route implementations for verification | codex · gpt-6-luna · medium | 2026-11-01 |
| 6 | [Export the digest and submit its public preview for review](https://github.com/KacperCelmer/mega-dev-s01e04/issues/6) | #1–#5; reviewer confirmation | codex · GPT-6 session variant not exposed · inherited | 2026-11-01 |
| 7 | [Remove the public marker after review and archive the plan](https://github.com/KacperCelmer/mega-dev-s01e04/issues/7) | #6; review received; separate upload approval | codex · GPT-6 session variant not exposed · inherited | 2026-11-01 |

## Verification and review

- `pnpm test`: 14 tests passed. `pnpm typecheck`: passed.
- Both fixture nights link to working digests; the HTML and JSON use the same sorted reader result.
- The 2026-10-28 fixture has 5 jobs, 1 bad line, and 10 ok / 4 retry / 1 fail events.
- Desktop and mobile UI checks passed; source fixtures stayed unchanged.
- The reviewer confirmed they saw the preview before the final closure of #6.
- With separate human approval, the page was exported again with `LANE_MARKER` unset and replaced at https://mega-dev-s01e04-preview.pages.dev/. The public banner reads `no marker set`.
- The HTML copy and `.env` remain outside tracked source.

Review correction: #6 was first closed on submission, which the course rejected because the reviewer had not looked. It was reopened, and section 3 and its issue were corrected to require the review before closure.
