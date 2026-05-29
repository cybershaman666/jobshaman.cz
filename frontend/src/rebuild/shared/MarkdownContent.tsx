import React from 'react';
import Markdown from 'markdown-to-jsx';

import { cn } from '../cn';

const hasMarkdownBlocks = (value: string): boolean =>
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)/.test(value) || /[*_`~\[]/.test(value);

const makePlainTextReadable = (value: string): string => {
  let next = value.replace(/\s+/g, ' ').trim();
  const sectionLabels = [
    'What we are looking for',
    'Who we are looking for',
    'What you will do',
    'Who you are',
    'You will',
    'You are',
    'In short',
    'If you are',
    'Co hledáme',
    'Koho hledáme',
    'Co budeš dělat',
    'Co budete dělat',
    'Stručně',
    'Pokud',
  ];

  sectionLabels.forEach((label) => {
    next = next.replace(new RegExp(`\\s+(${label}:)`, 'g'), '\n\n## $1');
  });

  const itemLabels = [
    'A Storyteller',
    'An Architect of Community',
    'A Value-Driven Visionary',
    'A Collaborator',
  ];
  itemLabels.forEach((label) => {
    next = next.replace(new RegExp(`\\s+(${label}:)`, 'g'), '\n- **$1** ');
  });

  return next
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
};

const normalizeReadableMarkdown = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (hasMarkdownBlocks(trimmed)) return trimmed;
  return makePlainTextReadable(trimmed);
};

export const MarkdownContent: React.FC<{
  value: string;
  className?: string;
}> = ({ value, className }) => {
  const normalized = normalizeReadableMarkdown(value);
  if (!normalized) return null;

  return (
    <div className={cn('prose prose-slate max-w-none break-words', className)}>
      <Markdown
        options={{
          disableParsingRawHTML: true,
          forceBlock: true,
          overrides: {
            h1: { props: { className: 'mb-3 mt-5 text-2xl font-semibold tracking-normal text-slate-900 first:mt-0' } },
            h2: { props: { className: 'mb-3 mt-5 text-xl font-semibold tracking-normal text-slate-900 first:mt-0' } },
            h3: { props: { className: 'mb-2 mt-4 text-lg font-semibold tracking-normal text-slate-900 first:mt-0' } },
            p: { props: { className: 'my-3 leading-8 first:mt-0 last:mb-0' } },
            ul: { props: { className: 'my-3 list-disc space-y-2 pl-5' } },
            ol: { props: { className: 'my-3 list-decimal space-y-2 pl-5' } },
            li: { props: { className: 'pl-1 leading-7' } },
            strong: { props: { className: 'font-semibold text-slate-900' } },
            em: { props: { className: 'text-slate-700' } },
          },
        }}
      >
        {normalized}
      </Markdown>
    </div>
  );
};
