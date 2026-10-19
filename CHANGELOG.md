# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Tool names and input schemas are frozen from 1.0.0: renames need a major version, new optional parameters and new tools are minor versions, and description-only changes are patch versions that are still listed here.

## [Unreleased]

### Fixed

- `quote_clip_job`: a call with neither `source_url` nor `job_id` (for example `url` instead of `source_url`) now gets "Give exactly one of source_url (new video) or job_id (recut)." instead of a message that said "not both".

## [1.0.0] - 2026-10-15

### Added

- 19 tools in six toolsets:
  - account: `get_account`, `get_options_guide`;
  - clips: `check_video_source`, `quote_clip_job`, `create_clip_job`, `get_clip_job`, `list_clip_jobs`, `recut_clip_job`, `retry_clip_job`;
  - transcripts: `create_transcription`, `get_transcription`;
  - articles: `create_article`, `get_article`;
  - library: `search_broll`, `get_broll_asset`, `list_packs`, `get_pack`;
  - thumbnails: `create_youtube_thumbnails`, `get_youtube_thumbnails`.
- 5 prompts: `clip_video`, `podcast_to_shorts`, `video_to_blog_post`, `transcribe_video`, `review_recent_clips`.
- Resources: `mnogoreels://guide/options`, `mnogoreels://guide/pricing`, `mnogoreels://guide/workflow` and the templates `mnogoreels://clip-jobs/{job_id}`, `mnogoreels://transcriptions/{transcription_id}`, `mnogoreels://articles/{article_id}`.
- Spending safety: free quotes, mandatory `max_credits`, operator credit cap, 30-minute limit per job, duplicate-submit guard, confirmation through form elicitation where the client supports it.
- Profiles `default` (19 tools), `readonly` (13) and `directory` (17), toolset selection and read-only mode through environment variables or HTTP headers.
- Transports: stdio (`npx -y mnogoreels-mcp@latest`) and Streamable HTTP, serving MCP 2026-07-28 and 2025-era clients from one server.
- Remote endpoint `https://mcp.mnogo-reels.ru/mcp` (plus `/mcp/readonly` and `/mcp/directory`), server card at `/.well-known/mcp/server-card.json`.
- Packaging: npm package, multi-arch image `ghcr.io/realsatanyan/mnogoreels-mcp`, Claude Desktop bundle (`.mcpb`), Claude Code plugin and marketplace, Cursor plugin, Gemini CLI extension, Official MCP Registry entry `ru.mnogo-reels/mnogoreels`.

[Unreleased]: https://github.com/RealSatanyan/mnogoreels-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/RealSatanyan/mnogoreels-mcp/releases/tag/v1.0.0
