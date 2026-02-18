# Private Chess Desktop

Private 1v1 chess desktop app (Electron + React) with authoritative online multiplayer server (Node + Socket.IO + chess.js).

## Monorepo structure

```
/apps/client      Electron + Vite + React + TypeScript desktop app
/apps/server      Node + TypeScript + Socket.IO authoritative server
/packages/shared  Shared zod schemas + typed event contracts
/assets/sounds    Sound assets (CC0) used by client
```

## Requirements

- Node.js 20+
- pnpm 9+

If `pnpm` is not in PATH on Windows, use `corepack pnpm ...` equivalents.

## Install

```bash
pnpm install
```

## Development

- Full stack:

```bash
pnpm dev
```

- Server only:

```bash
pnpm --filter server dev
```

- Client only:

```bash
pnpm --filter client dev
```

## Test

```bash
pnpm test
```

Includes:
- shared schema validation tests
- server legality/turn/checkmate tests
- client move formatting tests

## Build

```bash
pnpm build
```

This runs:
- shared build
- server build
- client renderer build + electron build + installer packaging

Installer outputs:
- Windows: `apps/client/release/*.exe` (NSIS)
- macOS: `apps/client/release/*.dmg`

Note: build each OS installer on that OS for best results.

## Mac download link via GitHub Actions

If you are on Windows and need a macOS installer link:

1. Push this repo to GitHub.
2. A new push to `main` now auto-builds a fresh mac release.
3. You can also run manually in GitHub -> `Actions` -> `macOS Release` -> `Run workflow`.
4. After success, open the created GitHub `Release` and copy the `.dmg` or `.zip` URL.
5. `SHA256SUMS.txt` is included in the release to verify download integrity.

That release asset link is what you send to Mac users.

## Local LAN setup

1. Start server:
```bash
pnpm --filter server dev
```
2. Server host machine IP example: `192.168.1.20`.
3. On each desktop app, set runtime Server URL to:
`http://192.168.1.20:3001`
4. Create room on one machine, copy invite link/room code, join from second machine.

## Internet setup (Fly.io primary)

### 1) Prepare Fly app

1. Install `flyctl`.
2. Login:
```bash
fly auth login
```
3. Edit `fly.toml` app name (`app = "private-chess-server"` -> unique name).
4. Set client URL for invite links:
```bash
fly secrets set INVITE_BASE_URL="https://your-client-download-page-or-site.example.com"
```

### 2) Deploy server

```bash
fly deploy
```

### 3) Verify health + websocket endpoint availability

```bash
fly status
curl https://<your-fly-app>.fly.dev/health
```

`/health` must return `ok`.

### 4) Configure desktop clients

1. Open app on each machine.
2. Click `Server URL`.
3. Set:
`https://<your-fly-app>.fly.dev`
4. Save.

### 5) Installers for two machines

1. Build:
```bash
pnpm build
```
2. Install generated installer on both machines.
3. Create room on machine A, send invite link to machine B, join.

## Alternative deploy targets

- Render: `render.yaml` included (Docker deploy with `/health` check).
- Railway: `railway.json` included (Dockerfile deploy + health check).

## Runtime and build-time client server URL options

- Build-time default: set `VITE_DEFAULT_SERVER_URL` before client build.
- Runtime override: in-app `Server URL` modal (stored in localStorage).

## Server environment variables

- `PORT` (default `3001`)
- `CORS_ORIGINS` comma-separated allowed origins (default localhost dev origins)
- `INVITE_BASE_URL` used for invite links
- `DISCONNECT_HOLD_MS` default 10 minutes
- `IDLE_ROOM_MS` default 30 minutes

## Networking reliability implemented

- Server authoritative state per room (`chess.js`).
- Reconnect: client auto re-joins room and requests `sync_state`.
- Opponent disconnect event shown in client.
- Disconnected seat held 10 minutes.
- Idle room cleanup at 30 minutes.
- Per-socket `make_move` rate limit: 10/sec.

## Socket protocol (typed + validated via zod)

- `create_room {name?} -> room_created {roomId, inviteLink}`
- `join_room {roomId} -> room_joined {gameState, colorAssigned}`
- `make_move {roomId, uci, promotion?} -> move_accepted {gameState, san, lastMove, flags}` or `move_rejected {reason}`
- `resign {roomId} -> game_over {result}`
- `request_rematch {roomId} -> rematch_requested`
- `accept_rematch {roomId} -> rematch_started {newGameState}`
- `sync_request {roomId} -> sync_state {gameState}`

## Sound assets and source

Location: `assets/sounds`

Files:
- `move.wav`
- `capture.wav`
- `check.wav`
- `checkmate.wav`

Source/license:
- Generated locally by `scripts/generate-sounds.mjs`
- License: CC0 1.0
- Notes in `assets/sounds/SOURCES.txt`

## Troubleshooting

### WebSocket connection issues

- Ensure client URL uses `https://` for internet play.
- Confirm Fly app is running: `fly status`.
- Check `/health` returns `ok`.
- If corporate/firewall blocks WS, Socket.IO falls back to polling but keep 443 open.

### CORS errors

- Set server env `CORS_ORIGINS` with comma-separated URLs, example:
`https://your-client.example.com,http://localhost:5173`
- Redeploy server after env change.

### Wrong server URL in client

- Open `Server URL` modal and replace URL.
- Restart app after changing if needed.

### Fly config issues

- `fly.toml` must expose ports 80/443 and internal port 3001.
- `INVITE_BASE_URL` should point to where your invite recipients can launch/download client.

### Room not found after reconnect

- Room may be cleaned after 30 minutes idle.
- Recreate room and share a fresh invite link.

## Acceptance checklist

- [x] Private room create/join over internet.
- [x] SAN move list from chess.js (including castling/check/checkmate symbols).
- [x] Coordinate sub-lines (`e2→e4`, `Ng1→f3`, capture with `×`).
- [x] Legal moves only, turn enforcement, illegal move rejection.
- [x] Check/checkmate/draw detection and board lock.
- [x] Resign and rematch flow.
- [x] Reconnect + sync behavior.
- [x] Desktop packaging via electron-builder for Windows/macOS targets.
- [x] Fly.io deployment files (`Dockerfile`, `fly.toml`, `/health` endpoint).
