import React from 'react';
import { Bold, Eye, Heading2, Italic, List, Smile } from 'lucide-react';

import { cn } from '../cn';
import { MarkdownContent } from './MarkdownContent';

export const MarkdownEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  t: (key: string, options?: any) => string;
  placeholder?: string;
  minHeightClassName?: string;
  headingFallback?: string;
  bulletsFallback?: string;
}> = ({
  value,
  onChange,
  t,
  placeholder,
  minHeightClassName = 'min-h-[260px]',
  headingFallback,
  bulletsFallback,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(true);

  const replaceSelection = React.useCallback((format: (selection: string) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = value.slice(start, end);
    const replacement = format(selection);
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + replacement.length);
    });
  }, [onChange, value]);

  const insertLine = React.useCallback((prefix: string, fallback: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIndex = value.indexOf('\n', start);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const currentLine = value.slice(lineStart, lineEnd).trim();
    const nextLine = `${prefix}${currentLine || fallback}`;
    onChange(`${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + nextLine.length, lineStart + nextLine.length);
    });
  }, [onChange, value]);

  const appendEmoji = (emoji: string) => replaceSelection((selection) => selection ? `${selection}${emoji}` : emoji);

  const toolbar = [
    {
      icon: Bold,
      label: t('rebuild.editor.bold', { defaultValue: 'Bold' }),
      onClick: () => replaceSelection((selection) => `**${selection || t('rebuild.editor.bold_text', { defaultValue: 'important text' })}**`),
    },
    {
      icon: Italic,
      label: t('rebuild.editor.italic', { defaultValue: 'Italic' }),
      onClick: () => replaceSelection((selection) => `_${selection || t('rebuild.editor.italic_text', { defaultValue: 'human detail' })}_`),
    },
    {
      icon: Heading2,
      label: t('rebuild.editor.heading', { defaultValue: 'Heading' }),
      onClick: () => insertLine('## ', headingFallback || t('rebuild.editor.heading_text', { defaultValue: 'What makes us different' })),
    },
    {
      icon: List,
      label: t('rebuild.editor.bullets', { defaultValue: 'Bullets' }),
      onClick: () => replaceSelection((selection) => {
        const source = selection || bulletsFallback || t('rebuild.editor.bullets_text', { defaultValue: 'Transparent communication\nReal ownership\nKind humor' });
        return source.split('\n').map((line) => `- ${line.replace(/^[-*]\s+/, '').trim()}`).join('\n');
      }),
    },
  ];

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--shell-field-border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {toolbar.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-slate-950"
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
          <div className="mx-1 h-5 w-px bg-slate-200" />
          {['🙂', '✨', '💡', '🤝'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => appendEmoji(emoji)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-base transition hover:bg-white"
              title={t('rebuild.editor.insert_emoji', { defaultValue: 'Insert emoji' })}
              aria-label={t('rebuild.editor.insert_emoji', { defaultValue: 'Insert emoji' })}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen((current) => !current)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
        >
          {previewOpen ? <Eye size={14} /> : <Smile size={14} />}
          {previewOpen
            ? t('rebuild.editor.hide_preview', { defaultValue: 'Hide preview' })
            : t('rebuild.editor.show_preview', { defaultValue: 'Show preview' })}
        </button>
      </div>
      <div className={cn('grid gap-0', previewOpen && 'lg:grid-cols-2')}>
        <textarea
          ref={textareaRef}
          className={cn('w-full resize-y border-0 bg-white px-5 py-4 text-sm leading-7 text-slate-700 outline-none', minHeightClassName)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {previewOpen ? (
          <div className="border-t border-slate-100 bg-slate-50/60 p-5 lg:border-l lg:border-t-0">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t('rebuild.editor.preview', { defaultValue: 'Preview' })}
            </div>
            {value.trim() ? (
              <MarkdownContent value={value} className="text-sm text-slate-600" />
            ) : (
              <p className="text-sm leading-7 text-slate-400">
                {t('rebuild.editor.preview_empty', { defaultValue: 'Formatted preview will appear here.' })}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
