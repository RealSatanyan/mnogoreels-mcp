# Installing the MnogoReels MCP server (instructions for AI agents)

MnogoReels turns long video links into vertical short clips with captions, transcripts and articles. The server needs a personal MnogoReels API key for tool calls. Follow these steps exactly.

## 1. Get the API key from the user

Ask the user for their MnogoReels API key. If they do not have one, tell them to:

1. Sign in at https://mnogo-reels.ru.
2. Open https://mnogo-reels.ru/dashboard/developers?tab=keys and create a key.
3. Copy the key. It starts with `mrfrt_usr_`.

Never put the key in a URL, a commit or a chat log you share. The key can spend the user's credits.

## 2. Add exactly one of these blocks to `cline_mcp_settings.json`

Replace `<key>` with the user's key. If `mcpServers` already exists, add only the `mnogoreels` entry to it.

Option A, local server (runs with Node.js 22 or newer through `npx`):

```json
{
  "mcpServers": {
    "mnogoreels": {
      "command": "npx",
      "args": ["-y", "mnogoreels-mcp@latest"],
      "env": { "MNOGOREELS_API_KEY": "<key>" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Option B, remote server (nothing to install):

```json
{
  "mcpServers": {
    "mnogoreels": {
      "type": "streamableHttp",
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer <key>" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Never omit type for the remote entry: Cline treats a remote entry without type as legacy SSE, which this server does not serve.

Prefer option B when Node.js is not installed or when the user is on a home internet connection in Russia.

## 3. Verify

Call the `get_account` tool with no arguments. The result must contain `"authenticated": true`. If it shows `missing_api_key`, `invalid_api_key_format` or `invalid_api_key`, ask the user to copy the key again from https://mnogo-reels.ru/dashboard/developers?tab=keys and update the configuration.

## 4. Done

No other setup is needed. Before any paid action, call `quote_clip_job`, show the price to the user and pass `max_credits` to `create_clip_job` only after the user agrees.
