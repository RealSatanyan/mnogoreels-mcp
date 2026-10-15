# Deploying the hosted server on Coolify

This is how `https://mcp.mnogo-reels.ru/mcp` runs. The Coolify host also runs the production MongoDB and the Next.js website, has limited free memory and a nearly full disk, and has had outages from resource exhaustion before. The container is therefore pulled as a prebuilt image (never built on the host), resource-limited and hardened.

## 1. Interim host (before DNS exists)

Only the owner can create the `mcp.mnogo-reels.ru` DNS record. Until it exists, deploy on the Coolify sslip name, where Let's Encrypt HTTP-01 works:

- domain: `https://mcp.185.93.105.71.sslip.io`
- `MNOGOREELS_ALLOWED_HOSTS=mcp.185.93.105.71.sslip.io,localhost,127.0.0.1`
- `MNOGOREELS_PUBLIC_URL=https://mcp.185.93.105.71.sslip.io/mcp`

Run every check of step 8 against it. **Do not publish any remote-based listing** (registry `remotes`, Smithery URL publish, awesome-remote-mcp-servers, the Docker remote entry, plugin `.mcp.json`) until step 2 is done and step 8 passes on the real name.

## 2. DNS

In the Cloudflare zone of `mnogo-reels.ru` (owner):

- `mcp` **A** record → `185.93.105.71`, **DNS only (grey cloud)**.
- Verify: `dig +short mcp.mnogo-reels.ru` must print `185.93.105.71`, not a Cloudflare address.

Do not enable the Cloudflare proxy: it would add the 125-second edge timeout, Bot Fight / browser-integrity rules and the throttling some Russian ISPs apply to Cloudflare traffic.

Then switch `MNOGOREELS_ALLOWED_HOSTS` to `mcp.mnogo-reels.ru,localhost,127.0.0.1`, `MNOGOREELS_PUBLIC_URL` to `https://mcp.mnogo-reels.ru/mcp`, set the Coolify domain to `https://mcp.mnogo-reels.ru` and remove the sslip host.

**Fallback** if the Helsinki IP turns out to be unreachable from Russian networks (open question C2): point `mcp` A to `88.218.95.27` (Caddy relay) with

```caddyfile
mcp.mnogo-reels.ru {
  reverse_proxy https://mcp.185.93.105.71.sslip.io {
    header_up Host mcp.185.93.105.71.sslip.io
  }
}
```

(Traefik and the app accept only the Coolify host name), keep `mcp.185.93.105.71.sslip.io` in `MNOGOREELS_ALLOWED_HOSTS`, and add the relay IP to Traefik `entryPoints.https.forwardedHeaders.trustedIPs` so Traefik forwards the real client IP instead of the relay's.

## 3. Resource type and image

Coolify → New resource → **Docker Image**:

- image: `ghcr.io/realsatanyan/mnogoreels-mcp`
- tag: **`stable`**

`stable` is a moving tag that `release.yml` pushes only after the `verify` job passed; `X.Y.Z` tags stay for pinning and rollback. Coolify's deploy API redeploys the configured image and tag (its `tag` parameter selects Coolify resource tags, not image tags), so an exact version tag would never upgrade.

## 4. Ports and domain

- Ports exposed: `8080`.
- Domain: the interim sslip name, later `https://mcp.mnogo-reels.ru`. Coolify generates the Traefik labels and the Let's Encrypt certificate.
- No custom Traefik buffering and no compression middleware on this router (gzip buffering can delay streamed progress events). Traefik streams SSE and has no response timeout by default.

## 5. Environment

```text
MNOGOREELS_TRANSPORT=http
MNOGOREELS_HOST=0.0.0.0
MNOGOREELS_PORT=8080
MNOGOREELS_PUBLIC_URL=https://mcp.mnogo-reels.ru/mcp
MNOGOREELS_ALLOWED_HOSTS=mcp.mnogo-reels.ru,localhost,127.0.0.1
MNOGOREELS_ALLOWED_ORIGINS=*
MNOGOREELS_TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12
```

`MNOGOREELS_TRUSTED_PROXIES` must cover the Docker network of the Coolify proxy (Traefik); adjust it to the actual network. **Do not set `MNOGOREELS_API_KEY`**: the hosted server ignores it (with a warning) because it must never spend an operator key on behalf of callers. Every caller sends their own key.

## 6. Resource limits and hardening

Coolify → Resource limits: memory `512m`, CPU `1`.

Coolify → Custom Docker Options:

```text
--pids-limit 256 --read-only --tmpfs /tmp:size=16m --cap-drop=ALL --security-opt=no-new-privileges --stop-timeout 60
```

The stop timeout of 60 seconds lets in-flight paid requests finish during a redeploy (the server waits up to 35 seconds for them, then up to 10 seconds for other requests).

Health check: path `/healthz`, port `8080`. Coolify runs `curl` inside the container; the image ships `curl` for this reason.

## 7. Image visibility

The GHCR package `ghcr.io/realsatanyan/mnogoreels-mcp` must be **public** so Coolify pulls it anonymously. This is done once during the bootstrap release ([release.md](release.md)).

## 8. Post-deploy verification

Deploy queues can wedge silently, so always check that the new version is actually running:

```bash
HOST=mcp.mnogo-reels.ru   # or the interim sslip name
curl -s "https://$HOST/healthz"                                  # {"status":"ok","version":"X.Y.Z"}
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli --transport http --server-url "https://$HOST/mcp" --method tools/list --format json | jq '.tools | length'            # 19
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli --transport http --server-url "https://$HOST/mcp/readonly" --method tools/list --format json | jq '.tools | length'   # 13
curl -s "https://$HOST/.well-known/mcp/server-card.json" | jq -r .name   # ru.mnogo-reels/mnogoreels
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://$HOST/mcp" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_clip_job","arguments":{}}}'   # 401
```

On the host: `docker inspect <container>` shows the memory limit, `ReadonlyRootfs: true` and the dropped capabilities. Host and Origin checks are covered by the test suite.

## 9. Verify proxy headers once

Send a request from a known IP, temporarily log the raw `X-Forwarded-For` / `X-Real-Ip` and the socket peer, and confirm that the derived client IP is the real one. Traefik replaces untrusted forwarded headers by default; the server reads them only from peers inside `MNOGOREELS_TRUSTED_PROXIES` and takes the right-most untrusted hop.

## 10. Egress

The container calls `https://api.mnogo-reels.ru` through Cloudflare with the user agent `mnogoreels-mcp/<version> (+https://github.com/RealSatanyan/mnogoreels-mcp)`. The CI user-agent smoke step checks that this agent gets JSON, not a Cloudflare HTML 403. Only `Python-urllib`, `libwww-perl` and AI-crawler agents have been seen blocked.

## 11. Deploy token for releases

Create a Coolify API token with the **deploy** ability only (never root or write) and store it as `COOLIFY_API_TOKEN` in the `release` GitHub environment, together with the deploy webhook URL as `COOLIFY_DEPLOY_WEBHOOK`. The `deploy-remote` job then triggers a redeploy of `:stable` with `force=true` and waits until `/healthz` reports the new version.

## 12. Traefik labels (reference)

Coolify generates equivalents from the domain field; these are listed for manual setups and review:

```text
traefik.enable=true
traefik.http.routers.mnogoreels-mcp-http.rule=Host(`mcp.mnogo-reels.ru`)
traefik.http.routers.mnogoreels-mcp-http.entrypoints=http
traefik.http.routers.mnogoreels-mcp-http.middlewares=redirect-to-https
traefik.http.routers.mnogoreels-mcp.rule=Host(`mcp.mnogo-reels.ru`)
traefik.http.routers.mnogoreels-mcp.entrypoints=https
traefik.http.routers.mnogoreels-mcp.tls=true
traefik.http.routers.mnogoreels-mcp.tls.certresolver=letsencrypt
traefik.http.services.mnogoreels-mcp.loadbalancer.server.port=8080
```

Traefik access logging for this router stays off or logs paths only, never query strings.

## Rollback

Point `:stable` back at the previous release and redeploy:

```bash
docker buildx imagetools create -t ghcr.io/realsatanyan/mnogoreels-mcp:stable ghcr.io/realsatanyan/mnogoreels-mcp:<previous X.Y.Z>
```

Then trigger the Coolify deploy webhook (or press Redeploy) and run step 8 again.
