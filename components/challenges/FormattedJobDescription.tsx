import React, { Fragment, useMemo } from 'react';

import { cn } from '../ui/primitives';

type DescriptionBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

export type DescriptionSection = {
  title: string | null;
  blocks: DescriptionBlock[];
};

interface FormattedJobDescriptionProps {
  text: string;
  fallback: string;
  className?: string;
  maxSections?: number;
  maxParagraphLength?: number;
  maxListItems?: number;
}

const normalizeLine = (value: string): string =>
  value
    .replace(/\\([\\`*_{}\[\]()#+\-.!>~])/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s*#{1,6}\s*$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const isNoiseOnlyLine = (value: string): boolean => {
  const normalized = normalizeLine(value);
  if (!normalized) return true;
  return /^[#*_`>|~\-\s]+$/.test(normalized);
};

const isHeadingLine = (line: string): boolean => {
  const normalized = normalizeLine(line.replace(/^#{1,6}\s*/, '').replace(/\s*#{1,6}\s*$/g, ''));
  if (!normalized) return false;
  if (/:\s*$/.test(line) && normalized.length <= 90) return true;
  return /^#{1,6}\s+/.test(line);
};

const getHeadingText = (line: string): string =>
  normalizeLine(line.replace(/^#{1,6}\s*/, '').replace(/:\s*$/, '').replace(/\s*#{1,6}\s*$/g, ''));

const getBulletText = (line: string): string => normalizeLine(line.replace(/^[-*]\s+/, ''));

const isRealList = (items: string[]): boolean => {
  if (items.length >= 4) return true;
  const shortItems = items.filter((item) => item.length <= 110 && item.split(/\s+/).filter(Boolean).length <= 16).length;
  const sentenceLike = items.filter((item) => /[.!?]$/.test(item) || item.length > 150).length;
  return shortItems >= Math.max(2, Math.ceil(items.length * 0.6)) && sentenceLike <= Math.floor(items.length / 2);
};

export const parseFormattedJobDescriptionSections = (text: string): DescriptionSection[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => normalizeLine(line))
    .filter((line) => !isNoiseOnlyLine(line))
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0));

  const sections: DescriptionSection[] = [];
  let currentSection: DescriptionSection = { title: null, blocks: [] };
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    currentSection.blocks.push({ type: 'paragraph', text: paragraphBuffer.join(' ') });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const cleaned = listBuffer.map((item) => item.trim()).filter(Boolean);
    if (!cleaned.length) {
      listBuffer = [];
      return;
    }
    if (isRealList(cleaned)) {
      currentSection.blocks.push({ type: 'list', items: cleaned });
    } else {
      cleaned.forEach((item) => {
        currentSection.blocks.push({ type: 'paragraph', text: item });
      });
    }
    listBuffer = [];
  };

  const pushSection = () => {
    flushParagraph();
    flushList();
    if (!currentSection.title && currentSection.blocks.length === 0) return;
    sections.push(currentSection);
    currentSection = { title: null, blocks: [] };
  };

  lines.forEach((line) => {
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    if (isHeadingLine(line)) {
      flushParagraph();
      flushList();
      if (currentSection.title || currentSection.blocks.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: getHeadingText(line), blocks: [] };
      return;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      listBuffer.push(getBulletText(line));
      return;
    }

    flushList();
    paragraphBuffer.push(normalizeLine(line));
  });

  pushSection();

  if (!sections.length) {
    return text.trim() ? [{ title: null, blocks: [{ type: 'paragraph', text: normalizeLine(text) }] }] : [];
  }

  return sections;
};

const sectionVariants = [
  'border-[var(--border)] bg-[var(--surface)]',
  'border-[rgba(var(--accent-rgb),0.12)] bg-[rgba(var(--accent-rgb),0.035)]',
];

const truncateText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const FormattedJobDescription: React.FC<FormattedJobDescriptionProps> = ({
  text,
  fallback,
  className,
  maxSections,
  maxParagraphLength,
  maxListItems,
}) => {
  const sections = useMemo(() => parseFormattedJobDescriptionSections(text), [text]);
  const visibleSections = typeof maxSections === 'number' ? sections.slice(0, maxSections) : sections;

  if (!visibleSections.length) {
    return <p className={cn('text-sm leading-7 text-[var(--text-muted)]', className)}>{fallback}</p>;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {visibleSections.map((section, index) => (
        <section
          key={`${section.title || 'section'}-${index}`}
          className={cn(
            'rounded-[20px] border px-4 py-4 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.12)] sm:px-5 sm:py-5',
            sectionVariants[index % sectionVariants.length]
          )}
        >
          {section.title ? (
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
              {section.title}
            </h3>
          ) : null}
          <div className={cn('space-y-3', section.title ? 'mt-3' : '')}>
            {section.blocks.map((block, blockIndex) => (
              <Fragment key={`${block.type}-${blockIndex}`}>
                {block.type === 'paragraph' ? (
                  <p className="text-sm leading-7 text-[var(--text)]">
                    {typeof maxParagraphLength === 'number' ? truncateText(block.text, maxParagraphLength) : block.text}
                  </p>
                ) : (
                  <ul className="space-y-2 pl-5 text-sm leading-7 text-[var(--text)] marker:text-[var(--text-faint)]">
                    {(typeof maxListItems === 'number' ? block.items.slice(0, maxListItems) : block.items).map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default FormattedJobDescription;
