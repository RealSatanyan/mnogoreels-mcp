import { describe, expect, it } from 'vitest';
import { aGeneratedArticle, anArticleJob, anArticleTranscript } from './fixtures.js';
import { renderArticleMarkdown } from './markdown.js';
import { ArticleJobSchema } from './schemas.js';

const render = (
  options: {
    readonly article?: Parameters<typeof aGeneratedArticle>[0];
    readonly transcript?: Parameters<typeof anArticleTranscript>[0] | null;
    readonly includeTranscript?: boolean;
  } = {},
) => {
  const job = ArticleJobSchema.parse(
    anArticleJob({
      article: aGeneratedArticle(options.article),
      transcript: options.transcript === null ? null : anArticleTranscript(options.transcript),
    }),
  );
  if (!job.article) throw new Error('fixture has no article');
  return renderArticleMarkdown({
    article: job.article,
    transcript: job.transcript,
    includeTranscript: options.includeTranscript ?? false,
  });
};

describe('renderArticleMarkdown', () => {
  it('renders title, summary, sections, takeaways and chapters', () => {
    expect(render()).toBe(
      [
        '# How to edit faster',
        '',
        'Editing gets faster with a few habits.',
        '',
        '## Plan first',
        '',
        'Write a shot list.',
        '',
        'Keep it short.',
        '',
        '## Cut on beat',
        '',
        'Use the music.',
        '',
        '## Key takeaways',
        '',
        '- Plan',
        '- Cut',
        '- Export',
        '',
        '## Chapters',
        '',
        '- [00:00] Intro — Why speed matters',
        '- [01:05] Planning',
      ].join('\n'),
    );
  });

  it('renders the guest block after the chapters', () => {
    const markdown = render({
      article: {
        timestamps: [{ start_seconds: 3725, title: 'Late chapter' }],
        guest: { name: 'Ann Lee', title: 'Producer', bio: 'Ann edits documentaries.' },
      },
    });
    expect(
      markdown.endsWith(
        [
          '## Chapters',
          '',
          '- [1:02:05] Late chapter',
          '',
          '## Guest',
          '',
          '**Ann Lee**, Producer',
          '',
          'Ann edits documentaries.',
        ].join('\n'),
      ),
    ).toBe(true);
  });

  it('renders a guest without title or bio as just the name', () => {
    expect(render({ article: { guest: { name: 'Bob' } } }).endsWith('## Guest\n\n**Bob**')).toBe(true);
  });

  it.each([
    { summary: null, sections: null, key_takeaways: null, timestamps: [], guest: null },
    { summary: '', sections: [], key_takeaways: [], timestamps: null },
  ])('skips missing optional parts', (article) => {
    expect(render({ article })).toBe('# How to edit faster');
  });

  it('appends the timed transcript with speakers when asked', () => {
    expect(
      render({ includeTranscript: true }).endsWith(
        ['## Transcript', '', '[00:00] Hello and welcome.', '[00:04] Host: Today we edit.'].join('\n'),
      ),
    ).toBe(true);
  });

  it('falls back to the transcript text when it has no segments', () => {
    expect(
      render({ includeTranscript: true, transcript: { segments: null, text: 'Plain words.' } }).endsWith(
        '## Transcript\n\nPlain words.',
      ),
    ).toBe(true);
  });

  it('leaves the transcript out unless asked, or when there is none', () => {
    expect(render()).not.toContain('## Transcript');
    expect(render({ includeTranscript: true, transcript: null })).not.toContain('## Transcript');
    expect(render({ includeTranscript: true, transcript: { segments: [], text: null } })).not.toContain(
      '## Transcript',
    );
  });
});
