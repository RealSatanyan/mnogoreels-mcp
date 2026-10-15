import { describe, expect, it } from 'vitest';
import { cell, dockerTools, firstSentence, replaceBetweenMarkers, toolsTable } from './export-metadata.mjs';
import { TARGETS, applyRules, serverJsonProblems } from './sync-version.mjs';

const rulesFor = (file) => TARGETS.find((target) => target.file === file).rules;

const aTool = (overrides = {}) => ({
  name: 'get_clip_job',
  title: 'Get clip job',
  description: 'Returns the status. Read-only and free.\n\nSecond paragraph.',
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { properties: { job_id: { type: 'string', description: 'Job id.' } } },
  ...overrides,
});

describe('version sync rules', () => {
  it('rewrites every versioned reference in server.json', () => {
    const text = [
      '"version": "0.9.0"',
      '"identifier": "ghcr.io/realsatanyan/mnogoreels-mcp:0.9.0"',
      '"identifier": "https://github.com/RealSatanyan/mnogoreels-mcp/releases/download/v0.9.0/mnogoreels-mcp-0.9.0.mcpb"',
    ].join('\n');
    expect(applyRules({ text, rules: rulesFor('server.json'), version: '1.2.3' })).toEqual({
      text: [
        '"version": "1.2.3"',
        '"identifier": "ghcr.io/realsatanyan/mnogoreels-mcp:1.2.3"',
        '"identifier": "https://github.com/RealSatanyan/mnogoreels-mcp/releases/download/v1.2.3/mnogoreels-mcp-1.2.3.mcpb"',
      ].join('\n'),
      missing: [],
    });
  });

  it('rewrites src/version.ts', () => {
    expect(
      applyRules({ text: "export const VERSION = '0.0.1';\n", rules: rulesFor('src/version.ts'), version: '2.0.0' })
        .text,
    ).toBe("export const VERSION = '2.0.0';\n");
  });

  it('reports a pattern that matches nothing', () => {
    expect(applyRules({ text: '{}', rules: rulesFor('gemini-extension.json'), version: '1.0.0' }).missing).toHaveLength(
      2,
    );
  });

  it('accepts a registry-valid server.json', () => {
    expect(
      serverJsonProblems({
        repository: { id: '1419613794' },
        packages: [{ registryType: 'mcpb', fileSha256: 'a'.repeat(64) }],
      }),
    ).toEqual([]);
  });

  it('flags a malformed sha256 and repository id', () => {
    expect(
      serverJsonProblems({ repository: { id: 'RealSatanyan' }, packages: [{ registryType: 'mcpb', fileSha256: 'x' }] }),
    ).toEqual([
      'server.json: packages[mcpb].fileSha256 must match ^[a-f0-9]{64}$',
      'server.json: repository.id must match ^[0-9]+$',
    ]);
  });
});

describe('metadata export', () => {
  it.each([
    ['Returns the status. Read-only and free.', 'Returns the status.'],
    ['Searches clips, e.g. by topic. More text.', 'Searches clips, e.g. by topic.'],
    ['No full stop here', 'No full stop here'],
    ['First.\n\nSecond paragraph.', 'First.'],
  ])('takes the first sentence of %j', (description, expected) => {
    expect(firstSentence(description)).toBe(expected);
  });

  it('escapes pipes and collapses whitespace in table cells', () => {
    expect(cell('a | b\n  c')).toBe('a \\| b c');
  });

  it('renders the README tool table', () => {
    expect(
      toolsTable({
        tools: [
          aTool(),
          aTool({
            name: 'create_clip_job',
            title: 'Create | paid',
            annotations: { readOnlyHint: false, destructiveHint: true },
          }),
        ],
        header: ['Tool', 'Title', 'Read-only', 'Spends credits', 'What it does'],
        yes: 'yes',
        no: 'no',
      }),
    ).toBe(
      [
        '| Tool | Title | Read-only | Spends credits | What it does |',
        '| --- | --- | --- | --- | --- |',
        '| `get_clip_job` | Get clip job | yes | no | Returns the status. |',
        '| `create_clip_job` | Create \\| paid | no | yes | Returns the status. |',
      ].join('\n'),
    );
  });

  it('replaces only the text between the markers', () => {
    expect(
      replaceBetweenMarkers({
        text: 'intro\n<!-- tools:start -->\nold\n<!-- tools:end -->\noutro',
        file: 'README.md',
        content: 'new',
      }),
    ).toBe('intro\n<!-- tools:start -->\nnew\n<!-- tools:end -->\noutro');
  });

  it('refuses a file without markers', () => {
    expect(() => replaceBetweenMarkers({ text: 'no markers', file: 'README.md', content: 'x' })).toThrow(
      'README.md: missing <!-- tools:start --> / <!-- tools:end --> markers',
    );
  });

  it('maps input properties to Docker catalog arguments', () => {
    expect(
      dockerTools([
        aTool({ inputSchema: { properties: { job_id: { type: 'string', description: 'Job id.' }, flags: {} } } }),
      ]),
    ).toEqual([
      {
        name: 'get_clip_job',
        description: 'Returns the status. Read-only and free.\n\nSecond paragraph.',
        arguments: [
          { name: 'job_id', type: 'string', desc: 'Job id.' },
          { name: 'flags', type: 'string', desc: '' },
        ],
      },
    ]);
  });
});
