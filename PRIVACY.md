# Privacy

This document explains what the MnogoReels MCP server (`mnogoreels-mcp`) does with your data. It covers the software in this repository and the hosted endpoint `https://mcp.mnogo-reels.ru`. What MnogoReels itself does with your videos, clips and account is governed by the MnogoReels [privacy policy](https://mnogo-reels.ru/privacy-policy) and [terms of service](https://mnogo-reels.ru/terms).

## What is sent where

**Local server** (`npx mnogoreels-mcp`, the Claude Desktop bundle, the Docker image): tool arguments (video links, options, ids) and your API key go only to the MnogoReels API at `https://api.mnogo-reels.ru` (or the URL you set in `MNOGOREELS_API_URL`). Nothing goes to any other service. The local server writes its logs to standard error on your own machine.

**Hosted server** (`https://mcp.mnogo-reels.ru/mcp`): your client sends tool arguments and your API key to `mcp.mnogo-reels.ru`, which forwards them to `https://api.mnogo-reels.ru` to perform the request and returns the result to your client.

For the anonymous video checks used by `check_video_source` and `quote_clip_job`, the hosted server forwards your IP address to `api.mnogo-reels.ru` for rate limiting, or, when your request carries a valid-looking key, a pseudonym derived from a hash of the key instead of the IP address.

**Third-party gateways:** if you connect through a gateway such as Smithery, Yandex AI Studio or n8n cloud, that gateway handles your key and your requests in transit under its own privacy terms.

**Links in results:** links to finished clips, article images and your own B-roll point to MnogoReels storage (Cloudflare R2); shared stock items link to the MnogoReels website; video thumbnails and stock attribution links may point to the original platform. Opening a link is a direct request from your device to that host.

## What the hosted server logs

Per tool call or HTTP request: timestamp, tool name or path (never the query string), outcome code, HTTP status, latency, the first 8 hex characters of the SHA-256 hash of the API key, and an IP address prefix (/24 for IPv4, /48 for IPv6).

It never logs API keys, `Authorization` or `X-API-Key` headers, tool arguments, video links, prompts, results or backend error texts. These logs are kept according to the container log retention of the hosting platform.

The reverse proxy in front of the server (Traefik on the MnogoReels Coolify host) may log full client IP addresses and request paths according to its own retention.

## What is not collected

- No telemetry or analytics of any kind are sent anywhere, by either the local or the hosted server.
- The hosted server does not write API keys, prompts, tool arguments or results to disk or to any database. Keys are held in memory only for the duration of the request that carries them. A short-lived in-memory cache (10 minutes) holds video-check results and the ids of recently created jobs, keyed by a hash of your key (or by your IP address when no key is sent), to avoid repeated checks and duplicate charges. It is not shared between users and is lost on restart.

## Data kept by MnogoReels

Jobs you create through this server are stored in your MnogoReels account like jobs created on the website. On the free plan, clip files are deleted after 30 days. See the [privacy policy](https://mnogo-reels.ru/privacy-policy) for details.

## Contact

Questions or requests about privacy: support@mnogo-reels.ru.
