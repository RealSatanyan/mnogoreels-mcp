# MnogoReels plugin for Cursor

This plugin adds the MnogoReels MCP server to Cursor. MnogoReels turns long videos (YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk, Google Drive or direct links) into captioned vertical Shorts and Reels, and also makes transcripts, articles and YouTube thumbnails.

The plugin connects to the hosted server at `https://mcp.mnogo-reels.ru/mcp` and sends your API key in the `Authorization` header, read from the `MNOGOREELS_API_KEY` environment variable.

## Setup

1. Create an API key at https://mnogo-reels.ru/dashboard/developers?tab=keys (it starts with `mrfrt_usr_`).
2. Set `MNOGOREELS_API_KEY` in your environment and restart Cursor.
3. Ask the agent to call `get_account`; it should report `authenticated: true`.

Making clips costs 1 credit per started minute of the processed video (minimum 1, at most 30 minutes per job). The agent quotes the price first and needs your agreement. Jobs cannot be cancelled, and credits are not returned automatically if processing fails; a failed job can be retried for free.

Documentation and source code: https://github.com/RealSatanyan/mnogoreels-mcp
