# Releasing

Maintainer guide: one-time setup, the first-release bootstrap, the regular release flow and rollback. Releases are cut from tags `vX.Y.Z` by `.github/workflows/release.yml`; nothing is published from a laptop except the steps marked "one time".

## Versioning rules

- `package.json` `version` is the single source of truth. `npm run version:sync` copies it into `src/version.ts`, `server.json` (version, npm/OCI/MCPB package entries), `mcpb/manifest.json`, `gemini-extension.json` (pinned `npx` argument), both plugin manifests and `.claude-plugin/marketplace.json`. `npm run version:check` fails CI on any mismatch and also when `server.json` has a malformed `fileSha256` or `repository.id`.
- Registry versions are immutable. Tool names and input schemas are frozen since 1.0.0: renames need a major bump plus an alias; new optional parameters and new tools are minor; description-only changes are patch releases and are still listed in `CHANGELOG.md`.
- 1.0.0 is tagged only after the live end-to-end run (below) passes.

## One-time setup

### GitHub repository

```bash
gh repo edit RealSatanyan/mnogoreels-mcp \
  --description "MCP server for MnogoReels: long videos → captioned vertical shorts, transcripts, articles" \
  --homepage https://mnogo-reels.ru \
  --add-topic mcp,mcp-server,model-context-protocol,video,shorts,reels,youtube,gemini-cli-extension
```

`server.json` must contain the numeric repository id (constant for the repository). It is committed, never injected at release time:

```bash
gh api repos/RealSatanyan/mnogoreels-mcp --jq .id    # 1419613794, already in server.json
```

Enable private vulnerability reporting (Settings → Code security → Private vulnerability reporting), which `SECURITY.md` refers to.

### `release` environment and secrets

Settings → Environments → **New environment** `release`:

- Deployment branches and tags: **Selected branches and tags** with two rules: branch `main` (manual runs of `release.yml` with `bootstrap: true` and of `e2e.yml` start from `main`) and tag pattern `v*` (tag releases). Anything else, such as a pull request branch, cannot reach the secrets.
- **Required reviewers**: at least one maintainer.
- Variables (environment variables, not secrets):

| Variable | Purpose |
| --- | --- |
| `MNOGOREELS_REMOTE_HEALTHZ_URL` | Optional. Health URL that `deploy-remote` polls until it reports the new version. Default `https://mcp.mnogo-reels.ru/healthz`; set it to `https://mcp.185.93.105.71.sslip.io/healthz` while the hosted server runs on the interim sslip name ([deploy-coolify.md](deploy-coolify.md)) and delete it after the DNS switch. |

- Secrets (all in this environment, none at repository level):

| Secret | Purpose |
| --- | --- |
| `NPM_TOKEN` | First npm publish only. Afterwards switch to npm trusted publishing (OIDC) and delete it. |
| `MCP_REGISTRY_PRIVATE_KEY` | Ed25519 private key (hex) for `mcp-publisher login dns --domain mnogo-reels.ru`. |
| `COOLIFY_DEPLOY_WEBHOOK` | Optional: Coolify deploy webhook URL of the hosted server. |
| `COOLIFY_API_TOKEN` | Coolify API token with the **deploy** ability only. |
| `MNOGOREELS_E2E_API_KEY` | Only for the manual `e2e.yml` workflow (the dedicated `mcp-smoke` key). |

Never use `pull_request_target` and never run release jobs on self-hosted runners.

### npm

The first version is published with a token, because npm trusted publishing can only be configured for a package that already exists. Every later version is published over OIDC without any stored secret.

1. Create or use the npm account that will own `mnogoreels-mcp`; enable 2FA.
2. First publish: either publish the `verify` tarball by hand with an OTP (`npm publish mnogoreels-mcp-X.Y.Z.tgz --access public --provenance=false --otp=…`; the `npm` job then skips the version it finds on npm), or create a granular access token with read and write access (the package does not exist yet, so it has to cover all packages of the account), short expiry, and store it as the `NPM_TOKEN` secret of the `release` environment. The `npm` job passes it as `NODE_AUTH_TOKEN` and publishes the tarball built in `verify` with `--provenance`.
3. Right after 1.0.0 is on npm, switch to trusted publishing: npmjs.com → `mnogoreels-mcp` → Settings → **Trusted publisher** → GitHub Actions with organization or user `RealSatanyan`, repository `mnogoreels-mcp`, workflow filename `release.yml` and environment `release`. Optionally set "Publishing access" to require 2FA and disallow tokens.
4. Delete the `NPM_TOKEN` secret and revoke the token on npmjs.com. The workflow needs no change: `NODE_AUTH_TOKEN` then expands to an empty value, and npm (11.5.1 or newer, shipped with Node 24 in the job) exchanges the job's OIDC token (`id-token: write`) for a short-lived publish token. Provenance keeps working.
5. Check the next release: the npm page of the new version shows "Published via GitHub Actions" with a provenance link to `release.yml`.

### Official MCP Registry key (DNS authentication)

The namespace `ru.mnogo-reels/*` is proven by a TXT record on `mnogo-reels.ru` (in place since 2026-10-15). Generate the key pair on a trusted machine with OpenSSL 3:

```bash
openssl genpkey -algorithm Ed25519 -out mcp-registry-key.pem
PUBLIC_KEY="$(openssl pkey -in mcp-registry-key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}" > mcp-registry-auth
openssl pkey -in mcp-registry-key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n'
```

- Paste the printed hex private key into the `MCP_REGISTRY_PRIVATE_KEY` secret, then delete `mcp-registry-key.pem` (keep an offline backup only if your policy requires one).
- Publish the content of `mcp-registry-auth` (public data only) as a TXT record on the apex `mnogo-reels.ru` in Cloudflare. Verify: `dig +short TXT mnogo-reels.ru` prints the `v=MCPv1; k=ed25519; p=…` line. A file at `https://mnogo-reels.ru/.well-known/mcp-registry-auth` with `login http` works too, but needs a website deploy.

### `mcp-publisher`

CI downloads `mcp-publisher_linux_amd64.tar.gz` v1.8.1 from https://github.com/modelcontextprotocol/registry/releases/tag/v1.8.1 and verifies it with `sha256sum -c` before use. To validate locally:

```bash
curl -fsSLO https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/mcp-publisher_linux_amd64.tar.gz
echo 'a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc  mcp-publisher_linux_amd64.tar.gz' | sha256sum -c
tar -xzf mcp-publisher_linux_amd64.tar.gz mcp-publisher
./mcp-publisher validate server.json
```

### Labels

Create the `mutation` label once (`gh label create mutation --description "Run Stryker mutation testing in CI" --color 5319e7`). Adding it to a pull request runs the `mutation` job of `ci.yml` (Stryker with `--concurrency 2`, break threshold 75 %, HTML report uploaded as the `mutation-report` artifact). The job also runs on the weekly schedule and on manual dispatch; it is not part of every push because a full run takes a long time.

## First release bootstrap

The OCI package entry of `server.json` is verified by the registry through the image label, so the GHCR package must exist and be public before the first registry publish.

1. Actions → `release.yml` → **Run workflow** with `bootstrap: true`. Only `verify` and `image` run, and the image is tagged `0.0.0-bootstrap` (no `stable`, no `latest`).
2. GitHub → Packages → `mnogoreels-mcp` → Package settings → **Change visibility → Public**. Check anonymous pulls: `curl -fsS 'https://ghcr.io/token?scope=repository:realsatanyan/mnogoreels-mcp:pull'`.
3. Optionally point the interim Coolify app at `ghcr.io/realsatanyan/mnogoreels-mcp:0.0.0-bootstrap` to test the deployment ([deploy-coolify.md](deploy-coolify.md)).
4. Run the live end-to-end tests with the review account (Actions → `e2e.yml`, first with `spend: false`, then once with `spend: true`, about 1 credit).
5. Tag `v1.0.0` as described below.

## Regular release

1. Make sure `main` is green and `CHANGELOG.md` has everything under `[Unreleased]`.
2. Bump the version and sync every manifest:

   ```bash
   npm version X.Y.Z --no-git-tag-version
   npm run version:sync
   npm run build && npm run metadata
   ```

3. In `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` with today's date, add a fresh empty `[Unreleased]` section on top and update the compare links at the bottom. The release job uses this section as the GitHub Release notes.
4. Commit (`chore(release): vX.Y.Z`), get it reviewed and merged, then tag the merge commit and push the tag:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. Approve the `release` environment when GitHub asks. The workflow then:
   - `verify`: checks the tag equals `package.json`, runs the full test suite, `version:check`, `metadata:check` and `mcp-publisher validate`, then builds the npm tarball with `npm shrinkwrap` + `npm pack`;
   - `npm`: publishes that tarball with provenance;
   - `image`: builds and pushes `linux/amd64` + `linux/arm64` images tagged `X.Y.Z`, `X.Y`, `X`, `latest` and `stable`, with provenance and SBOM;
   - `mcpb`: packs `mnogoreels-mcp-X.Y.Z.mcpb` and the unversioned `mnogoreels-mcp.mcpb` (the README one-click link), plus the `.sha256`, and attaches them to the GitHub Release;
   - `deploy-remote`: triggers the Coolify redeploy of `:stable` and waits until `https://mcp.mnogo-reels.ru/healthz` reports `X.Y.Z`;
   - `registry`: checks that GHCR allows anonymous pulls and that the hosted server serves `X.Y.Z` with 19 tools (if not, it publishes without `remotes` and warns), writes the real `fileSha256` of the bundle into `server.json`, validates and publishes to the Official MCP Registry, and checks the registry lists the version.
6. After the first release, submit the directories in [directories.md](directories.md). For later releases, only the Docker MCP Catalog entry needs a new `source.commit`.

## Rollback

| What | How |
| --- | --- |
| Hosted server | `docker buildx imagetools create -t ghcr.io/realsatanyan/mnogoreels-mcp:stable ghcr.io/realsatanyan/mnogoreels-mcp:<previous X.Y.Z>`, then trigger the Coolify deploy webhook and run the checks in [deploy-coolify.md](deploy-coolify.md) step 8. |
| npm | `npm deprecate mnogoreels-mcp@X.Y.Z "Broken release, use X.Y.W"` and publish a fixed patch release. Never unpublish. |
| Official MCP Registry | `./mcp-publisher login dns --domain mnogo-reels.ru --private-key "$MCP_REGISTRY_PRIVATE_KEY"` then `./mcp-publisher status --status deprecated --message "Use X.Y.W" ru.mnogo-reels/mnogoreels X.Y.Z`. Registry versions are immutable; publish a fixed version. |
| GitHub Release / `.mcpb` | Mark the release as a pre-release or delete its assets; re-run the `mcpb` job of the previous tag to restore the unversioned `mnogoreels-mcp.mcpb` if needed. |
