# Directory submissions

Where the MnogoReels MCP server is listed, in submission order after the first release, with the exact texts to paste. Keep this file in sync when a listing changes.

## Status (2026-10-19)

| # | Directory | State |
| --- | --- | --- |
| 1 | npm | Live: `mnogoreels-mcp@1.0.0` |
| 2 | Official MCP Registry | Live: `ru.mnogo-reels/mnogoreels` 1.0.0 |
| 3 | GitHub MCP Registry / VS Code | Email sent to partnerships@github.com (cc support@) |
| 4 | Glama | Server indexed (quality A, license A, maintenance B); connector page live; claiming both needs GitHub login |
| 5 | awesome-mcp-servers | [PR #16540](https://github.com/punkpeye/awesome-mcp-servers/pull/16540) |
| 6 | awesome-remote-mcp-servers | [PR #2265](https://github.com/punkpeye/awesome-remote-mcp-servers/pull/2265) |
| 7 | Smithery | Needs `smithery auth login` (browser) |
| 8 | Gemini CLI gallery | Automatic (topic + `gemini-extension.json`) |
| 9 | Docker MCP Catalog | [PR #5735](https://github.com/docker/mcp-registry/pull/5735); reviewer key on request |
| 10 | Cline Marketplace | [Issue #3017](https://github.com/cline/mcp-marketplace/issues/3017) |
| 11 | mcp.so | [Issue #5451](https://github.com/chatmcp/mcpso/issues/5451) |
| 12 | mcpservers.org / MCP Market | Submitted (free queues); LobeHub and PulseMCP automatic |
| 13 | Claude plugin directory | Unblocked: privacy section shipped; submit at claude.ai/directory/manage (login) |
| 14 | Cursor Marketplace / cursor.directory | Needs login |
| 15 | Goose | Directory retired in favour of the official MCP Registry (PR #12924 closed); covered by item 2 |
| 16 | mcpdb.ru | Their form returns HTTP 500; retry later |
| 17 | neuraldeep.ru | Needs Yandex login |

## Before you start

- Release `v1.0.0` is published (npm, GHCR, GitHub Release with the `.mcpb`, Official MCP Registry). See [release.md](release.md).
- **Remote-based listings** (items 6, 7, 9 remote entry, 11, 13, 14 and 16) are submitted only after `https://mcp.mnogo-reels.ru` resolves and the post-deploy checks of [deploy-coolify.md](deploy-coolify.md) (step 8) pass on the real name. The release `registry` job runs the same preflight.
- Reviewer access: directories that test tools need a key. Use the dedicated `mcp-reviewer` key of the review account (about 30 credits, one completed short job with an article), never a personal key. Share it only through the channel each directory names.
- Gateways and the probe budget: until backend follow-up A1 ships, keyless calls that arrive through a gateway (Smithery, Yandex AI Studio, n8n cloud) share the anonymous video-check budget of that gateway's IP address (20 checks per minute at `api.mnogo-reels.ru`). Calls that carry a key are bucketed per key, so users should always configure their key.

## Canonical texts

Use these everywhere unless a directory section below says otherwise.

| Field | Text |
| --- | --- |
| Name | MnogoReels |
| Registry name | `ru.mnogo-reels/mnogoreels` |
| Short description (90 chars) | Turn long videos into captioned vertical shorts, transcripts and articles with MnogoReels. |
| Repository | https://github.com/RealSatanyan/mnogoreels-mcp |
| Website | https://mnogo-reels.ru |
| Remote URL | `https://mcp.mnogo-reels.ru/mcp` (read-only: `https://mcp.mnogo-reels.ru/mcp/readonly`) |
| npm | `mnogoreels-mcp` (`npx -y mnogoreels-mcp@latest`) |
| Image | `ghcr.io/realsatanyan/mnogoreels-mcp` |
| Authentication | API key in `Authorization: Bearer <key>` or `X-API-Key: <key>`; keys at https://mnogo-reels.ru/dashboard/developers?tab=keys |
| Tags | video, shorts, reels, clips, captions, transcription, youtube |
| Support | support@mnogo-reels.ru, https://github.com/RealSatanyan/mnogoreels-mcp/issues |
| Privacy policy | https://mnogo-reels.ru/privacy-policy |
| Terms | https://mnogo-reels.ru/terms |
| Logo | `assets/icon-512.png` (512×512), `assets/logo-400.png` (400×400), `assets/icon-192.png`, `assets/icon-64.png` |

Long description (English, under 2,000 characters):

> MnogoReels turns long videos into vertical short clips for YouTube Shorts, Instagram Reels and TikTok. This MCP server lets any AI assistant drive it with your own MnogoReels API key: give it a YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk, Google Drive or direct video link, and it picks the best moments, reframes them to 9:16 with smart crop, burns in captions (23 styles) and a hook title, and can add cold-open hooks, story arcs, music and B-roll. It also creates timed transcripts and SRT subtitles, long-form articles with chapters, and YouTube thumbnails, searches your B-roll library and the shared stock catalog, and reads publication packs made on the website.
>
> Spending is safe by design: a free quote tool uses the same formula as the backend (1 credit per started minute, at most 30 minutes per job), every paid call needs an explicit max_credits limit, operators can set a hard cap, identical requests within 10 minutes are not charged twice, and clients that support MCP elicitation get a confirmation dialog. A read-only endpoint hides every tool that spends credits. Text from videos is fenced as untrusted content. Works locally over stdio (npx, Docker, Claude Desktop bundle) or as a hosted Streamable HTTP server, for MCP 2026-07-28 and 2025-era clients.

Long description (Russian):

> MnogoReels нарезает длинные видео на вертикальные клипы для YouTube Shorts, Reels и TikTok. Этот MCP-сервер даёт любому ИИ-ассистенту управлять сервисом с вашим собственным API-ключом MnogoReels: дайте ссылку на YouTube, VK Видео, RuTube, Дзен, Twitch, Яндекс Диск, Google Диск или прямую ссылку на файл — сервер выберет лучшие моменты, переведёт их в 9:16 с умным кадрированием, наложит субтитры (23 стиля) и заголовок-хук, а при желании добавит cold-open хуки, сюжетную арку, музыку и B-roll. Также он делает транскрипты с таймкодами и субтитры SRT, статьи с главами и обложки для YouTube, ищет B-roll в вашей библиотеке и в общем стоковом каталоге и читает пакеты публикации, созданные на сайте.
>
> Расходы под контролем: бесплатный расчёт цены по той же формуле, что и на бэкенде (1 кредит за начатую минуту, не больше 30 минут на задачу), обязательный лимит max_credits в каждом платном вызове, жёсткий лимит оператора, защита от повторного списания за одинаковые запросы в течение 10 минут и окно подтверждения в клиентах с поддержкой MCP elicitation. Отдельный адрес «только чтение» скрывает все платные инструменты. Текст из видео помечается как недоверенный. Работает локально через stdio (npx, Docker, пакет для Claude Desktop) или как облачный Streamable HTTP-сервер, для клиентов MCP 2026-07-28 и 2025 года.

## 1. npm

Automatic: the `npm` job of `release.yml` publishes `mnogoreels-mcp` with provenance. Nothing to submit.

## 2. Official MCP Registry

Automatic: the `registry` job of `release.yml` runs `mcp-publisher publish` with `server.json`. Prerequisite: the `v=MCPv1` TXT record on `mnogo-reels.ru` (see [release.md](release.md)). Check: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=ru.mnogo-reels/mnogoreels"`.

Downstream directories that read the registry automatically: PulseMCP, Glama connectors, vibecoding.ru/mcp.

## 3. GitHub MCP Registry / VS Code `@mcp` gallery

Email to `partnerships@github.com` after item 2 is live.

Subject: `Inclusion request: ru.mnogo-reels/mnogoreels (MnogoReels MCP server)`

```text
Hello,

we would like the MnogoReels MCP server to be included in the GitHub MCP Registry and the VS Code @mcp gallery.

Official MCP Registry name: ru.mnogo-reels/mnogoreels
Repository: https://github.com/RealSatanyan/mnogoreels-mcp (MIT)
Remote endpoint: https://mcp.mnogo-reels.ru/mcp (Streamable HTTP, API key in the Authorization header)
npm package: mnogoreels-mcp

MnogoReels turns long videos into vertical short clips for YouTube Shorts, Reels and TikTok. The MCP server lets an assistant check a video link, quote the price, create clip jobs with captions and hooks, follow their progress, and create transcripts, articles and YouTube thumbnails, using the user's own MnogoReels API key. Every tool has a title, all four annotations and an output schema; paid tools require an explicit credit limit, and a read-only endpoint is available.

Maintainer: MnogoReels, support@mnogo-reels.ru (GitHub: RealSatanyan)

Thank you!
```

## 4. Glama

- Indexing is automatic. Sign in at https://glama.ai with the GitHub account `RealSatanyan` and claim the server; Glama reads `glama.json` from the repository root.
- In the Glama server admin, configure the Docker build to use the repository `Dockerfile` with its default command (stdio). The server starts and lists tools without a key.
- The remote connector appears from the registry as `https://glama.ai/mcp/connectors/ru.mnogo-reels/mnogoreels`. Claim it: Glama fetches `https://mcp.mnogo-reels.ru/.well-known/glama.json`, which the hosted server serves with the same maintainers list.

## 5. awesome-mcp-servers

Pull request to `punkpeye/awesome-mcp-servers`, section **🎥 Multimedia Process**, in alphabetical order. If the pull request is opened by an agent, append ` 🤖🤖🤖` to its title.

Pull request title: `Add MnogoReels MCP server`

Line:

```markdown
- [RealSatanyan/mnogoreels-mcp](https://github.com/RealSatanyan/mnogoreels-mcp) [![RealSatanyan/mnogoreels-mcp MCP server](https://glama.ai/mcp/servers/RealSatanyan/mnogoreels-mcp/badges/score.svg)](https://glama.ai/mcp/servers/RealSatanyan/mnogoreels-mcp) 🎖️ 📇 ☁️ 🏠 🍎 🪟 🐧 - Turn long videos into captioned vertical shorts with MnogoReels: AI clip selection, 9:16 reframing, captions, hooks, transcripts and articles; RU/EN.
```

## 6. awesome-remote-mcp-servers

Prerequisite: the Glama connector of item 4 exists. Pull request to `punkpeye/awesome-remote-mcp-servers`.

Pull request title: `Add MnogoReels remote MCP server 🤖🤖🤖` when opened by an agent; the account opening it must star the repository. Three-line entry under **Multimedia**:

Line:

```markdown
- [MnogoReels](https://mnogo-reels.ru) `https://mcp.mnogo-reels.ru/mcp`
  [![MnogoReels MCP connector](https://glama.ai/mcp/connectors/ru.mnogo-reels/mnogoreels/badges/score.svg)](https://glama.ai/mcp/connectors/ru.mnogo-reels/mnogoreels)
  🔓 - Turn long videos into captioned vertical shorts, transcripts and articles with your own API key.
```

## 7. Smithery

URL publish of the hosted server; commands and checks are in [`smithery/README.md`](../smithery/README.md):

```bash
npm i -g smithery@latest
smithery auth login
smithery namespace use mnogoreels
smithery mcp publish "https://mcp.mnogo-reels.ru/mcp" -n mnogoreels/mnogoreels --config-schema "$(cat smithery/config-schema.json)"
```

Then upload `assets/icon-512.png` and confirm that `SmitheryBot/1.0` gets HTTP 200 on `https://mcp.mnogo-reels.ru/.well-known/mcp/server-card.json`. Optional: a local listing `mnogoreels/mnogoreels-local` from the `.mcpb` release asset.

## 8. Gemini CLI extension gallery

Automatic daily crawl of public repositories that have the topic `gemini-cli-extension` (set by `gh repo edit`, see [release.md](release.md)) and `gemini-extension.json` at the repository root. Nothing to submit.

## 9. Docker MCP Catalog

1. Fork `docker/mcp-registry`.
2. Copy `docker-mcp-registry/local/*` to `servers/mnogoreels/` and `docker-mcp-registry/remote/*` to `servers/mnogoreels-remote/`.
3. In `servers/mnogoreels/server.yaml` replace `RELEASE_COMMIT_SHA` with the full SHA of the release commit (`git rev-parse v1.0.0^{commit}`).
4. Run `task build -- --tools mnogoreels` and `task catalog -- mnogoreels`, and check the tools load (`docker mcp catalog import …`, then `docker mcp catalog reset`).
5. Open the pull request with the title `Add MnogoReels (local and remote)` and this body:

```text
Adds MnogoReels: turn long videos into captioned vertical shorts, transcripts and articles.

- servers/mnogoreels: local stdio server built from https://github.com/RealSatanyan/mnogoreels-mcp (MIT), category video. Lists tools without a key; tool calls need MNOGOREELS_API_KEY.
- servers/mnogoreels-remote: the hosted Streamable HTTP endpoint https://mcp.mnogo-reels.ru/mcp with the key in the Authorization header.

tools.json files are generated from the server's own tool definitions. A reviewer API key is shared through the test-credentials form.
```

6. Share the `mcp-reviewer` key through https://forms.gle/6Lw3nsvu2d6nFg8e6.

## 10. Cline MCP Marketplace

Issue in `cline/mcp-marketplace` using the server submission form.

- Title: `[Server Submission]: MnogoReels`
- GitHub repository URL: `https://github.com/RealSatanyan/mnogoreels-mcp`
- Logo: upload `assets/logo-400.png` (400×400 PNG)
- Tick: "Cline can set up this server using only README.md and/or llms-install.md" and "stable and ready"
- Additional information:

```text
MnogoReels turns long videos (YouTube, VK Video, RuTube, Dzen, Twitch, Yandex Disk, Google Drive, direct links) into captioned vertical shorts, transcripts and articles with the user's own API key. Install either locally (npx -y mnogoreels-mcp@latest with MNOGOREELS_API_KEY) or as a remote Streamable HTTP server (https://mcp.mnogo-reels.ru/mcp, type "streamableHttp", Authorization: Bearer header). llms-install.md has both exact cline_mcp_settings.json blocks and a verification step (get_account returns authenticated: true). Paid tools require an explicit credit limit; checks, quotes, transcripts and articles are free.
```

## 11. mcp.so

Issue in `chatmcp/mcpso` titled `Submit Remote MCP Server: MnogoReels`:

```text
Name: MnogoReels
Type: Remote + npm (stdio)
Remote URL: https://mcp.mnogo-reels.ru/mcp
Authentication: API key as "Authorization: Bearer <key>" header (or "X-API-Key: <key>"); keys at https://mnogo-reels.ru/dashboard/developers?tab=keys
Repository: https://github.com/RealSatanyan/mnogoreels-mcp
Website: https://mnogo-reels.ru
Description: Turn long videos into captioned vertical shorts, transcripts and articles with MnogoReels.
Tags: video, shorts, reels, captions, transcription, youtube
Support: support@mnogo-reels.ru

Remote config:
{
  "mcpServers": {
    "mnogoreels": {
      "type": "http",
      "url": "https://mcp.mnogo-reels.ru/mcp",
      "headers": { "Authorization": "Bearer mrfrt_usr_YOUR_KEY" }
    }
  }
}

Local config:
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

## 12. MCP Market, mcpservers.org, LobeHub, PulseMCP

- **MCP Market** (https://mcpmarket.com/submit): repository URL `https://github.com/RealSatanyan/mnogoreels-mcp` and the email support@mnogo-reels.ru.
- **mcpservers.org** (https://mcpservers.org/submit):
  - Name: `MnogoReels`
  - Category: `Other`
  - Short description: the canonical short description
  - Repository: `https://github.com/RealSatanyan/mnogoreels-mcp`
  - Registry name: `ru.mnogo-reels/mnogoreels`
  - Remote: ticked, URL `https://mcp.mnogo-reels.ru/mcp`
  - Email: support@mnogo-reels.ru
- **LobeHub** (https://lobehub.com/mcp): indexed automatically from the README; if a "claim" option appears, claim it with the `RealSatanyan` GitHub account.
- **PulseMCP**: imported automatically from the Official MCP Registry.

## 13. Claude plugin directory

The privacy policy has the "4.1 Developer API and integrations (MCP)" section since 2026-10-15; the directory checks the privacy URL.

claude.ai/directory/manage → Submit new → **Plugin bundle** → repository `RealSatanyan/mnogoreels-mcp`, plugin path `plugins/mnogoreels`.

- Name: `MnogoReels`
- One-liner (≤ 200 characters): `Turn long videos into captioned vertical shorts, transcripts and articles with MnogoReels.`
- Description (≤ 2,000 characters): the canonical English long description
- Categories: Media, Productivity
- Docs: `https://github.com/RealSatanyan/mnogoreels-mcp#readme`; privacy: `https://mnogo-reels.ru/privacy-policy`; support: `support@mnogo-reels.ru`; icon: `plugins/mnogoreels/logo.png`

Before submitting, run `claude plugin validate plugins/mnogoreels` and `claude plugin validate .` (marketplace). The plugin talks only to the hosted server and contains no secrets.

## 14. Cursor Marketplace and cursor.directory

- **Cursor Marketplace** (https://cursor.com/marketplace/publish): repository `https://github.com/RealSatanyan/mnogoreels-mcp`, plugin path `plugins/cursor`. Description: the canonical short description; long description: the canonical English long description. The plugin reads the key from the user's `MNOGOREELS_API_KEY` environment variable.
- **cursor.directory** (sign in, then submit an MCP server):
  - Name: `MnogoReels`
  - Description: the canonical short description
  - Repository / link: `https://github.com/RealSatanyan/mnogoreels-mcp`
  - Install link: `https://cursor.com/en/install-mcp?name=mnogoreels&config=eyJ1cmwiOiJodHRwczovL21jcC5tbm9nby1yZWVscy5ydS9tY3AiLCJoZWFkZXJzIjp7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D`
  - Config: the remote `mcpServers` block from item 11

## 15. Goose extensions directory

Retired: Goose no longer accepts third-party entries in `servers.json` and reads the official MCP Registry instead (https://github.com/aaif-goose/goose/discussions/10830). Kept for reference.

Pull request to the Goose repository adding this entry to `documentation/static/servers.json` (keep the file's ordering):

```json
{
  "id": "mnogoreels",
  "name": "MnogoReels",
  "description": "Turn long videos into captioned vertical clips, transcripts and articles",
  "command": "npx -y mnogoreels-mcp@latest",
  "link": "https://github.com/RealSatanyan/mnogoreels-mcp",
  "installation_notes": "Requires a MnogoReels API key from https://mnogo-reels.ru/dashboard/developers?tab=keys",
  "is_builtin": false,
  "endorsed": false,
  "environmentVariables": [
    {
      "name": "MNOGOREELS_API_KEY",
      "description": "MnogoReels API key (mrfrt_usr_...)",
      "required": true
    }
  ]
}
```

Pull request title: `Add MnogoReels extension`.

## 16. Russian ecosystem

Russian-speaking users are the main audience; the hosted endpoint with a static header is what Yandex, Cloud.ru, GigaChain and n8n users need.

Listing text (use for every RU catalog):

> MnogoReels — нарезка длинных видео на вертикальные клипы с субтитрами и хуками, транскрипты и статьи. Подключение: https://mcp.mnogo-reels.ru/mcp, заголовок Authorization: Bearer <ключ из mnogo-reels.ru/dashboard/developers>.

### Yandex AI Studio — MCP Hub

User-side connection (also in [`examples/yandex-ai-studio.md`](../examples/yandex-ai-studio.md)):

1. Создайте API-ключ на https://mnogo-reels.ru/dashboard/developers?tab=keys.
2. В AI Studio откройте **MCP Hub** → **Создать MCP-сервер** → **Внешний MCP-сервер**.
3. Имя: `mnogoreels`; URL: `https://mcp.mnogo-reels.ru/mcp`; транспорт: Streamable HTTP.
4. Авторизация: дополнительный заголовок `Authorization` со значением `Bearer mrfrt_usr_ВАШ_КЛЮЧ`.
5. Сохраните сервер и подключите его к агенту. Список из 19 инструментов загрузится без ключа; для вызовов ключ обязателен.

Partner template (business process, no repository artifact): write to the Yandex Cloud partner contact:

```text
Здравствуйте!

Мы — MnogoReels (https://mnogo-reels.ru), сервис нарезки длинных видео на вертикальные клипы. У нас есть публичный MCP-сервер, который пользователи уже подключают в AI Studio как внешний: https://mcp.mnogo-reels.ru/mcp (Streamable HTTP, авторизация заголовком Authorization: Bearer <ключ пользователя>). Он умеет проверять ссылки на видео, считать стоимость, создавать задачи нарезки с субтитрами и хуками, делать транскрипты, статьи и обложки для YouTube. Код открыт: https://github.com/RealSatanyan/mnogoreels-mcp (MIT), сервер опубликован в официальном реестре MCP как ru.mnogo-reels/mnogoreels.

Хотим добавить его в MCP Hub как партнёрский шаблон, чтобы пользователям достаточно было вставить свой API-ключ. Подскажите, пожалуйста, порядок подачи и требования.

Контакт: support@mnogo-reels.ru
```

### Cloud.ru Evolution AI Agents

Users add the server themselves: AI Agents → MCP-серверы → добавить по URL `https://mcp.mnogo-reels.ru/mcp` с заголовком `Authorization: Bearer <ключ>`. For a marketplace listing, use the «Партнерство с Cloud.ru» link with the same listing text.

### GigaChain (Sber)

No catalog; the README and [`examples/gigachain.py`](../examples/gigachain.py) show the `langchain-mcp-adapters` connection.

### mcpdb.ru

Form «Предложить сервер»:

- Название: `MnogoReels`
- Ссылка на репозиторий: `https://github.com/RealSatanyan/mnogoreels-mcp`
- Описание: the RU listing text above
- Категория: Видео / Медиа
- Тип подключения: удалённый (Streamable HTTP) и локальный (npx)
- Контакт: support@mnogo-reels.ru

### neuraldeep.ru/mcp

Button «Добавить навык»:

- Название: `MnogoReels`
- Описание: the RU listing text above
- Ссылка: `https://github.com/RealSatanyan/mnogoreels-mcp`
- Адрес сервера: `https://mcp.mnogo-reels.ru/mcp`
- Авторизация: заголовок `Authorization: Bearer <ключ>`

### mcp-catalog.ru and vibecoding.ru/mcp

Automatic: mcp-catalog.ru mirrors awesome-mcp-servers (item 5) weekly; vibecoding.ru/mcp is built from the Official MCP Registry (item 2).

## 17. Not in v1

- **Claude Connectors Directory**: requires OAuth 2.1 (backend follow-up A16); AI media generation also needs a policy review.
- **ChatGPT plugin directory**: does not accept API-key or static-header authentication; requires OAuth (A16).
