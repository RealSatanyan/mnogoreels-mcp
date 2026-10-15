# Security policy

## Supported versions

Only the latest minor release of `mnogoreels-mcp` receives security fixes. The hosted server at `https://mcp.mnogo-reels.ru` always runs a supported release.

| Version | Supported |
| --- | --- |
| latest 1.x minor | yes |
| older releases | no, upgrade to the latest minor |

## Reporting a vulnerability

Please report vulnerabilities privately, never in a public issue:

- GitHub: open the [Security tab](https://github.com/RealSatanyan/mnogoreels-mcp/security) of this repository and click **Report a vulnerability** (GitHub Security Advisories), or
- email support@mnogo-reels.ru with the subject "Security: mnogoreels-mcp".

Include the affected version, how to reproduce the problem and its impact. Do not include real API keys; if a key was exposed, revoke it at https://mnogo-reels.ru/dashboard/developers?tab=keys first. We aim to answer within 5 business days and will keep you informed until a fix is released. We are happy to credit reporters in the release notes.

## How API keys are handled

- A key is read from `MNOGOREELS_API_KEY` (local server) or from the `Authorization: Bearer` / `X-API-Key` request header (hosted server). The hosted server ignores `MNOGOREELS_API_KEY`, so it never spends an operator key on behalf of callers.
- Keys are never accepted in URLs. The hosted server rejects requests whose query string contains a key or a key-like parameter (`api_key`, `token`, `authorization`, …) with HTTP 400 and does not log the URL.
- Keys are never logged in any form. Logs contain at most the first 8 hex characters of the key's SHA-256 hash, to tell callers apart. Error messages pass through a redaction step that masks anything that looks like a key.
- `get_account` shows only a masked hint (`mrfrt_usr_…` plus the last 4 characters).
- Service keys (`mrfrt_svc_…`) are rejected: only personal user keys are accepted.
- The hosted server keeps a key only in memory for the duration of the request that carries it. It stores no keys, prompts or results.
- The key is sent only to the configured MnogoReels API (`https://api.mnogo-reels.ru` by default). Media links returned to the client never carry the key.

## Spending safety

Only `create_clip_job` and `recut_clip_job` spend credits. Before either sends a paid request:

1. the price is computed locally with the same formula the backend uses, on exactly the numbers that will be sent;
2. the processed range is at most 30 minutes, so nobody pays for minutes that would not be processed;
3. the price must not exceed the caller's `max_credits` (required) or the operator cap (`MNOGOREELS_MAX_CREDITS_PER_CALL` or the `X-MnogoReels-Max-Credits-Per-Call` header), which the model cannot raise;
4. the source must not be reported as undownloadable;
5. an identical request with the same key in the last 10 minutes returns the earlier result (or the earlier unknown outcome) instead of sending another paid request;
6. the user confirms through a form elicitation dialog where the transport can deliver one.

Where the confirmation dialog works:

| Transport and client | Confirmation dialog |
| --- | --- |
| Local server (stdio), any client with form elicitation | yes |
| Hosted server, client on MCP 2026-07-28 with form elicitation | yes |
| Hosted server, 2025-era clients | **no**: `max_credits`, the operator cap, the 30-minute limit, the duplicate guard and the client's own approval prompt for `destructiveHint: true` tools are the gates |

Paid requests are never retried automatically and are not aborted when the client disconnects, so their outcome is always recorded. Read-only mode (`MNOGOREELS_READ_ONLY=true`, `/mcp/readonly`, or the `X-MnogoReels-Read-Only: true` header) removes both paid tools entirely.

## Untrusted content

Text that comes from videos and third parties (titles, transcripts, articles, B-roll metadata, backend error details) is sanitized and wrapped in `<untrusted_source_text>` tags. Attempts to fake a closing tag, bidirectional-override and zero-width characters are removed. The server instructions tell the model to treat tagged text as data, never as instructions. Every outgoing URL is checked to be `http(s)`; anything else is dropped. The server never fetches user-supplied URLs itself.

## Hosted server hardening

- Host and Origin validation against DNS rebinding, per-IP and per-key rate limits, 1 MiB request bodies.
- The container runs as a non-root user with a read-only root filesystem, no Linux capabilities, `no-new-privileges`, and memory, CPU and process limits. `npm` is not present in the runtime image.

## Supply chain

- npm releases are published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) from a tarball built in CI with `npm ci --ignore-scripts`, and ship an `npm-shrinkwrap.json` that pins every transitive dependency for `npx` users.
- Container images on GHCR are multi-arch and published with build provenance and an SBOM; the base image is pinned by digest.
- GitHub Actions are pinned to commit SHAs; Dependabot updates npm packages, actions and the base image weekly.
- The package has three runtime dependencies (`@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `zod`) and no install scripts.

`mnogoreels-mcp@latest` updates automatically. If you do not want automatic updates, pin an exact version, for example `npx -y mnogoreels-mcp@1.0.0` or `ghcr.io/realsatanyan/mnogoreels-mcp:1.0.0`.
