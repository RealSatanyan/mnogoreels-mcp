# Client setup in detail

The [README](../README.md#quick-start) has a short block for every client. This page adds file locations, ways to keep the key out of config files, read-only variants and checks. Ready-to-copy files are in [`examples/`](../examples/).

Everywhere below, `mrfrt_usr_YOUR_KEY` stands for your key from https://mnogo-reels.ru/dashboard/developers?tab=keys.

## Choosing hosted or local

| | Hosted (`https://mcp.mnogo-reels.ru/mcp`) | Local (`npx -y mnogoreels-mcp@latest`) |
| --- | --- | --- |
| Install | nothing | Node.js 22+ |
| Key | `Authorization: Bearer` (or `X-API-Key`) header | `MNOGOREELS_API_KEY` environment variable |
| Confirmation dialog before spending | only for MCP 2026-07-28 clients with elicitation | every client with elicitation |
| Russian home connections | recommended (fewer throttling problems) | works, but the API may be slow on some ISPs |
| Updates | always current | `@latest` on every start, or pin `@X.Y.Z` |

Read-only variants: use `https://mcp.mnogo-reels.ru/mcp/readonly` (hosted) or set `MNOGOREELS_READ_ONLY=true` (local). To cap spending per call, add the header `X-MnogoReels-Max-Credits-Per-Call: <n>` (hosted) or set `MNOGOREELS_MAX_CREDITS_PER_CALL=<n>` (local).

## Checking the connection

In any client, ask: "Call the MnogoReels get_account tool." The answer must contain `"authenticated": true`. Otherwise the `message` field says what is wrong (no key, wrong format, revoked key).

## Claude Code

```bash
claude mcp add --transport http mnogoreels https://mcp.mnogo-reels.ru/mcp --header "Authorization: Bearer mrfrt_usr_YOUR_KEY"
claude mcp add mnogoreels --env MNOGOREELS_API_KEY=mrfrt_usr_YOUR_KEY -- npx -y mnogoreels-mcp@latest
```

- `--scope user` makes the server available in every project; `--scope project` writes a shared `.mcp.json`.
- In a shared `.mcp.json`, keep the key in your environment: Claude Code expands `${VAR}`:

  ```json
  {
    "mcpServers": {
      "mnogoreels": {
        "type": "http",
        "url": "https://mcp.mnogo-reels.ru/mcp",
        "headers": { "Authorization": "Bearer ${MNOGOREELS_API_KEY}" }
      }
    }
  }
  ```

- Plugin: `/plugin marketplace add RealSatanyan/mnogoreels-mcp`, then `/plugin install mnogoreels@mnogoreels`. It connects to the hosted server, asks for the key when enabled and adds the `make-shorts` skill.
- Check with `claude mcp list` and `/mcp` inside a session.

## Claude Desktop

- **Bundle (recommended):** download https://github.com/RealSatanyan/mnogoreels-mcp/releases/latest/download/mnogoreels-mcp.mcpb and open it. Claude Desktop shows the install dialog with the API key field (stored in the system keychain) and a read-only switch, and runs the server with its built-in Node.js.
- **Config file:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows); see [`examples/claude_desktop_config.json`](../examples/claude_desktop_config.json). Requires Node.js 22+ on `PATH`. Restart Claude Desktop after editing.
- Custom remote connectors with a static API-key header are not available to individual Claude Desktop users, so the hosted server cannot be added there with a key.

## Cursor

- Buttons in the README install either variant with `${env:MNOGOREELS_API_KEY}`. Set the variable in your shell profile (macOS/Linux) or the system environment (Windows) and restart Cursor, or edit the opened config and paste the key.
- Files: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project); see [`examples/cursor-mcp.json`](../examples/cursor-mcp.json).
- Settings → MCP shows the server status and the tool list.
- The Cursor plugin in [`plugins/cursor`](../plugins/cursor) uses the same hosted configuration.

## VS Code (GitHub Copilot)

- `.vscode/mcp.json` with an `inputs` prompt keeps the key out of the file; see [`examples/vscode-mcp.json`](../examples/vscode-mcp.json). VS Code asks for the key on first start and stores it securely.
- Command line: `code --add-mcp '{"name":"mnogoreels","type":"http","url":"https://mcp.mnogo-reels.ru/mcp","headers":{"Authorization":"Bearer ${input:mnogoreels_api_key}"},"inputs":[{"type":"promptString","id":"mnogoreels_api_key","description":"MnogoReels API key (mrfrt_usr_...)","password":true}]}'`.
- Command Palette → "MCP: List Servers" shows status and logs.

## OpenAI Codex

`~/.codex/config.toml`; see [`examples/codex-config.toml`](../examples/codex-config.toml).

- Hosted: `bearer_token_env_var = "MNOGOREELS_API_KEY"` reads the key from the environment of the shell that starts Codex.
- Local: `env_vars = ["MNOGOREELS_API_KEY"]` passes the variable through to the server.
- Keep `startup_timeout_sec = 60` (first `npx` download) and `tool_timeout_sec = 120` (tools wait up to 50 seconds for jobs).

## Gemini CLI

- `gemini extensions install https://github.com/RealSatanyan/mnogoreels-mcp` installs the extension defined in [`gemini-extension.json`](../gemini-extension.json): a pinned local server plus the `GEMINI.md` context file. Gemini asks for the key and keeps it in the system keychain; extensions do not inherit your shell environment.
- Hosted alternative in `~/.gemini/settings.json`: `httpUrl` (Streamable HTTP; `url` would mean SSE) with `"Authorization": "Bearer $MNOGOREELS_API_KEY"`.

## Windsurf

`~/.codeium/windsurf/mcp_config.json`; remote servers use `serverUrl`, not `url`. See [`examples/windsurf-mcp_config.json`](../examples/windsurf-mcp_config.json).

## Zed

`settings.json` → `context_servers`; see [`examples/zed-settings.json`](../examples/zed-settings.json). The README also has the local variant.

## Cline

`cline_mcp_settings.json`; see [`examples/cline-mcp-settings.json`](../examples/cline-mcp-settings.json). The remote entry needs `"type": "streamableHttp"`: without it Cline uses legacy SSE, which this server does not serve. Cline can configure everything from [`llms-install.md`](../llms-install.md).

## Goose

- Desktop: paste a `goose://extension?...` link from the README into the browser.
- CLI: `goose configure` → Add Extension → Command-line Extension, command `npx -y mnogoreels-mcp@latest`, environment variable `MNOGOREELS_API_KEY`.
- File: `~/.config/goose/config.yaml`; see [`examples/goose-config.yaml`](../examples/goose-config.yaml). Set a timeout of at least 120 seconds.

## Kiro

`~/.kiro/settings/mcp.json` or `.kiro/settings/mcp.json`; `${MNOGOREELS_API_KEY}` is expanded from the environment. See [`examples/kiro-mcp.json`](../examples/kiro-mcp.json).

## JetBrains AI Assistant, Warp, Amazon Q, LM Studio

All accept the generic `mcpServers` JSON:

- JetBrains: Settings → Tools → AI Assistant → Model Context Protocol → Add → paste JSON.
- Warp: Settings → AI → MCP servers → Add.
- Amazon Q Developer: `~/.aws/amazonq/mcp.json`.
- LM Studio: Program → Install → Edit `mcp.json`.

Use the local block when a client cannot send headers to remote servers.

## Continue

[`examples/continue-mnogoreels.yaml`](../examples/continue-mnogoreels.yaml) is a Continue block: save it in `.continue/mcpServers/` (or publish it on Continue Hub) and add the secret `MNOGOREELS_API_KEY`.

## n8n

See [`examples/n8n.md`](../examples/n8n.md): MCP Client Tool node, HTTP Streamable transport, Header Auth credential.

## Yandex AI Studio and Cloud.ru

See [`examples/yandex-ai-studio.md`](../examples/yandex-ai-studio.md) (in Russian). Cloud.ru Evolution AI Agents: MCP servers → add by URL, same URL and header.

## GigaChain / LangChain

[`examples/gigachain.py`](../examples/gigachain.py) connects with `langchain-mcp-adapters` and calls `get_account`. Pass the loaded tools to any LangChain agent, including one on GigaChat.

## Docker

```bash
docker run -i --rm -e MNOGOREELS_API_KEY ghcr.io/realsatanyan/mnogoreels-mcp:latest
```

`-e MNOGOREELS_API_KEY` without a value passes the variable from your environment, so the key does not appear in the command line. Pin a version tag (`:1.0.0`) to avoid automatic updates.

## Smithery

The Smithery listing `mnogoreels/mnogoreels` connects to the hosted server and asks for the key (sent as `X-API-Key`) and an optional read-only switch.
