import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import prettier from 'prettier';

const ROOT = new URL('../', import.meta.url);
const PUBLIC_URL = 'https://mcp.mnogo-reels.ru/mcp';
const START = '<!-- tools:start -->';
const END = '<!-- tools:end -->';

const README_TABLES = [
  {
    file: 'README.md',
    header: ['Tool', 'Title', 'Read-only', 'Spends credits', 'What it does'],
    yes: 'yes',
    no: 'no',
  },
  {
    file: 'README.ru.md',
    header: ['Инструмент', 'Название', 'Только чтение', 'Тратит кредиты', 'Что делает'],
    yes: 'да',
    no: 'нет',
  },
];

export const firstSentence = (description) => {
  const paragraph = description.split('\n\n')[0].trim();
  return paragraph.match(/^.*?(?<!\b(?:e\.g|i\.e))\.(?=\s|$)/s)?.[0] ?? paragraph;
};

export const cell = (text) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

export const toolsTable = ({ tools, header, yes, no }) =>
  [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...tools
      .map((tool) =>
        [
          `\`${tool.name}\``,
          cell(tool.title),
          tool.annotations.readOnlyHint ? yes : no,
          tool.annotations.destructiveHint ? yes : no,
          cell(firstSentence(tool.description)),
        ].join(' | '),
      )
      .map((row) => `| ${row} |`),
  ].join('\n');

export const replaceBetweenMarkers = ({ text, file, content }) => {
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start === -1 || end < start) throw new Error(`${file}: missing ${START} / ${END} markers`);
  return `${text.slice(0, start + START.length)}\n${content}\n${text.slice(end)}`;
};

export const dockerTools = (tools) =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    arguments: Object.entries(tool.inputSchema.properties ?? {}).map(([name, schema]) => ({
      name,
      type: typeof schema.type === 'string' ? schema.type : 'string',
      desc: schema.description ?? '',
    })),
  }));

const formatJson = async (file, value) =>
  prettier.format(JSON.stringify(value), {
    ...(await prettier.resolveConfig(new URL(file, ROOT))),
    filepath: new URL(file, ROOT).pathname,
  });

const read = (file) => readFile(new URL(file, ROOT), 'utf8');

const main = async () => {
  const { loadProcessConfig, resolveEffectiveConfig } = await import(new URL('dist/config.js', ROOT).href);
  const { buildServerCard } = await import(new URL('dist/server/card.js', ROOT).href);
  const loaded = loadProcessConfig({ env: {} });
  if (!loaded.ok) throw new Error(loaded.error);
  const card = buildServerCard({ config: resolveEffectiveConfig({ process: loaded.config }), publicUrl: PUBLIC_URL });
  const tools = card.tools;

  const manifest = JSON.parse(await read('mcpb/manifest.json'));
  const outputs = [
    ...(await Promise.all(
      ['docker-mcp-registry/local/tools.json', 'docker-mcp-registry/remote/tools.json'].map(async (file) => ({
        file,
        text: await formatJson(file, dockerTools(tools)),
      })),
    )),
    {
      file: 'mcpb/manifest.json',
      text: await formatJson('mcpb/manifest.json', {
        ...manifest,
        tools: tools.map((tool) => ({ name: tool.name, description: firstSentence(tool.description) })),
      }),
    },
    ...(await Promise.all(
      README_TABLES.map(async ({ file, ...labels }) => ({
        file,
        text: replaceBetweenMarkers({ text: await read(file), file, content: toolsTable({ tools, ...labels }) }),
      })),
    )),
  ];

  const current = await Promise.all(outputs.map(({ file }) => read(file).catch(() => undefined)));
  const changed = outputs.filter(({ text }, index) => current[index] !== text);

  if (process.argv.includes('--check')) {
    changed.forEach(({ file }) => process.stderr.write(`${file}: out of date; run npm run metadata\n`));
    process.exit(changed.length === 0 ? 0 : 1);
  }

  await mkdir(new URL('build/', ROOT), { recursive: true });
  await writeFile(new URL('build/server-card.json', ROOT), `${JSON.stringify(card, null, 2)}\n`);
  await Promise.all(changed.map(({ file, text }) => writeFile(new URL(file, ROOT), text)));
  changed.forEach(({ file }) => process.stdout.write(`updated ${file}\n`));
  process.stdout.write(`${tools.length} tools exported; build/server-card.json written\n`);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
