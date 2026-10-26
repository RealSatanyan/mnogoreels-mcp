<!-- mcp-name: ru.mnogo-reels/mnogoreels -->

[English](README.md) | Русский

# MCP-сервер MnogoReels

MCP-сервер MnogoReels: нарезка длинных видео на вертикальные Shorts/Reels с субтитрами, транскрипты и статьи из любого MCP-клиента. Дайте ИИ-ассистенту ссылку на YouTube, VK Видео, RuTube, Дзен, Twitch, Яндекс Диск, Google Диск или прямую ссылку на файл — он выберет лучшие моменты, переведёт их в формат 9:16, наложит субтитры и заголовок-хук и вернёт ссылки на готовые клипы. Работа идёт через ваш собственный аккаунт [MnogoReels](https://mnogo-reels.ru).

[![npm version](https://img.shields.io/npm/v/mnogoreels-mcp)](https://www.npmjs.com/package/mnogoreels-mcp)
[![npm downloads](https://img.shields.io/npm/dm/mnogoreels-mcp)](https://www.npmjs.com/package/mnogoreels-mcp)
[![CI](https://github.com/RealSatanyan/mnogoreels-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/RealSatanyan/mnogoreels-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-blue)](https://modelcontextprotocol.io)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-ru.mnogo--reels%2Fmnogoreels-blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=ru.mnogo-reels/mnogoreels)
[![Glama score](https://glama.ai/mcp/servers/RealSatanyan/mnogoreels-mcp/badges/score.svg)](https://glama.ai/mcp/servers/RealSatanyan/mnogoreels-mcp)
[![LightNow capabilities](https://lightnow.ai/badge/ru.mnogo-reels/mnogoreels)](https://lightnow.ai/servers/ru.mnogo-reels/mnogoreels)
[![Docker image](https://img.shields.io/badge/ghcr.io-realsatanyan%2Fmnogoreels--mcp-2496ED?logo=docker&logoColor=white)](https://github.com/RealSatanyan/mnogoreels-mcp/pkgs/container/mnogoreels-mcp)

## Установка в один клик

| Клиент | Облачный сервер (ничего не нужно устанавливать) | Локальный сервер (Node.js 22+, `npx`) |
| --- | --- | --- |
| Cursor | [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=mnogoreels&config=eyJ1cmwiOiJodHRwczovL21jcC5tbm9nby1yZWVscy5ydS9tY3AiLCJoZWFkZXJzIjp7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D) | [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=mnogoreels&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1ub2dvcmVlbHMtbWNwQGxhdGVzdCJdLCJlbnYiOnsiTU5PR09SRUVMU19BUElfS0VZIjoiJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D) |
| VS Code | [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MnogoReels-0098FF?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D) | [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MnogoReels-0098FF?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D) |
| VS Code Insiders | [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_MnogoReels-24bfa5?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D&quality=insiders) | [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_MnogoReels-24bfa5?logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=mnogoreels&inputs=%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7Binput%3Amnogoreels_api_key%7D%22%7D%7D&quality=insiders) |
| Kiro | [![Add to Kiro](https://img.shields.io/badge/Kiro-Add_MnogoReels-7B3FE4)](https://kiro.dev/launch/mcp/add?name=mnogoreels&config=%7B%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7BMNOGOREELS_API_KEY%7D%22%7D%7D) | [![Add to Kiro](https://img.shields.io/badge/Kiro-Add_MnogoReels-7B3FE4)](https://kiro.dev/launch/mcp/add?name=mnogoreels&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7BMNOGOREELS_API_KEY%7D%22%7D%7D) |
| Claude Desktop | с API-ключом недоступно (см. ниже) | [![Download for Claude Desktop](https://img.shields.io/badge/Claude_Desktop-Download_.mcpb-D97757?logo=claude&logoColor=white)](https://github.com/RealSatanyan/mnogoreels-mcp/releases/latest/download/mnogoreels-mcp.mcpb) |
| Smithery | [Открыть в Smithery](https://smithery.ai/server/mnogoreels/mnogoreels) | |

Кнопки Cursor и Kiro берут ключ из переменной окружения MNOGOREELS_API_KEY: задайте её и перезапустите редактор либо замените ${env:…} на свой ключ в открывшемся конфиге. Кнопки VS Code сами спросят ключ.

<details>
<summary>Прямые ссылки для приложений (если кнопка не открывает редактор)</summary>

GitHub не делает ссылки `cursor://` и `vscode:` кликабельными, поэтому скопируйте нужную в адресную строку браузера.

Cursor, облачный сервер:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=mnogoreels&config=eyJ1cmwiOiJodHRwczovL21jcC5tbm9nby1yZWVscy5ydS9tY3AiLCJoZWFkZXJzIjp7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D
```

Cursor, локальный сервер:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=mnogoreels&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1ub2dvcmVlbHMtbWNwQGxhdGVzdCJdLCJlbnYiOnsiTU5PR09SRUVMU19BUElfS0VZIjoiJHtlbnY6TU5PR09SRUVMU19BUElfS0VZfSJ9fQ%3D%3D
```

VS Code, облачный сервер (спросит ключ):

```text
vscode:mcp/install?%7B%22name%22%3A%22mnogoreels%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Amnogoreels_api_key%7D%22%7D%2C%22inputs%22%3A%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D%7D
```

VS Code, локальный сервер (спросит ключ):

```text
vscode:mcp/install?%7B%22name%22%3A%22mnogoreels%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mnogoreels-mcp%40latest%22%5D%2C%22env%22%3A%7B%22MNOGOREELS_API_KEY%22%3A%22%24%7Binput%3Amnogoreels_api_key%7D%22%7D%2C%22inputs%22%3A%5B%7B%22type%22%3A%22promptString%22%2C%22id%22%3A%22mnogoreels_api_key%22%2C%22description%22%3A%22MnogoReels%20API%20key%20(mrfrt_usr_...)%22%2C%22password%22%3Atrue%7D%5D%7D
```

</details>

Пакет для Claude Desktop (`.mcpb`) открывает окно установки, где нужно ввести ключ и при желании включить режим «только чтение». Ссылки для Goose и настройки остальных клиентов — в разделе [Быстрый старт](#быстрый-старт).

## Как получить API-ключ

1. Войдите или зарегистрируйтесь на [mnogo-reels.ru](https://mnogo-reels.ru).
2. Откройте [Разработчикам → API-ключи](https://mnogo-reels.ru/dashboard/developers?tab=keys) и создайте ключ. Он начинается с `mrfrt_usr_`.
3. Пропишите его в настройках клиента, как показано ниже: переменная `MNOGOREELS_API_KEY` для локального сервера или заголовок `Authorization: Bearer` для облачного.

> **Ключ может тратить ваши кредиты.** Заведите отдельный ключ для каждого клиента или компьютера, не вставляйте его в чаты, issues и URL и отзывайте на той же странице, когда он больше не нужен.

Список инструментов доступен без ключа, как и `get_account`, `get_options_guide`, `check_video_source` и `quote_clip_job` для новой ссылки. Всё, что читает ваши задачи или создаёт новые, требует ключ.

## Быстрый старт

### Облачный сервер (рекомендуется)

Адрес: `https://mcp.mnogo-reels.ru/mcp` (Streamable HTTP). Ключ передаётся в заголовке:

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

- Если клиент не умеет задавать `Authorization`, передайте `X-API-Key: mrfrt_usr_YOUR_KEY`.
- `https://mcp.mnogo-reels.ru/mcp/readonly` — тот же сервер без инструментов, которые создают задачи или тратят кредиты.
- Никогда не передавайте ключ в URL: сервер отклоняет такие запросы.

### Локальный сервер (stdio)

Нужен Node.js 22 или новее. Сервер обращается к `https://api.mnogo-reels.ru` напрямую с вашего компьютера.

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

`"type": "http"` — написание для Claude Code, VS Code и Cursor. Cline нужен `"streamableHttp"`, Windsurf — `serverUrl`, Gemini CLI — `httpUrl`; точный вид — в блоках ниже. Готовые файлы лежат в [`examples/`](examples/), подробности по клиентам — в [`docs/clients.md`](docs/clients.md).

<details>
<summary><b>Claude Code</b></summary>

Облачный сервер:

```bash
claude mcp add --transport http mnogoreels https://mcp.mnogo-reels.ru/mcp --header "Authorization: Bearer mrfrt_usr_YOUR_KEY"
```

Локальный сервер:

```bash
claude mcp add mnogoreels --env MNOGOREELS_API_KEY=mrfrt_usr_YOUR_KEY -- npx -y mnogoreels-mcp@latest
```

Плагин (облачный сервер и навык `make-shorts`; ключ спрашивается при включении):

```text
/plugin marketplace add RealSatanyan/mnogoreels-mcp
/plugin install mnogoreels@mnogoreels
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Скачайте [`mnogoreels-mcp.mcpb`](https://github.com/RealSatanyan/mnogoreels-mcp/releases/latest/download/mnogoreels-mcp.mcpb) и откройте двойным щелчком (или перетащите в Settings → Extensions). Claude Desktop спросит API-ключ и запустит сервер на встроенном Node.js.

Или добавьте локальный сервер в `claude_desktop_config.json` (Settings → Developer → Edit Config):

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

Пользовательские удалённые коннекторы со статическим заголовком API-ключа обычным пользователям Claude Desktop недоступны, поэтому используйте пакет или локальный сервер.

</details>

<details>
<summary><b>Cursor</b></summary>

Нажмите кнопку выше или добавьте в `~/.cursor/mcp.json` (для всех проектов) либо `.cursor/mcp.json` (для одного проекта):

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

Локальный вариант — [блок локального сервера](#локальный-сервер-stdio) выше; если ключ хранится в окружении, укажите `"MNOGOREELS_API_KEY": "${env:MNOGOREELS_API_KEY}"`.

</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Нажмите кнопку выше или создайте `.vscode/mcp.json`. VS Code один раз спросит ключ и сохранит его в защищённом хранилище:

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

Файл `.mcp.json` в корне проекта использует форму `mcpServers` из раздела [Облачный сервер](#облачный-сервер-рекомендуется); не коммитьте файл, в котором есть ключ.

</details>

<details>
<summary><b>OpenAI Codex</b></summary>

`~/.codex/config.toml`, облачный сервер (экспортируйте `MNOGOREELS_API_KEY` в оболочке, из которой запускаете Codex):

```toml
[mcp_servers.mnogoreels]
url = "https://mcp.mnogo-reels.ru/mcp"
bearer_token_env_var = "MNOGOREELS_API_KEY"
tool_timeout_sec = 120
```

Локальный сервер:

```toml
[mcp_servers.mnogoreels]
command = "npx"
args = ["-y", "mnogoreels-mcp@latest"]
env_vars = ["MNOGOREELS_API_KEY"]
startup_timeout_sec = 60
tool_timeout_sec = 120
```

Или из командной строки:

```bash
codex mcp add mnogoreels --env MNOGOREELS_API_KEY=mrfrt_usr_YOUR_KEY -- npx -y mnogoreels-mcp@latest
```

Стандартных 10 секунд на запуск часто не хватает для первой загрузки через `npx`, поэтому `startup_timeout_sec = 60`.

</details>

<details>
<summary><b>Gemini CLI</b></summary>

Установите расширение (оно спросит ключ и сохранит его в системной связке ключей):

```bash
gemini extensions install https://github.com/RealSatanyan/mnogoreels-mcp
```

Или добавьте облачный сервер в `~/.gemini/settings.json`:

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

`settings.json`, облачный сервер:

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

Локальный сервер:

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

Добавьте в `cline_mcp_settings.json` ровно один из этих блоков. Локальный сервер:

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

Облачный сервер:

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

Не убирайте `type` у удалённой записи: без него Cline считает её устаревшим SSE-подключением, а этот сервер SSE не обслуживает. Cline может настроить сервер и сам — по инструкции [`llms-install.md`](llms-install.md).

</details>

<details>
<summary><b>Goose</b></summary>

Вставьте одну из ссылок в адресную строку браузера (GitHub не делает ссылки `goose://` кликабельными). Локальный сервер, Goose спросит ключ:

```text
goose://extension?name=MnogoReels&cmd=npx&arg=-y&arg=mnogoreels-mcp%40latest&env=MNOGOREELS_API_KEY%3DMnogoReels%20API%20key%20(mrfrt_usr_...)&timeout=120&description=Turn%20long%20videos%20into%20captioned%20vertical%20clips%2C%20transcripts%20and%20articles
```

Облачный сервер, перед открытием замените `mrfrt_usr_YOUR_KEY`:

```text
goose://extension?name=MnogoReels&url=https%3A%2F%2Fmcp.mnogo-reels.ru%2Fmcp&header=Authorization%3DBearer%20mrfrt_usr_YOUR_KEY&timeout=120&description=Turn%20long%20videos%20into%20captioned%20vertical%20clips%2C%20transcripts%20and%20articles
```

Или запустите `goose configure` → Add Extension → Command-line Extension с командой `npx -y mnogoreels-mcp@latest` и переменной `MNOGOREELS_API_KEY`. Пример `config.yaml` — в [`examples/goose-config.yaml`](examples/goose-config.yaml).

</details>

<details>
<summary><b>Kiro</b></summary>

Нажмите кнопку выше или добавьте в `~/.kiro/settings/mcp.json` (или `.kiro/settings/mcp.json` в проекте):

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

Эти клиенты принимают обычный JSON `mcpServers`: вставьте [облачный](#облачный-сервер-рекомендуется) или [локальный](#локальный-сервер-stdio) блок в их настройки MCP (JetBrains: Settings → Tools → AI Assistant → Model Context Protocol; Warp: Settings → AI → MCP servers; Amazon Q: `~/.aws/amazonq/mcp.json`; LM Studio: `mcp.json`). Если клиент не поддерживает удалённые серверы с заголовками, используйте локальный блок.

</details>

<details>
<summary><b>Continue</b></summary>

Сохраните как `.continue/mcpServers/mnogoreels.yaml` и добавьте в Continue секрет `MNOGOREELS_API_KEY`:

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

Добавьте к своему AI Agent узел **MCP Client Tool**:

- Server Transport: **HTTP Streamable**
- Endpoint: `https://mcp.mnogo-reels.ru/mcp`
- Authentication: **Header Auth**, имя `Authorization`, значение `Bearer mrfrt_usr_YOUR_KEY`

Подробнее: [`examples/n8n.md`](examples/n8n.md).

</details>

<details>
<summary><b>Yandex AI Studio (MCP Hub)</b></summary>

AI Studio → MCP Hub → «Внешний MCP-сервер»:

- Имя: `mnogoreels`
- URL: `https://mcp.mnogo-reels.ru/mcp`
- Транспорт: Streamable HTTP
- Заголовок: `Authorization: Bearer mrfrt_usr_YOUR_KEY`

Подробнее: [`examples/yandex-ai-studio.md`](examples/yandex-ai-studio.md).

</details>

<details>
<summary><b>Cloud.ru Evolution AI Agents</b></summary>

AI Agents → MCP-серверы → добавить сервер по URL: `https://mcp.mnogo-reels.ru/mcp` с заголовком `Authorization: Bearer mrfrt_usr_YOUR_KEY`.

</details>

<details>
<summary><b>GigaChain / LangChain (Python)</b></summary>

Через `langchain-mcp-adapters`:

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

Передайте `tools` своему агенту на GigaChat. Готовый скрипт — [`examples/gigachain.py`](examples/gigachain.py).

</details>

<details>
<summary><b>Docker</b></summary>

По умолчанию образ запускает локальный (stdio) сервер:

```bash
docker run -i --rm -e MNOGOREELS_API_KEY ghcr.io/realsatanyan/mnogoreels-mcp:latest
```

Как запись для MCP-клиента:

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

## Что можно попросить

Пишите ассистенту обычным языком, например:

- «Нарежь шортсы из https://www.youtube.com/watch?v=… с русскими субтитрами в стиле hormozi. Сначала скажи цену».
- «Сколько кредитов будет стоить нарезка первых 30 минут этого подкаста? Он идёт 2 часа».
- «Сделай транскрипт этого видео с RuTube и дай субтитры в SRT».
- «Напиши статью для блога с главами по моей последней задаче нарезки».
- «Покажи мои последние задачи и по три лучших клипа из каждой — с оценками и ссылками».

## Инструменты

Названия и описания инструментов — на английском: так их видит модель.

<!-- tools:start -->
| Инструмент | Название | Только чтение | Тратит кредиты | Что делает |
| --- | --- | --- | --- | --- |
| `get_account` | Check API key and settings | да | нет | Checks whether the configured MnogoReels API key works and shows this server's settings. |
| `get_options_guide` | Explain clip options | да | нет | Explains the option values accepted by create_clip_job and recut_clip_job: video modes, clip lengths, caption styles, hook styles, story arc styles, outros, framing and languages, plus the pricing rules and the 30-minute limit per job. |
| `check_video_source` | Check video source | да | нет | Checks whether MnogoReels can download a video link and returns its title, length and platform. |
| `quote_clip_job` | Quote clip job cost | да | нет | Calculates the credit cost of create_clip_job or recut_clip_job without spending anything, and checks that MnogoReels can download the video. |
| `create_clip_job` | Create clip job (spends credits) | нет | да | Starts AI clipping of a long video into vertical 9:16 short clips with burned-in captions and a hook title, plus optional cold-open hooks, music and B-roll. |
| `get_clip_job` | Get clip job status and clips | да | нет | Returns the status, progress and results of a clip job created by create_clip_job, recut_clip_job or on the MnogoReels website. |
| `list_clip_jobs` | List clip jobs | да | нет | Lists the user's clip jobs, newest first, including jobs started on the MnogoReels website. |
| `recut_clip_job` | Recut clip job (spends credits) | нет | да | Creates a new clip job from the same source video as an existing job, with different settings such as caption style, hook style, clip length, language, framing, music, B-roll or prompt. |
| `retry_clip_job` | Retry failed clip job (free) | нет | нет | Re-runs a failed clip job with the same settings, free of charge, keeping the same job_id. |
| `create_transcription` | Transcribe video or audio | нет | нет | Starts a timed speech-to-text transcription of a video or audio link. |
| `get_transcription` | Get transcription | да | нет | Returns the status and text of a transcription started with create_transcription. |
| `create_article` | Create article from clip job | нет | нет | Turns the source video of a completed clip job into a long-form article: title, SEO title and description, summary, sections, key takeaways, chapters with timestamps, up to 4 frames from the video as illustrations, and the full timed transcript. |
| `get_article` | Get article | да | нет | Returns an article created with create_article as Markdown, with its status. |
| `search_broll` | Search B-roll library | да | нет | Searches B-roll videos and images. |
| `get_broll_asset` | Get B-roll asset | да | нет | Returns one B-roll item by asset_id with fresh links. |
| `list_packs` | List publication packs | да | нет | Lists the user's publication packs, newest first. |
| `get_pack` | Get publication pack | да | нет | Returns one publication pack: suggested titles, descriptions, cover texts and hashtags, thumbnail images, teaser videos, the article id and the clip job id. |
| `create_youtube_thumbnails` | Create YouTube thumbnails | нет | нет | Generates 1 to 4 AI YouTube thumbnail images (1280×720 JPEG) for a video, using frames from the video plus an optional title and art direction. |
| `get_youtube_thumbnails` | Get YouTube thumbnails | да | нет | Returns the status and images of a thumbnail job started with create_youtube_thumbnails. |
<!-- tools:end -->

У каждого инструмента есть название, все четыре MCP-аннотации (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) и схема ответа. Два инструмента, которые тратят кредиты, помечены `destructiveHint: true`, поэтому клиенты, которые спрашивают разрешение перед рискованными действиями (например, Claude и Codex), запрашивают его при каждом вызове.

## Какой инструмент выбрать

| Нужно… | Инструмент |
| --- | --- |
| Проверить, работает ли ссылка и какой длины видео | `check_video_source` |
| Узнать цену до нарезки | `quote_clip_job` |
| Нарезать клипы | `create_clip_job` (после расчёта цены и вашего согласия) |
| Следить за ходом обработки и получить клипы | `get_clip_job` |
| Найти прошлые задачи (в том числе созданные на сайте) | `list_clip_jobs` |
| Получить другое оформление или другие моменты из готовой задачи | `recut_clip_job` (платно, новая задача) |
| Перезапустить упавшую задачу | `retry_clip_job` (бесплатно) |
| Получить транскрипт или субтитры SRT | `create_transcription` → `get_transcription` |
| Получить статью для блога, описание выпуска или главы | `create_article` → `get_article` (нужна завершённая задача нарезки) |
| Найти футажи для B-roll | `search_broll` → `get_broll_asset` |
| Прочитать пакет публикации, созданный на сайте | `list_packs` → `get_pack` |
| Сделать обложки для YouTube | `create_youtube_thumbnails` → `get_youtube_thumbnails` |
| Проверить ключ и настройки сервера | `get_account` |
| Разобраться в стилях субтитров, режимах и других опциях | `get_options_guide` |

### Задачи выполняются в фоне

Каждый инструмент `create_*` сразу возвращает идентификатор. Парный инструмент `get_*` ждёт внутри вызова до `wait_sec` секунд (по умолчанию 30, максимум 50) и тем временем присылает уведомления о прогрессе, поэтому ассистент просто вызывает его снова, пока статус не станет `completed` или `failed`. Короткие видео обрабатываются за несколько минут, полный 30-минутный отрезок — до нескольких десятков минут. Пока задача нарезки идёт, `get_clip_job` возвращает только число готовых клипов (чтобы увидеть их раньше, передайте `include_partial_clips=true`).

### Правила списания кредитов

- **Цена:** 1 кредит за каждую начатую минуту обрабатываемого отрезка (`end_sec − start_sec`), минимум 1; списывается при создании задачи. Примеры: 45 с → 1 кредит, 10 мин → 10, 29 мин 30 с → 30. Субтитры, хуки, B-roll, музыка и агентный режим через API на цену не влияют.
- **Бесплатно:** проверки, расчёт цены, транскрипты, статьи, обложки для YouTube, перезапуск упавших задач и чтение результатов.
- **Сначала расчёт цены:** `quote_clip_job` бесплатен и считает по той же формуле, что и бэкенд. Ассистент должен показать вам цену и дождаться согласия.
- **`max_credits` обязателен** для `create_clip_job` и `recut_clip_job`. Если цена выше, вызов отклоняется без списания. Оператор может задать жёсткий лимит через `MNOGOREELS_MAX_CREDITS_PER_CALL` или заголовок `X-MnogoReels-Max-Credits-Per-Call`, и модель не сможет его поднять.
- **30 минут на задачу.** MnogoReels обрабатывает не больше 30 минут за одну задачу, поэтому более длинные отрезки отклоняются до списания. Делите длинные видео с помощью `start_sec`/`end_sec` (0–1800, 1800–3600, …).
- **Защита от повторов:** одинаковый запрос с тем же ключом в течение 10 минут возвращает уже созданную задачу вместо повторного списания (`allow_duplicate: true` отключает защиту). Защита работает внутри одного процесса сервера; два отдельных процесса её не разделяют.
- **Без отмены и без автоматического возврата.** Кредиты списываются при создании задачи, отменить задачу нельзя. Если обработка не удалась, кредиты автоматически не возвращаются; `retry_clip_job` бесплатно перезапускает упавшую задачу, либо напишите на support@mnogo-reels.ru и укажите `job_id`.
- **Окно подтверждения.** Если клиент поддерживает MCP form elicitation, сервер дополнительно просит подтвердить точную сумму перед списанием:

| Где работает сервер | Окно подтверждения перед списанием |
| --- | --- |
| Локальный сервер (stdio, `npx`, `.mcpb`, Docker), клиент с form elicitation | да |
| Облачный сервер, клиент на MCP 2026-07-28 с form elicitation | да |
| Облачный сервер, клиенты поколения 2025 года (сегодня это большинство) | нет: защищают `max_credits`, лимит оператора, ограничение в 30 минут, защита от повторов и собственный запрос разрешения в клиенте |
| Любой клиент без поддержки elicitation | нет: те же ограничения, что и выше |

## Промпты и ресурсы

Промпты (в клиентах, которые их показывают, это слэш-команды):

| Промпт | Что делает |
| --- | --- |
| `clip_video` | Расчёт цены, подтверждение, создание задачи и ожидание клипов по одной ссылке (`url`, необязательные `language`, `caption_style`, `clip_length`) |
| `podcast_to_shorts` | Делит длинный подкаст на части по 30 минут, считает цену каждой, делает серию шортсов и предлагает порядок публикации (`url`, необязательный `language`) |
| `video_to_blog_post` | Превращает завершённую задачу нарезки в статью и список глав (`clip_job_id`) |
| `transcribe_video` | Транскрибирует ссылку в текст или SRT (`url`, необязательные `language`, `format`) |
| `review_recent_clips` | Разбирает последние задачи и предлагает настройки для перенарезки, ничего не тратя (необязательный `count`) |

Ресурсы:

| URI | Содержимое |
| --- | --- |
| `mnogoreels://guide/options` | Все значения опций с описаниями |
| `mnogoreels://guide/pricing` | Цены, ограничение в 30 минут и список бесплатных операций |
| `mnogoreels://guide/workflow` | Как пользоваться инструментами (тот же текст, что в инструкциях сервера) |
| `mnogoreels://clip-jobs/{job_id}` | Статус и клипы одной задачи (JSON; список — 20 последних задач) |
| `mnogoreels://transcriptions/{transcription_id}` | Первая страница транскрипта |
| `mnogoreels://articles/{article_id}` | Первая страница статьи в Markdown |

Промпты и ресурсы задач появляются, только когда включены инструменты, которые они используют (например, `/mcp/readonly` предлагает только `review_recent_clips`). Всё то же самое доступно и через инструменты, потому что многие клиенты ресурсы не показывают.

## Настройка

### Переменные окружения (локальный сервер и свой хостинг)

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `MNOGOREELS_API_KEY` | нет | Ваш ключ (`mrfrt_usr_…`). Для запуска сервера и списка инструментов не нужен. В HTTP-режиме игнорируется: каждый клиент передаёт свой ключ. |
| `MNOGOREELS_API_URL` | `https://api.mnogo-reels.ru` | Адрес API; оставьте как есть. |
| `MNOGOREELS_PROFILE` | `default` | `default`, `readonly` или `directory` (см. [Профили](#профили)). |
| `MNOGOREELS_TOOLSETS` | все | Список через запятую: `clips`, `transcripts`, `articles`, `library`, `thumbnails` (или `all`). `account` включён всегда. |
| `MNOGOREELS_READ_ONLY` | `false` | `true` скрывает все инструменты, которые создают задачи или тратят кредиты. |
| `MNOGOREELS_MAX_CREDITS_PER_CALL` | не задан | Жёсткий лимит кредитов на один платный вызов; модель не может его обойти. |
| `MNOGOREELS_MAX_WINDOW_SEC` | `1800` | Самый длинный отрезок для платной задачи, в секундах. Оставьте как есть: значение совпадает с тем, что обрабатывает MnogoReels. |
| `MNOGOREELS_MEDIA_URLS` | `direct` | `both` дополнительно возвращает ссылки `stream_url` через прокси сайта MnogoReels. Оставьте `direct`, пока MnogoReels не объявит прокси доступным для API. |
| `MNOGOREELS_DEBUG` | `false` | Только локальный сервер: писать полные тексты ошибок в stderr. |
| `MNOGOREELS_TRANSPORT` | `stdio` | `http` запускает Streamable HTTP-сервер (то же, что `--http`). |
| `MNOGOREELS_HOST` / `MNOGOREELS_PORT` | `127.0.0.1` / `8080` | Адрес и порт HTTP-сервера. |
| `MNOGOREELS_PUBLIC_URL` | `https://mcp.mnogo-reels.ru/mcp` | Публичный адрес, который указывается в карточке сервера. |
| `MNOGOREELS_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Допустимые заголовки `Host` (защита от DNS rebinding). |
| `MNOGOREELS_ALLOWED_ORIGINS` | `localhost,127.0.0.1,[::1]` | Допустимые хосты в заголовке `Origin` или `*` для публичного развёртывания с ключом в заголовке. |
| `MNOGOREELS_TRUSTED_PROXIES` | пусто | CIDR обратных прокси, чьему `X-Forwarded-For` можно доверять. |

Логические значения: `1/true/yes/on` и `0/false/no/off`. При неверном значении сервер останавливается с сообщением, где названа переменная (код выхода 2). Командная строка: `mnogoreels-mcp [--http] [--help] [--version]`.

### Облачный сервер: пути и заголовки

| Путь | Профиль |
| --- | --- |
| `/mcp` | `default` |
| `/mcp/readonly` | `readonly` |
| `/mcp/directory` | `directory` |

| Заголовок | Действие |
| --- | --- |
| `Authorization: Bearer <ключ>` | Ваш API-ключ (предпочтительный способ). |
| `X-API-Key: <ключ>` | Ваш API-ключ, если `Authorization` задать нельзя. |
| `X-MnogoReels-Toolsets: clips,transcripts` | Показывать только эти наборы инструментов (`account` остаётся всегда). |
| `X-MnogoReels-Read-Only: true` | Скрыть инструменты, которые создают задачи или тратят кредиты. `false` не расширяет путь «только чтение». |
| `X-MnogoReels-Max-Credits-Per-Call: 30` | Жёсткий лимит кредитов на один платный вызов. |

Заголовки могут только сужать то, что разрешает путь. Обнаружение сервера и список инструментов работают без ключа; вызов инструмента, которому нужен ключ, без ключа получает HTTP 401.

### Профили

| Профиль | Инструментов | Что меняется |
| --- | --- | --- |
| `default` | 19 | Всё доступно. |
| `readonly` | 13 | Нет инструментов, которые создают задачи или тратят кредиты; чтение, проверки и расчёт цены работают. |
| `directory` | 17 | Нет инструментов для обложек YouTube, нет опций B-roll с ИИ-картинками и моушн-графикой, нет ссылки на покупку кредитов. Используется для публичных каталогов. |

### Свой HTTP-сервер

`npx -y mnogoreels-mcp@latest --http` или `docker run -p 8080:8080 -e MNOGOREELS_TRANSPORT=http ghcr.io/realsatanyan/mnogoreels-mcp:latest` запускают тот же сервер, что работает на `mcp.mnogo-reels.ru` (проверка здоровья: `GET /healthz`, карточка сервера: `GET /.well-known/mcp/server-card.json`). Укажите свой домен в `MNOGOREELS_ALLOWED_HOSTS`. Боевая конфигурация описана в [`docs/deploy-coolify.md`](docs/deploy-coolify.md).

## Безопасность

- **Недоверенный контент.** Названия, транскрипты, статьи и другой текст из видео оборачиваются в теги `<untrusted_source_text>`, а инструкции сервера велят модели считать такой текст данными, а не командами.
- **Гигиена ключей.** Ключ передаётся только в заголовке `Authorization` или `X-API-Key` (облачный сервер отклоняет ключи в URL), никогда не пишется в логи, а `get_account` показывает только его последние 4 символа. Заводите отдельный ключ для каждого клиента и отзывайте ненужные. Сервисные ключи (`mrfrt_svc_…`) отклоняются.
- **Режим «только чтение».** `MNOGOREELS_READ_ONLY=true`, путь `/mcp/readonly` или переключатель в пакете для Claude Desktop убирают все инструменты, которые могут создавать задачи или тратить кредиты.
- **Только официальные источники.** Сервер публикуется только как npm-пакет [`mnogoreels-mcp`](https://www.npmjs.com/package/mnogoreels-mcp), образ `ghcr.io/realsatanyan/mnogoreels-mcp`, облачный адрес `https://mcp.mnogo-reels.ru` и этот репозиторий. Не отдавайте ключ подделкам.
- **Фиксация версии.** `mnogoreels-mcp@latest` обновляется автоматически. Чтобы этого избежать, укажите конкретную версию, например `npx -y mnogoreels-mcp@1.0.0`.

Об уязвимостях сообщайте закрыто: см. [SECURITY.md](SECURITY.md).

## Конфиденциальность

Локальный сервер отправляет аргументы инструментов и ключ только на `api.mnogo-reels.ru`. Облачный сервер принимает их на `mcp.mnogo-reels.ru` и передаёт в тот же API; ключи он держит только в памяти на время запроса и никогда не пишет в логи ключи, аргументы инструментов и результаты (только короткий префикс хеша ключа, чтобы различать пользователей). Телеметрия не собирается. Подробности — в [PRIVACY.md](PRIVACY.md), [политике конфиденциальности](https://mnogo-reels.ru/privacy-policy) и [условиях использования](https://mnogo-reels.ru/terms) MnogoReels.

## Решение проблем

Ошибки инструментов начинаются с `Error [<код>]:`, дальше идёт совет. Самые частые:

| Код | Что делать |
| --- | --- |
| `missing_api_key`, `invalid_api_key_format`, `invalid_api_key` (HTTP 401 на облачном сервере) | Создайте ключ в разделе [Разработчикам → API-ключи](https://mnogo-reels.ru/dashboard/developers?tab=keys) и обновите настройки клиента. Ключи начинаются с `mrfrt_usr_`. Проверьте вызовом `get_account`. |
| `insufficient_credits` (402) | Пополните кредиты или купите тариф на [mnogo-reels.ru](https://mnogo-reels.ru). |
| `duration_unknown` | Платформа не сообщает длину видео (обычное дело для прямых ссылок на файлы). Передайте `end_sec` — длину в секундах или конец нужного отрезка. |
| `invalid_arguments` с упоминанием 30 минут | Одна задача обрабатывает не больше 30 минут. Разделите видео с помощью `start_sec`/`end_sec` и создайте несколько задач. |
| `source_not_downloadable` | Видео приватное, удалено, недоступно в регионе, без видеодорожки или больше 17 ГБ. Ничего не списано. Попробуйте другую ссылку. |
| `rate_limited`, `rate_limited_local` | Слишком много запросов; подождите столько секунд, сколько указано в сообщении. |
| `upstream_timeout` | MnogoReels не ответил вовремя; повторите. Для проверки источника можно самому передать `start_sec`/`end_sec`. |
| `outcome_unknown`, `billing_uncertain` | Сервер не смог подтвердить, создана ли платная задача. Перед повтором проверьте `list_clip_jobs`; если кредиты списались без задачи, напишите на support@mnogo-reels.ru. Одинаковый повтор в течение 10 минут вернёт тот же ответ и ничего не отправит. |
| Codex: таймаут инструментов или сервер не запускается | Укажите в `config.toml` `startup_timeout_sec = 60` и `tool_timeout_sec = 120`. |
| Медленные или обрывающиеся загрузки в России | Некоторые домашние провайдеры в России замедляют API и хосты с медиафайлами. На домашнем подключении лучше использовать облачный сервер. `MNOGOREELS_MEDIA_URLS=both` добавит ссылки `stream_url` через прокси, когда MnogoReels откроет этот прокси для API. |

Не помогло? [Создайте issue](https://github.com/RealSatanyan/mnogoreels-mcp/issues) (сначала уберите ключ из логов и конфигов) или напишите на support@mnogo-reels.ru.

## Ограничения версии 1

- Локальные файлы не поддерживаются: видео должно быть доступно по публичной ссылке (сначала загрузите его куда-нибудь в открытый доступ).
- Баланс кредитов не виден: API его не отдаёт, смотрите на mnogo-reels.ru.
- Нет публикации и отложенного постинга в соцсети.
- Задачи нельзя отменить.
- Пакеты публикации можно читать, но не создавать; упавшие иллюстрации статей нельзя перегенерировать.

## Разработка

Нужен Node.js 22+. Код на TypeScript (strict), сборка — `tsc`, тесты — Vitest и Stryker, всё пишется через TDD.

```bash
npm ci --ignore-scripts
npm run typecheck && npm run lint && npm test
npm run build
npm run test:integration
npm run smoke              # смоук-тест через MCP Inspector CLI
npm run version:check      # манифесты синхронизированы с package.json
npm run metadata:check     # таблицы инструментов в README, MCPB и Docker tools.json актуальны
```

Порядок работы описан в [CONTRIBUTING.md](CONTRIBUTING.md), выпуск релизов — в [docs/release.md](docs/release.md). Изменения перечислены в [CHANGELOG.md](CHANGELOG.md). Все участники соблюдают [Кодекс поведения](CODE_OF_CONDUCT.md).

## Лицензия

[MIT](LICENSE) © 2026 MnogoReels
