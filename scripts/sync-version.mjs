import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const JSON_VERSION = [/"version": "[^"]*"/g, (v) => `"version": "${v}"`];

export const TARGETS = [
  { file: 'src/version.ts', rules: [[/export const VERSION = '[^']*';/g, (v) => `export const VERSION = '${v}';`]] },
  {
    file: 'server.json',
    rules: [
      JSON_VERSION,
      [/ghcr\.io\/realsatanyan\/mnogoreels-mcp:[^"]+/g, (v) => `ghcr.io/realsatanyan/mnogoreels-mcp:${v}`],
      [
        /releases\/download\/v[^/"]+\/mnogoreels-mcp-[^"]+\.mcpb/g,
        (v) => `releases/download/v${v}/mnogoreels-mcp-${v}.mcpb`,
      ],
    ],
  },
  { file: 'mcpb/manifest.json', rules: [JSON_VERSION] },
  { file: 'gemini-extension.json', rules: [JSON_VERSION, [/mnogoreels-mcp@[^"]+/g, (v) => `mnogoreels-mcp@${v}`]] },
  { file: 'plugins/mnogoreels/.claude-plugin/plugin.json', rules: [JSON_VERSION] },
  { file: 'plugins/cursor/.cursor-plugin/plugin.json', rules: [JSON_VERSION] },
  { file: '.claude-plugin/marketplace.json', rules: [JSON_VERSION] },
];

const read = (file) => readFile(new URL(file, ROOT), 'utf8');

export const applyRules = ({ text, rules, version }) =>
  rules.reduce(
    (state, [pattern, replace]) => ({
      text: state.text.replace(pattern, () => replace(version)),
      missing: state.text.search(pattern) !== -1 ? state.missing : [...state.missing, String(pattern)],
    }),
    { text, missing: [] },
  );

export const serverJsonProblems = (serverJson) => {
  const mcpb = serverJson.packages?.find((pkg) => pkg.registryType === 'mcpb');
  return [
    /^[a-f0-9]{64}$/.test(mcpb?.fileSha256 ?? '')
      ? undefined
      : 'server.json: packages[mcpb].fileSha256 must match ^[a-f0-9]{64}$',
    /^[0-9]+$/.test(serverJson.repository?.id ?? '') ? undefined : 'server.json: repository.id must match ^[0-9]+$',
  ].filter((problem) => problem !== undefined);
};

const main = async () => {
  const check = process.argv.includes('--check');
  const { version } = JSON.parse(await read('package.json'));
  const results = await Promise.all(
    TARGETS.map(async ({ file, rules }) => {
      const before = await read(file);
      return { file, before, ...applyRules({ text: before, rules, version }) };
    }),
  );
  const problems = [
    ...results.flatMap(({ file, missing }) => missing.map((pattern) => `${file}: no match for ${pattern}`)),
    ...serverJsonProblems(JSON.parse(results.find(({ file }) => file === 'server.json').text)),
  ];
  const changed = results.filter(({ before, text }) => before !== text);
  if (check) {
    const report = [...problems, ...changed.map(({ file }) => `${file}: not synced to version ${version}`)];
    report.forEach((line) => process.stderr.write(`${line}\n`));
    process.exit(report.length === 0 ? 0 : 1);
  }
  await Promise.all(changed.map(({ file, text }) => writeFile(new URL(file, ROOT), text)));
  changed.forEach(({ file }) => process.stdout.write(`updated ${file}\n`));
  problems.forEach((line) => process.stderr.write(`${line}\n`));
  process.exit(problems.length === 0 ? 0 : 1);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
