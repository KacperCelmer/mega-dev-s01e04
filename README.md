# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

## Morning digest

Open `/digest/2026-10-28` for the HTML digest or `/api/digest/2026-10-28` for the same
rows as JSON. The status board links every night and shows event totals. Bad log lines
are counted; missing owners remain visible. Logged times keep their original offsets.

## Review copy

With `pnpm start` running on localhost and `LANE_MARKER` set in the ignored `.env`, run
`pnpm preview:export` in another terminal. It saves the service's response as one HTML
file at `../preview/index.html`, outside this repo. An optional argument changes the
output path; `RIG_URL` changes the localhost address if a different port is in use.

Upload that file only after human approval. Once review is in, unset `LANE_MARKER`,
restart the service, export again, and obtain separate approval to replace the same
public URL. The replacement banner reads `no marker set`. Never commit `.env` or HTML
review copies. See ADR 0003.
