# Smithery listing

MnogoReels is published on Smithery as a URL (remote) server: Smithery connects to `https://mcp.mnogo-reels.ru/mcp` and forwards the user's settings as headers. The key goes in `X-API-Key` because Smithery reserves `Authorization` for its own OAuth; the read-only switch goes in `X-MnogoReels-Read-Only`. `config-schema.json` (kept under 1 KB) describes both settings.

Prerequisites: `https://mcp.mnogo-reels.ru` resolves and the post-deploy checks in [`docs/deploy-coolify.md`](../docs/deploy-coolify.md) pass on it.

## Publish

```bash
npm i -g smithery@latest
smithery auth login
smithery namespace use mnogoreels        # create the namespace "mnogoreels" first if it does not exist
smithery mcp publish "https://mcp.mnogo-reels.ru/mcp" -n mnogoreels/mnogoreels --config-schema "$(cat smithery/config-schema.json)"
```

Run the commands from the repository root. Then, in the Smithery web UI, upload `assets/icon-512.png` as the server icon.

## Checks after publishing

- Smithery scans the server without a key: discovery and `tools/list` must work unauthenticated, and tool calls that need a key answer HTTP 401 (never 403).
- If the live scan is blocked, Smithery reads the static server card. Confirm that `SmitheryBot/1.0` gets HTTP 200:

  ```bash
  curl -sS -A 'SmitheryBot/1.0' -o /dev/null -w '%{http_code}\n' https://mcp.mnogo-reels.ru/.well-known/mcp/server-card.json
  ```

- Until backend follow-up A1 ships, keyless calls through Smithery share the anonymous video-check budget of Smithery's egress IP (20 checks per minute). Calls with a key are bucketed per key.

## Optional local listing

A second listing `mnogoreels/mnogoreels-local` can be created from the `.mcpb` bundle attached to each GitHub release (`https://github.com/RealSatanyan/mnogoreels-mcp/releases/latest/download/mnogoreels-mcp.mcpb`).
