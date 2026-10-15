# Contributing

Thanks for helping improve the MnogoReels MCP server. Bug reports, documentation fixes and pull requests are welcome. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs

Open an [issue](https://github.com/RealSatanyan/mnogoreels-mcp/issues) with the server version (`npx -y mnogoreels-mcp@latest --version`), your MCP client, the transport (local or hosted) and the tool call that failed. **Remove API keys (`mrfrt_usr_…`) and configs that contain secrets before posting.** Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Setup

Requirements: Node.js 22 or newer (`.nvmrc`), npm.

```bash
git clone https://github.com/RealSatanyan/mnogoreels-mcp.git
cd mnogoreels-mcp
npm ci --ignore-scripts
npm test
```

Unit and protocol tests run against an in-process fake of the MnogoReels API; they never call the real API and need no key.

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript strict type check |
| `npm run lint` | ESLint (type-aware rules, module boundaries) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm test` / `npm run test:coverage` | Unit and protocol tests (Vitest), with coverage thresholds |
| `npm run build` | Compile to `dist/` with `tsc` |
| `npm run test:integration` | Spawn the built server over stdio and HTTP (run `npm run build` first) |
| `npm run smoke` | MCP Inspector CLI smoke test against the built server |
| `npm run mutation` | Stryker mutation testing (slow; CI runs it weekly and on pull requests labelled `mutation`; locally add `-- --concurrency 2` on shared machines) |
| `npm run test:e2e` | Live tests against the real API; skipped unless `MNOGOREELS_E2E_API_KEY` is set. Read-only by default; `MNOGOREELS_E2E_SPEND=1` spends about 1 credit |
| `npm run version:sync` / `version:check` | Copy the `package.json` version into every manifest / verify it |
| `npm run metadata` / `metadata:check` | Regenerate / verify the README tool tables, MCPB `tools`, Docker `tools.json` (needs `npm run build`) |
| `npm run mcpb:pack` | Build the Claude Desktop bundle into `build/` (needs `npm run build`) |

## How we write code

- **Test-driven development is required.** Write a failing test first, make it pass with the smallest change, then refactor. Every production line exists because a test needed it.
- Test behaviour through public entry points: tools are tested through a real MCP client against the fake API (`test/support/harness.ts`), in both protocol eras where it matters. Build test data with factory functions (`fixtures.ts`), never with shared mutable state.
- TypeScript strict mode; no `any`, no type assertions, `type` rather than `interface`, immutable data, small pure functions, options objects, early returns.
- Validate every backend response with a zod schema; never trust third-party text (fence it, see `src/shaping/fence.ts`).
- No code comments: names and tests explain the code.
- Keep module boundaries (`domain`, `shaping`, `policy`, `api`, `runtime`, `tools/<group>`, `server`, `transports`); ESLint enforces them.
- Never put real API keys in code, tests, fixtures, logs or issues. Test keys are obviously fake.

## Changing tools

Tool names and input schemas are frozen since 1.0.0. Additive changes (new optional parameters, new tools) are minor versions; renames need a major version and an alias. When you change a name, description, schema or annotation:

1. Update the schema snapshots deliberately: `npx vitest run test/protocol/tools-list.snapshot.test.ts -u`, and review the diff.
2. Regenerate derived metadata: `npm run build && npm run metadata` (README tool tables in both languages, `mcpb/manifest.json` `tools`, `docker-mcp-registry/*/tools.json`).
3. Describe the change in `CHANGELOG.md` under `[Unreleased]`, including description-only changes.
4. If you touch the README, mirror the change in `README.ru.md`.

## Pull requests

- One logical change per pull request, with tests.
- CI must be green: typecheck, lint, format, tests with coverage, build, integration, `version:check`, `metadata:check`, manifest validation, Docker build and the mutation score on changed files.
- Maintainers merge after review. Releases are cut by maintainers as described in [docs/release.md](docs/release.md).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
