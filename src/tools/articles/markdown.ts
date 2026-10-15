import type { ArticleTranscript, GeneratedArticle } from './schemas.js';

const pad2 = (value: number): string => String(value).padStart(2, '0');

const clock = (seconds: number): string => {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const rest = `${pad2(Math.floor(whole / 60) % 60)}:${pad2(whole % 60)}`;
  return hours > 0 ? `${String(hours)}:${rest}` : rest;
};

const heading = (title: string, body: string): string => (body ? `## ${title}\n\n${body}` : '');

const sectionsBlock = (article: GeneratedArticle): readonly string[] =>
  (article.sections ?? []).map((section) => heading(section.heading, section.paragraphs.join('\n\n')));

const chaptersBlock = (article: GeneratedArticle): string =>
  heading(
    'Chapters',
    (article.timestamps ?? [])
      .map(
        (chapter) =>
          `- [${clock(chapter.start_seconds)}] ${chapter.title}${chapter.summary ? ` — ${chapter.summary}` : ''}`,
      )
      .join('\n'),
  );

const guestBlock = (article: GeneratedArticle): string => {
  const { guest } = article;
  if (!guest) return '';
  const name = guest.title ? `**${guest.name}**, ${guest.title}` : `**${guest.name}**`;
  return heading('Guest', [name, guest.bio ?? ''].filter(Boolean).join('\n\n'));
};

const transcriptBlock = (transcript: ArticleTranscript): string => {
  const segments = transcript.segments ?? [];
  const lines = segments.map(
    (segment) => `[${clock(segment.start_seconds)}] ${segment.speaker ? `${segment.speaker}: ` : ''}${segment.text}`,
  );
  return heading('Transcript', segments.length > 0 ? lines.join('\n') : (transcript.text ?? ''));
};

export const renderArticleMarkdown = (options: {
  readonly article: GeneratedArticle;
  readonly transcript: ArticleTranscript | null | undefined;
  readonly includeTranscript: boolean;
}): string => {
  const { article, transcript } = options;
  return [
    `# ${article.title}`,
    article.summary ?? '',
    ...sectionsBlock(article),
    heading('Key takeaways', (article.key_takeaways ?? []).map((item) => `- ${item}`).join('\n')),
    chaptersBlock(article),
    guestBlock(article),
    options.includeTranscript && transcript ? transcriptBlock(transcript) : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};
