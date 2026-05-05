import React from 'react';

import type { ApplicationMessageAttachment, DialogueDetail } from '../../types';

import { cn } from '../cn';
import { getApplicationStatusCopy } from '../status';

export const formatAttachmentType = (attachment: ApplicationMessageAttachment) => {
  const rawType = String(attachment.content_type || attachment.mime_type || '').toLowerCase();
  const fileName = String(attachment.name || attachment.filename || '').toLowerCase();
  if (rawType.includes('pdf') || fileName.endsWith('.pdf')) return 'PDF';
  if (rawType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) return 'DOC';
  if (rawType.startsWith('image/')) return 'Image';
  if (rawType.startsWith('audio/')) return 'Audio';
  if (rawType.includes('sheet') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return 'Sheet';
  return 'File';
};

const formatAttachmentSize = (attachment: ApplicationMessageAttachment) => {
  const size = Number(attachment.size || attachment.size_bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

export const AttachmentChip: React.FC<{ attachment: ApplicationMessageAttachment; inverted?: boolean }> = ({ attachment, inverted = false }) => {
  const tone = inverted ? 'bg-white/16 text-white' : 'bg-slate-100 text-slate-700';
  const typeLabel = formatAttachmentType(attachment);
  const sizeLabel = formatAttachmentSize(attachment);

  return (
    <a
      href={attachment.download_url || attachment.url}
      target="_blank"
      rel="noreferrer"
      className={cn('rounded-full px-3 py-1.5 text-xs font-medium', tone)}
    >
      {typeLabel} · {attachment.name || attachment.filename || 'Attachment'}{sizeLabel ? ` · ${sizeLabel}` : ''}
    </a>
  );
};

export const SharedJcfpmCard: React.FC<{
  payload: DialogueDetail['shared_jcfpm_payload'];
  className?: string;
}> = ({ payload, className }) => {
  if (!payload) return null;

  return (
    <div className={cn('rounded-[20px] border border-slate-200 bg-slate-50 p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Shared JCFPM signal</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {payload.archetype?.title || 'Candidate profile signal'}
          </div>
        </div>
        <span className="rounded-full bg-[#12AFCB]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f95ac]">
          {payload.share_level === 'full_report' ? 'Full report' : 'Summary'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {payload.archetype?.description || 'JCFPM was shared with this application and can enrich recruiter interpretation.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {payload.top_dimensions.slice(0, 3).map((dimension) => (
          <span key={dimension.dimension} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
            {(dimension.label || dimension.dimension).replace(/_/g, ' ')} · {dimension.percentile}p
          </span>
        ))}
        {payload.strengths.slice(0, 2).map((strength) => (
          <span key={strength} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
            {strength}
          </span>
        ))}
      </div>
      {payload.environment_fit_summary?.length ? (
        <div className="mt-4 text-sm leading-7 text-slate-600">
          <strong>{t('rebuild.dialogue.environment_fit', { defaultValue: 'Prostředí' })}:</strong> {payload.environment_fit_summary.slice(0, 2).join(' · ')}
        </div>
      ) : null}
      {'narrative_summary' in payload && payload.narrative_summary?.next_steps?.length ? (
        <div className="mt-4 text-sm leading-7 text-slate-600">
          <strong>{t('rebuild.dialogue.next_steps', { defaultValue: 'Další kroky' })}:</strong> {payload.narrative_summary.next_steps.slice(0, 2).join(' · ')}
        </div>
      ) : null}
    </div>
  );
};

const getThreadTurnLabel = (turn?: DialogueDetail['dialogue_current_turn']) => {
  if (turn === 'candidate') return 'Candidate turn';
  if (turn === 'company') return 'Recruiter turn';
  return 'Open lane';
};

export const ThreadMetaStrip: React.FC<{
  detail: DialogueDetail | null;
}> = ({ detail }) => {
  if (!detail) return null;
  const statusCopy = getApplicationStatusCopy(detail.status);

  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap gap-2">
        <span className={cn('rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]', statusCopy.tone)}>
          {statusCopy.label}
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
          {getThreadTurnLabel(detail.dialogue_current_turn)}
        </span>
        {detail.dialogue_deadline_at ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
            Deadline {new Date(detail.dialogue_deadline_at).toLocaleString('cs-CZ')}
          </span>
        ) : null}
        {detail.dialogue_closed_reason ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
            Reason: {detail.dialogue_closed_reason.replace(/_/g, ' ')}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export const AttachmentPreview: React.FC<{
  attachment: ApplicationMessageAttachment;
}> = ({ attachment }) => {
  const url = attachment.download_url || attachment.url;
  const contentType = String(attachment.content_type || attachment.mime_type || '').toLowerCase();

  if (!url) return null;
  if (contentType.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[18px] border border-slate-200">
        <img src={url} alt={attachment.name || attachment.filename || 'Attachment preview'} className="max-h-52 w-full object-cover" loading="lazy" />
      </a>
    );
  }
  if (contentType.startsWith('audio/')) {
    return (
      <div className="rounded-[18px] border border-slate-200 bg-white p-3">
        <audio controls src={url} className="w-full" />
      </div>
    );
  }
  return null;
};
