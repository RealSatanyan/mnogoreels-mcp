<!-- mcp-name: ru.mnogo-reels/mnogoreels -->

English | [Русский](README.ru.md)

# MnogoReels MCP server

MnogoReels MCP server: turn long videos into captioned vertical Shorts/Reels, transcripts and articles from any MCP client. Give your AI assistant a YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk, Google Drive or direct video link, and it picks the best moments, reframes them to 9:16, burns in captions and a hook title, and hands back links to the finished clips, using your own [MnogoReels](https://mnogo-reels.ru) account.

[![npm version](https://img.shields.io/npm/v/mnogoreels-mcp)](https://www.npmjs.com/package/mnogoreels-mcp)
[![npm downloads](https://img.shields.io/npm/dm/mnogoreels-mcp)](https://www.npmjs.com/package/mnogoreels-mcp)
[![CI](https://github.com/RealSatanyan/mnogoreels-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/RealSatanyan/mnogoreels-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-blue)](https://modelcontextprotocol.io)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-ru.mnogo--reels%2Fmnogoreels-blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=ru.mnogo-reels/mnogoreels)
[![Glama score](https://glama.ai/mcp/servers/RealSatanyan/mnogoreels-mcp/badges/score.svg)](https://glama.ai/mcp/servers/RealSatanyan/mnogoreels-mcp)
[![LightNow capabilities](https://lightnow.ai/badge/ru.mnogo-reels/mnogoreels)](https://lightnow.ai/servers/ru.mnogo-reels/mnogoreels)
[![Docker image](https://img.shields.io/badge/ghcr.io-realsatanyan%2Fmnogoreels--mcp-2496ED?logo=docker&logoColor=white)](https://github.com/RealSatanyan/mnogoreels-mcp/pkgs/container/mnogoreels-mcp)

## One-click install

| Client | Hosted server (nothing to install) | Local server (Node.js 22+, `npx`) |
| --- | --- | --- |
| Cursor | [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=mnogoreels&config=eyJ1cmwiOiJodHRwczovL21jcC5tbm9nby1yZWVscy5ydS9tY3AiLCJoZWFkZXJzIjp7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D) | [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=mnogoreels&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1ub2dvcmVlbHMtbWNwQGxhdGVzdCJdLCJlbnYiOnsiTU5PR09SRUVMU19BUElfS0VZIjoiJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D) |
| VS Code | [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MnogoReels-0098FF?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D) | [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MnogoReels-0098FF?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D) |
| VS Code Insiders | [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_MnogoReels-24bfa5?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D&quality=insiders) | [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_MnogoReels-24bfa5?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D&quality=insiders) |
| Kiro | [![Add to Kiro](https://img.shields.io/badge/Kiro-Add_MnogoReels-7B3FE4)](https://kiro.dev/launch/mcp/add?name=mnogoreels&config=%7B%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7BMNOGOREELS_API_KEY%7D%22%7D%7D) | [![Add to Kiro](https://img.shields.io/badge/Kiro-Add_MnogoReels-7B3FE4)](https://kiro.dev/launch/mcp/add?name=mnogoreels&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7BMNOGOREELS_API_KEY%7D%22%7D%7D) |
| Claude Desktop | not available with an API key (see below) | [![Download for Claude Desktop](https://img.shields.io/badge/Claude_Desktop-Download_.mcpb-D97757?logo=claude&logoColor=white)](https://github.com/RealSatanyan/mnogoreels-mcp/releases/latest/download/mnogoreels-mcp.mcpb) |
| Smithery | [Open in Smithery](https://smithery.ai/server/mnogoreels/mnogoreels) | |

Cursor and Kiro buttons expect MNOGOREELS_API_KEY in your environment; set it and restart the editor, or replace ${env:…} with your key in the config the editor opens. VS Code buttons ask for the key.

<details>
<summary>Direct app links (if a button does not open your editor)</summary>

GitHub does not render `cursor://` and `vscode:` links as clickable, so copy one into your browser's address bar.

Cursor, hosted:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=mnogoreels&config=eyJ1cmwiOiJodHRwczovL21jcC5tbm9nby1yZWVscy5ydS9tY3AiLCJoZWFkZXJzIjp7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D
```

Cursor, local:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=mnogoreels&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1ub2dvcmVlbHMtbWNwQGxhdGVzdCJdLCJlbnYiOnsiTU5PR09SRUVMU19BUElfS0VZIjoiJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D
```

VS Code, hosted (asks for the key):

```text
vscode:mcp/install?%7B%22name%22%3A%22mnogoreels%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Amnogoreels_api_key%7D%22%7D%2C%22inputs%22%3A%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D%7D
```

VS Code, local (asks for the key):

```text
vscode:mcp/install?%7B%22name%22%3A%22mnogoreels%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7Binput%3Amnogoreels_api_key%7D%22%7D%2C%22inputs%22%3A%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D%7D
```

</details>

The Claude Desktop bundle (`.mcpb`) opens an install dialog that asks for the key and an optional read-only switch. Goose links and every other client are listed under [Quick start](#quick-start).

## Get your API key

1. Sign in or register at [mnogo-reels.ru](https://mnogo-reels.ru).
2. Open [Developers → API keys](https://mnogo-reels.ru/dashboard/developers?tab=keys) and create a key. It starts with `mrfrt_usr_`.
3. Put it into your client configuration as shown below (`MNOGOREELS_API_KEY` for the local server, an `Authorization: Bearer` header for the hosted one).

> **The key can spend your credits.** Use a separate key for each client or machine, never paste it into chats, issues or URLs, and revoke it on the same page when you no longer need it.

Listing tools works without a key, and so do `get_account`, `get_options_guide`, `check_video_source` and `quote_clip_job` for a new link. Everything that reads your jobs or creates new ones needs the key.

## Quick start

### Hosted server (recommended)

URL: `https://mcp.mnogo-reels.ru/mcp` (Streamable HTTP). Send the key in a header:

```json
{
  "mcpServers": {
    "mnogoreels": {
      "type": "http",
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer mrfrt_usr_YOUR_KEY" }
    }
  }
}
```

- If your client cannot set `Authorization`, send `X-API-Key: mrfrt_usr_YOUR_KEY` instead.
- `https://mcp.mnogo-reels.ru/mcp/readonly` is the same server without any tool that creates jobs or spends credits.
- Never put the key in the URL: the server refuses such requests.

### Local server (stdio)

Requires Node.js 22 or newer. The server talks to `https://api.mnogo-reels.ru` directly from your machine.

```json
{
  "mcpServers": {
    "mnogoreels": {
      "command": "npx",
      "args": ["-y", "mnogoreels-mcp@latest"],
      "env": { "MNOGOREELS_API_KEY": "mrfrt_usr_YOUR_KEY" }
    }
  }
}
```

`"type": "http"` is the spelling used by Claude Code, VS Code and Cursor. Cline needs `"streamableHttp"`, Windsurf `serverUrl`, Gemini CLI `httpUrl`; the per-client blocks below have the exact form. Ready-made files are in [`examples/`](examples/), and [`docs/clients.md`](docs/clients.md) has longer notes per client.

<details>
<summary><b>Claude Code</b></summary>

Hosted:

```bash
claude mcp add --transport http mnogoreels https://mcp.mnogo-reels.ru/mcp --header "Authorization: Bearer mrfrt_usr_YOUR_KEY"
```

Local:

```bash
claude mcp add mnogoreels --env MNOGOREELS_API_KEY=mrfrt_usr_YOUR_KEY -- npx -y mnogoreels-mcp@latest
```

Plugin (hosted server plus a `make-shorts` skill; asks for the key when you enable it):

```text
/plugin marketplace add RealSatanyan/mnogoreels-mcp
/plugin install mnogoreels@mnogoreels
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Download [`mnogoreels-mcp.mcpb`](https://github.com/RealSatanyan/mnogoreels-mcp/releases/latest/download/mnogoreels-mcp.mcpb) and double-click it (or drag it into Settings → Extensions). Claude Desktop asks for the API key and runs the server with its built-in Node.js.

Or add the local server to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "mnogoreels": {
      "command": "npx",
      "args": ["-y", "mnogoreels-mcp@latest"],
      "env": { "MNOGOREELS_API_KEY": "mrfrt_usr_YOUR_KEY" }
    }
  }
}
```

Custom remote connectors with a static API-key header are not available to individual Claude Desktop users, so use the bundle or the local server.

</details>

<details>
<summary><b>Cursor</b></summary>

Use the buttons above, or add to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "mnogoreels": {
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer ${env:MNOGOREELS_API_KEY}" }
    }
  }
}
```

Local variant: the [local server block](#local-server-stdio) above, with `"MNOGOREELS_API_KEY": "${env:MNOGOREELS_API_KEY}"` if you keep the key in your environment.

</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Use the buttons above, or create `.vscode/mcp.json`. VS Code asks for the key once and stores it securely:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "mnogoreels_api_key",
      "description": "MnogoReels API key (mrfrt_usr_...)",
      "password": true
    }
  ],
  "servers": {
    "mnogoreels": {
      "type": "http",
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer ${input:mnogoreels_api_key}" }
    }
  }
}
```

A workspace `.mcp.json` uses the `mcpServers` form from [Hosted server](#hosted-server-recommended); do not commit a file that contains your key.

</details>

<details>
<summary><b>OpenAI Codex</b></summary>

`~/.codex/config.toml`, hosted (export `MNOGOREELS_API_KEY` in the shell that starts Codex):

```toml
[mcp_servers.mnogoreels]
url = "https://mcp.mnogo-reels.ru/mcp"
bearer_token_env_var = "MNOGOREELS_API_KEY"
tool_timeout_sec = 120
```

Local:

```toml
[mcp_servers.mnogoreels]
command = "npx"
args = ["-y", "mnogoreels-mcp@latest"]
env_vars = ["MNOGOREELS_API_KEY"]
startup_timeout_sec = 60
tool_timeout_sec = 120
```

Or from the command line:

```bash
codex mcp add mnogoreels --env MNOGOREELS_API_KEY=mrfrt_usr_YOUR_KEY -- npx -y mnogoreels-mcp@latest
```

The default 10-second startup timeout is often too short for the first `npx` download, hence `startup_timeout_sec = 60`.

</details>

<details>
<summary><b>Gemini CLI</b></summary>

Install the extension (it asks for the key and keeps it in the system keychain):

```bash
gemini extensions install https://github.com/RealSatanyan/mnogoreels-mcp
```

Or add the hosted server to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "mnogoreels": {
      "httpUrl": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer $MNOGOREELS_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mnogoreels": {
      "serverUrl": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer ${env:MNOGOREELS_API_KEY}" }
    }
  }
}
```

</details>

<details>
<summary><b>Zed</b></summary>

`settings.json`, hosted:

```json
{
  "context_servers": {
    "mnogoreels": {
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer mrfrt_usr_YOUR_KEY" }
    }
  }
}
```

Local:

```json
{
  "context_servers": {
    "mnogoreels": {
      "command": "npx",
      "args": ["-y", "mnogoreels-mcp@latest"],
      "env": { "MNOGOREELS_API_KEY": "mrfrt_usr_YOUR_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Cline</b></summary>

Add exactly one of these blocks to `cline_mcp_settings.json`. Local:

```json
{
  "mcpServers": {
    "mnogoreels": {
      "command": "npx",
      "args": ["-y", "mnogoreels-mcp@latest"],
      "env": { "MNOGOREELS_API_KEY": "mrfrt_usr_YOUR_KEY" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Hosted:

```json
{
  "mcpServers": {
    "mnogoreels": {
      "type": "streamableHttp",
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer mrfrt_usr_YOUR_KEY" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Never omit type for the remote entry: Cline treats a remote entry without type as legacy SSE, which this server does not serve. Cline can also set the server up by itself from [`llms-install.md`](llms-install.md).

</details>

<details>
<summary><b>Goose</b></summary>

Paste one of these links into your browser's address bar (GitHub does not render `goose://` links as clickable). Local, Goose asks for the key:

```text
goose://extension?name=MnogoReels&cmd=npx&arg=-y&arg=mnogoreels-mcp%40latest&env=MNOGOREELS_API_KEY%3DMnogoReels%20API%20key%20(mrfrt_usr_...)&timeout=120&description=Turn%20long%20videos%20into%20captioned%20vertical%20clips%2C%20transcripts%20and%20articles
```

Hosted, replace `mrfrt_usr_YOUR_KEY` before opening:

```text
goose://extension?name=MnogoReels&url=https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp&header=Authorization%3DBearer%20mrfrt_usr_YOUR_KEY&timeout=120&description=Turn%20long%20videos%20into%20captioned%20vertical%20clips%2C%20transcripts%20and%20articles
```

Or run `goose configure` → Add Extension → Command-line Extension with the command `npx -y mnogoreels-mcp@latest` and the variable `MNOGOREELS_API_KEY`. A `config.yaml` example is in [`examples/goose-config.yaml`](examples/goose-config.yaml).

</details>

<details>
<summary><b>Kiro</b></summary>

Use the buttons above, or add to `~/.kiro/settings/mcp.json` (or `.kiro/settings/mcp.json` in a project):

```json
{
  "mcpServers": {
    "mnogoreels": {
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer ${MNOGOREELS_API_KEY}" }
    }
  }
}
```

</details>

<details>
<summary><b>JetBrains AI Assistant, Warp, Amazon Q, LM Studio</b></summary>

These clients accept the generic `mcpServers` JSON: paste the [hosted](#hosted-server-recommended) or the [local](#local-server-stdio) block into their MCP settings (JetBrains: Settings → Tools → AI Assistant → Model Context Protocol; Warp: Settings → AI → MCP servers; Amazon Q: `~/.aws/amazonq/mcp.json`; LM Studio: `mcp.json`). If a client does not support remote servers with headers, use the local block.

</details>

<details>
<summary><b>Continue</b></summary>

Save as `.continue/mcpServers/mnogoreels.yaml` and add the secret `MNOGOREELS_API_KEY` in Continue:

```yaml
name: MnogoReels
version: 1.0.0
schema: v1
mcpServers:
  - name: MnogoReels
    type: streamable-http
    url: https://mcp.mnogo-reels.ru/mcp
    requestOptions:
      headers:
        Authorization: 'Bearer ${{ secrets.MNOGOREELS_API_KEY }}'
```

</details>

<details>
<summary><b>n8n</b></summary>

Add an **MCP Client Tool** node to your AI Agent:

- Server Transport: **HTTP Streamable**
- Endpoint: `https://mcp.mnogo-reels.ru/mcp`
- Authentication: **Header Auth** with name `Authorization` and value `Bearer mrfrt_usr_YOUR_KEY`

Details: [`examples/n8n.md`](examples/n8n.md).

</details>

<details>
<summary><b>Yandex AI Studio (MCP Hub)</b></summary>

AI Studio → MCP Hub → «Внешний MCP-сервер» (external MCP server):

- Name: `mnogoreels`
- URL: `https://mcp.mnogo-reels.ru/mcp`
- Transport: Streamable HTTP
- Header: `Authorization: Bearer mrfrt_usr_YOUR_KEY`

Details: [`examples/yandex-ai-studio.md`](examples/yandex-ai-studio.md).

</details>

<details>
<summary><b>Cloud.ru Evolution AI Agents</b></summary>

AI Agents → MCP servers → add a server by URL: `https://mcp.mnogo-reels.ru/mcp` with the header `Authorization: Bearer mrfrt_usr_YOUR_KEY`.

</details>

<details>
<summary><b>GigaChain / LangChain (Python)</b></summary>

With `langchain-mcp-adapters`:

```python
import os

from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient(
    {
        "mnogoreels": {
            "transport": "streamable_http",
            "url": "https://mcp.mnogo-reels.ru/mcp",
            "headers": {"Authorization": "Bearer " + os.environ["MNOGOREELS_API_KEY"]},
        }
    }
)
tools = await client.get_tools()
```

Pass `tools` to your GigaChat agent. A runnable script is in [`examples/gigachain.py`](examples/gigachain.py).

</details>

<details>
<summary><b>Docker</b></summary>

The image runs the local (stdio) server by default:

```bash
docker run -i --rm -e MNOGOREELS_API_KEY ghcr.io/realsatanyan/mnogoreels-mcp:latest
```

As an MCP client entry:

```json
{
  "mcpServers": {
    "mnogoreels": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "MNOGOREELS_API_KEY", "ghcr.io/realsatanyan/mnogoreels-mcp:latest"],
      "env": { "MNOGOREELS_API_KEY": "mrfrt_usr_YOUR_KEY" }
    }
  }
}
```

</details>

## What you can do

Ask your assistant in plain language, for example:

- "Make Shorts from https://www.youtube.com/watch?v=… with Russian captions in the hormozi style. Tell me the price first."
- "How many credits would it cost to clip the first 30 minutes of this podcast? It's 2 hours long."
- "Transcribe this RuTube video and give me SRT subtitles."
- "Write a blog post with chapters from my last clip job."
- "Show my recent clip jobs and the three best clips of each, with their scores and links."

## Tools

<!-- tools:start -->
| Tool | Title | Read-only | Spends credits | What it does |
| --- | --- | --- | --- | --- |
| `get_account` | Check API key and settings | yes | no | Checks whether the configured MnogoReels API key works and shows this server's settings. |
| `get_options_guide` | Explain clip options | yes | no | Explains the option values accepted by create_clip_job and recut_clip_job: video modes, clip lengths, caption styles, hook styles, story arc styles, outros, framing and languages, plus the pricing rules and the 30-minute limit per job. |
| `check_video_source` | Check video source | yes | no | Checks whether MnogoReels can download a video link and returns its title, length and platform. |
| `quote_clip_job` | Quote clip job cost | yes | no | Calculates the credit cost of create_clip_job or recut_clip_job without spending anything, and checks that MnogoReels can download the video. |
| `create_clip_job` | Create clip job (spends credits) | no | yes | Starts AI clipping of a long video into vertical 9:16 short clips with burned-in captions and a hook title, plus optional cold-open hooks, music and B-roll. |
| `get_clip_job` | Get clip job status and clips | yes | no | Returns the status, progress and results of a clip job created by create_clip_job, recut_clip_job or on the MnogoReels website. |
| `list_clip_jobs` | List clip jobs | yes | no | Lists the user's clip jobs, newest first, including jobs started on the MnogoReels website. |
| `recut_clip_job` | Recut clip job (spends credits) | no | yes | Creates a new clip job from the same source video as an existing job, with different settings such as caption style, hook style, clip length, language, framing, music, B-roll or prompt. |
| `retry_clip_job` | Retry failed clip job (free) | no | no | Re-runs a failed clip job with the same settings, free of charge, keeping the same job_id. |
| `create_transcription` | Transcribe video or audio | no | no | Starts a timed speech-to-text transcription of a video or audio link. |
| `get_transcription` | Get transcription | yes | no | Returns the status and text of a transcription started with create_transcription. |
| `create_article` | Create article from clip job | no | no | Turns the source video of a completed clip job into a long-form article: title, SEO title and description, summary, sections, key takeaways, chapters with timestamps, up to 4 frames from the video as illustrations, and the full timed transcript. |
| `get_article` | Get article | yes | no | Returns an article created with create_article as Markdown, with its status. |
| `search_broll` | Search B-roll library | yes | no | Searches B-roll videos and images. |
| `get_broll_asset` | Get B-roll asset | yes | no | Returns one B-roll item by asset_id with fresh links. |
| `list_packs` | List publication packs | yes | no | Lists the user's publication packs, newest first. |
| `get_pack` | Get publication pack | yes | no | Returns one publication pack: suggested titles, descriptions, cover texts and hashtags, thumbnail images, teaser videos, the article id and the clip job id. |
| `create_youtube_thumbnails` | Create YouTube thumbnails | no | no | Generates 1 to 4 AI YouTube thumbnail images (1280×720 JPEG) for a video, using frames from the video plus an optional title and art direction. |
| `get_youtube_thumbnails` | Get YouTube thumbnails | yes | no | Returns the status and images of a thumbnail job started with create_youtube_thumbnails. |
<!-- tools:end -->

Every tool declares a title, all four MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) and an output schema. The two credit-spending tools are marked `destructiveHint: true`, so clients that ask before risky actions (for example Claude and Codex) prompt you on every call.

## How to choose a tool

| I want to… | Tool |
| --- | --- |
| Know whether a link works and how long the video is | `check_video_source` |
| Know the price before making clips | `quote_clip_job` |
| Make clips | `create_clip_job` (after the quote and your OK) |
| Follow progress and get the clips | `get_clip_job` |
| Find my earlier jobs (also those made on the website) | `list_clip_jobs` |
| Get a different look or different moments from a finished job | `recut_clip_job` (paid, new job) |
| Re-run a failed job | `retry_clip_job` (free) |
| Get a transcript or SRT subtitles | `create_transcription` → `get_transcription` |
| Get a blog post, show notes or chapters | `create_article` → `get_article` (needs a completed clip job) |
| Find B-roll footage | `search_broll` → `get_broll_asset` |
| Read a publication pack made on the website | `list_packs` → `get_pack` |
| Make YouTube thumbnails | `create_youtube_thumbnails` → `get_youtube_thumbnails` |
| Check my key and the server settings | `get_account` |
| Understand caption styles, modes and other options | `get_options_guide` |

### Jobs run in the background

Every `create_*` tool returns an id right away. The matching `get_*` tool waits inside the call for up to `wait_sec` seconds (default 30, max 50) and sends progress notifications meanwhile, so the assistant simply calls it again until the status is `completed` or `failed`. Short videos take a few minutes; a full 30-minute range can take tens of minutes. While a clip job is processing, `get_clip_job` returns only the number of ready clips (set `include_partial_clips=true` to see them early).

### Spending rules

- **Price:** 1 credit per started minute of the processed range (`end_sec − start_sec`), minimum 1, charged when the job is created. Examples: 45 s → 1 credit, 10 min → 10, 29 min 30 s → 30. Captions, hooks, B-roll, music and agentic mode do not change the price through the API.
- **Free:** checks, quotes, transcriptions, articles, YouTube thumbnails, retries of failed jobs and reading results.
- **Quote first:** `quote_clip_job` is free and uses the same formula as the backend. The assistant should show you the price and wait for your agreement.
- **`max_credits` is required** on `create_clip_job` and `recut_clip_job`. The call is refused without charging if the price is higher. An operator can also set a hard cap with `MNOGOREELS_MAX_CREDITS_PER_CALL` or the `X-MnogoReels-Max-Credits-Per-Call` header that the model cannot raise.
- **30 minutes per job.** MnogoReels processes at most 30 minutes per job, so longer ranges are refused before any charge. Split long videos with `start_sec`/`end_sec` (0–1800, 1800–3600, …).
- **Duplicate guard:** an identical request with the same key within 10 minutes returns the job that was already created instead of charging again (`allow_duplicate: true` turns this off). The guard lives in one server process; two separate processes do not share it.
- **No cancel, no automatic refund.** Credits are charged when the job is created and jobs cannot be cancelled. If processing fails, credits are not returned automatically; `retry_clip_job` re-runs a failed job for free, or contact support@mnogo-reels.ru with the `job_id`.
- **Confirmation dialog.** Where the client supports MCP form elicitation, the server also asks you to confirm the exact amount before charging:

| Where the server runs | Confirmation dialog before spending |
| --- | --- |
| Local server (stdio, `npx`, `.mcpb`, Docker), any client with form elicitation | yes |
| Hosted server, client on MCP 2026-07-28 with form elicitation | yes |
| Hosted server, 2025-era clients (most clients today) | no: `max_credits`, the operator cap, the 30-minute limit, the duplicate guard and your client's own approval prompt are the gates |
| Any client without elicitation support | no: same gates as above |

## Prompts and resources

Prompts (slash commands in clients that show them):

| Prompt | What it does |
| --- | --- |
| `clip_video` | Quote, confirm, create and wait for clips from one link (`url`, optional `language`, `caption_style`, `clip_length`) |
| `podcast_to_shorts` | Split a long podcast into 30-minute parts, quote each, make a Shorts series and propose a posting order (`url`, optional `language`) |
| `video_to_blog_post` | Turn a completed clip job into an article plus a chapter list (`clip_job_id`) |
| `transcribe_video` | Transcribe a link as text or SRT (`url`, optional `language`, `format`) |
| `review_recent_clips` | Review your latest jobs and suggest recut settings without spending anything (optional `count`) |

Resources:

| URI | Content |
| --- | --- |
| `mnogoreels://guide/options` | All option values with descriptions |
| `mnogoreels://guide/pricing` | Pricing, the 30-minute limit and the list of free operations |
| `mnogoreels://guide/workflow` | How to use the tools (same text as the server instructions) |
| `mnogoreels://clip-jobs/{job_id}` | Status and clips of one job (JSON; lists your 20 latest jobs) |
| `mnogoreels://transcriptions/{transcription_id}` | First page of a transcript |
| `mnogoreels://articles/{article_id}` | First page of an article in Markdown |

Prompts and job resources appear only when the tools they use are enabled (for example, `/mcp/readonly` offers only `review_recent_clips`). Every capability is also reachable through tools, because many clients never show resources.

## Configuration

### Environment variables (local server and self-hosting)

| Variable | Default | Meaning |
| --- | --- | --- |
| `MNOGOREELS_API_KEY` | none | Your key (`mrfrt_usr_…`). Not needed to start the server or list tools. Ignored in HTTP mode, where every caller sends their own key. |
| `MNOGOREELS_API_URL` | `https://api.mnogo-reels.ru` | API base URL; leave the default. |
| `MNOGOREELS_PROFILE` | `default` | `default`, `readonly` or `directory` (see [Profiles](#profiles)). |
| `MNOGOREELS_TOOLSETS` | all | Comma list of `clips`, `transcripts`, `articles`, `library`, `thumbnails` (or `all`). `account` is always on. |
| `MNOGOREELS_READ_ONLY` | `false` | `true` hides every tool that creates jobs or spends credits. |
| `MNOGOREELS_MAX_CREDITS_PER_CALL` | unset | Hard cap on credits per paid call; the model cannot override it. |
| `MNOGOREELS_MAX_WINDOW_SEC` | `1800` | Longest range per paid job, in seconds. Keep the default: it matches what MnogoReels processes. |
| `MNOGOREELS_MEDIA_URLS` | `direct` | `both` also returns `stream_url` links through the MnogoReels website proxy. Keep `direct` until MnogoReels announces the proxy for API use. |
| `MNOGOREELS_DEBUG` | `false` | Local server only: log full error messages to stderr. |
| `MNOGOREELS_TRANSPORT` | `stdio` | `http` starts the Streamable HTTP server (same as `--http`). |
| `MNOGOREELS_HOST` / `MNOGOREELS_PORT` | `127.0.0.1` / `8080` | HTTP bind address. |
| `MNOGOREELS_PUBLIC_URL` | `https://mcp.mnogo-reels.ru/mcp` | Public URL announced in the server card. |
| `MNOGOREELS_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Accepted `Host` headers (DNS-rebinding protection). |
| `MNOGOREELS_ALLOWED_ORIGINS` | `localhost,127.0.0.1,[::1]` | Accepted browser `Origin` hostnames, or `*` for a public bearer-token deployment. |
| `MNOGOREELS_TRUSTED_PROXIES` | empty | CIDRs of reverse proxies whose `X-Forwarded-For` is trusted. |

Booleans accept `1/true/yes/on` and `0/false/no/off`. An invalid value stops the server with a message naming the variable (exit code 2). Command line: `mnogoreels-mcp [--http] [--help] [--version]`.

### Hosted server: paths and headers

| Path | Profile |
| --- | --- |
| `/mcp` | `default` |
| `/mcp/readonly` | `readonly` |
| `/mcp/directory` | `directory` |

| Header | Effect |
| --- | --- |
| `Authorization: Bearer <key>` | Your API key (preferred). |
| `X-API-Key: <key>` | Your API key, when `Authorization` is not available. |
| `X-MnogoReels-Toolsets: clips,transcripts` | Show only these toolsets (`account` is always kept). |
| `X-MnogoReels-Read-Only: true` | Hide tools that create jobs or spend credits. `false` never widens a read-only path. |
| `X-MnogoReels-Max-Credits-Per-Call: 30` | Hard credit cap per paid call. |

Headers can only narrow what the path allows. Discovery and listing work without a key; a tool call that needs the key and has none gets HTTP 401.

### Profiles

| Profile | Tools | What changes |
| --- | --- | --- |
| `default` | 19 | Everything. |
| `readonly` | 13 | No tool that creates jobs or spends credits; reading, checks and quotes still work. |
| `directory` | 17 | No YouTube thumbnail tools, no AI-image or motion-graphics B-roll options, no "buy credits" link. Used for public directory listings. |

### Self-hosting the HTTP server

`npx -y mnogoreels-mcp@latest --http` or `docker run -p 8080:8080 -e MNOGOREELS_TRANSPORT=http ghcr.io/realsatanyan/mnogoreels-mcp:latest` starts the same server that runs at `mcp.mnogo-reels.ru` (health check: `GET /healthz`, server card: `GET /.well-known/mcp/server-card.json`). Set `MNOGOREELS_ALLOWED_HOSTS` to your domain. The production setup is described in [`docs/deploy-coolify.md`](docs/deploy-coolify.md).

## Security

- **Untrusted content.** Titles, transcripts, articles and other text that comes from videos is wrapped in `<untrusted_source_text>` tags, and the server instructions tell the model to treat it as data, never as instructions.
- **Key hygiene.** The key travels only in the `Authorization` or `X-API-Key` header (the hosted server rejects keys in URLs), is never logged, and `get_account` shows only its last 4 characters. Use a dedicated key per client and revoke keys you no longer use. Service keys (`mrfrt_svc_…`) are rejected.
- **Read-only mode.** `MNOGOREELS_READ_ONLY=true`, the `/mcp/readonly` path or the read-only switch in the Claude Desktop bundle removes every tool that can create jobs or spend credits.
- **Only official sources.** The server is published only as the npm package [`mnogoreels-mcp`](https://www.npmjs.com/package/mnogoreels-mcp), the image `ghcr.io/realsatanyan/mnogoreels-mcp`, the hosted endpoint `https://mcp.mnogo-reels.ru` and this repository. Do not give your key to look-alikes.
- **Pinning.** `mnogoreels-mcp@latest` updates automatically. To avoid automatic updates, pin a version, e.g. `npx -y mnogoreels-mcp@1.0.0`.

Report vulnerabilities privately: see [SECURITY.md](SECURITY.md).

## Privacy

The local server sends your tool arguments and key only to `api.mnogo-reels.ru`. The hosted server receives them at `mcp.mnogo-reels.ru` and forwards them to the same API; it keeps keys only in memory for the duration of a request and never logs keys, tool arguments or results (only a short hash prefix of the key, to tell users apart). No telemetry is collected. Details: [PRIVACY.md](PRIVACY.md), the MnogoReels [privacy policy](https://mnogo-reels.ru/privacy-policy) and [terms](https://mnogo-reels.ru/terms).

## Troubleshooting

Tool errors start with `Error [<code>]:` followed by advice. The most common ones:

| Code | What to do |
| --- | --- |
| `missing_api_key`, `invalid_api_key_format`, `invalid_api_key` (HTTP 401 on the hosted server) | Create a key at [Developers → API keys](https://mnogo-reels.ru/dashboard/developers?tab=keys) and update the client config. Keys start with `mrfrt_usr_`. Run `get_account` to check. |
| `insufficient_credits` (402) | Top up credits or buy a plan at [mnogo-reels.ru](https://mnogo-reels.ru). |
| `duration_unknown` | The platform does not report the video length (typical for direct file links). Pass `end_sec` (the length in seconds, or the end of the part to process). |
| `invalid_arguments` mentioning 30 minutes | One job processes at most 30 minutes. Split the video with `start_sec`/`end_sec` and make several jobs. |
| `source_not_downloadable` | The video is private, removed, region-locked, audio-only or larger than 17 GB. Nothing was charged. Try another link. |
| `rate_limited`, `rate_limited_local` | Too many requests; wait the number of seconds in the message. |
| `upstream_timeout` | MnogoReels did not answer in time; try again. For source checks you can pass `start_sec`/`end_sec` yourself. |
| `outcome_unknown`, `billing_uncertain` | The server could not confirm whether a paid job was created. Check `list_clip_jobs` before trying again; if credits were taken without a job, contact support@mnogo-reels.ru. An identical retry within 10 minutes returns the same answer without sending anything. |
| Codex: tools time out or the server does not start | Set `startup_timeout_sec = 60` and `tool_timeout_sec = 120` in `config.toml`. |
| Slow or failing downloads in Russia | Some Russian home connections throttle the API and media hosts. Prefer the hosted server on home connections. `MNOGOREELS_MEDIA_URLS=both` adds proxied `stream_url` links once MnogoReels enables that proxy for API use. |

Still stuck? [Open an issue](https://github.com/RealSatanyan/mnogoreels-mcp/issues) (remove your key from logs and configs first) or write to support@mnogo-reels.ru.

## Limitations (v1)

- No local files: the video must be reachable by a public link (upload it somewhere public first).
- No credit balance: the API does not expose it; see it on mnogo-reels.ru.
- No publishing or scheduling to social networks.
- No cancelling of jobs.
- Publication packs can be read but not created; failed article images cannot be retried.

## Development

Requirements: Node.js 22+. The code is TypeScript (strict), built with `tsc`, tested with Vitest and Stryker, and written test-first.

```bash
npm ci --ignore-scripts
npm run typecheck && npm run lint && npm test
npm run build
npm run test:integration
npm run smoke              # MCP Inspector CLI smoke test
npm run version:check      # manifests in sync with package.json
npm run metadata:check     # README tool tables, MCPB tools, Docker tools.json up to date
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and [docs/release.md](docs/release.md) for releases. Changes are listed in [CHANGELOG.md](CHANGELOG.md). Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2026 MnogoReels
