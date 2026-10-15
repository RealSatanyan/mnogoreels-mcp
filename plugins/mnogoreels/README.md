# MnogoReels plugin for Claude

This plugin connects Claude to MnogoReels, a service that turns long videos into captioned vertical Shorts, Reels and TikToks, and also makes transcripts, articles and YouTube thumbnails. Give Claude a YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk, Google Drive or direct video link and ask for clips.

The plugin talks only to the hosted MnogoReels MCP server at `https://mcp.mnogo-reels.ru/mcp`, using the API key you enter when you enable the plugin. The key is sent in the `Authorization` header and is never put in a URL.

## Get an API key

1. Sign in at https://mnogo-reels.ru.
2. Open https://mnogo-reels.ru/dashboard/developers?tab=keys and create a key (it starts with `mrfrt_usr_`).
3. Paste it when Claude asks for the MnogoReels API key.

## Spending

Making clips costs 1 credit per started minute of the processed video (minimum 1, at most 30 minutes per job). Claude always quotes the price first and needs your agreement. Jobs cannot be cancelled, and credits are not returned automatically if processing fails; a failed job can be retried for free. Transcripts, articles, thumbnails, checks and quotes are free.

## Install in Claude Code

```
/plugin install mnogoreels --marketplace RealSatanyan/mnogoreels-mcp
```

On older Claude Code versions run `/plugin marketplace add RealSatanyan/mnogoreels-mcp` first, then `/plugin install mnogoreels@mnogoreels`.

The `make-shorts` skill walks Claude through the quote, confirm and wait steps.

Full documentation, privacy notes and the source code: https://github.com/RealSatanyan/mnogoreels-mcp
