import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, BookOpen, Edit3, Plus, RefreshCcw, Save } from 'lucide-react';

import type { CompanyProfile, LearningResource } from '../../types';
import {
  createLearningResource,
  fetchLearningResourcesByPartner,
  updateLearningResource,
} from '../../services/learningResourceService';
import { Button, SectionPanel, SurfaceCard, cn } from '../ui/primitives';

interface CompanyLearningResourcesWorkspaceProps {
  companyProfile: CompanyProfile;
}

type ResourceFormState = {
  title: string;
  description: string;
  skillTags: string;
  url: string;
  provider: string;
  partnerName: string;
  durationHours: string;
  difficulty: LearningResource['difficulty'];
  price: string;
  currency: string;
  rating: string;
  reviewsCount: string;
  status: NonNullable<LearningResource['status']>;
  location: string;
};

const emptyForm = (companyProfile: CompanyProfile): ResourceFormState => ({
  title: '',
  description: '',
  skillTags: '',
  url: '',
  provider: companyProfile.name || '',
  partnerName: companyProfile.name || '',
  durationHours: '',
  difficulty: 'Beginner',
  price: '',
  currency: 'CZK',
  rating: '',
  reviewsCount: '',
  status: 'active',
  location: '',
});

const inputClass =
  'w-full rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)]';

const parseTagList = (value: string): string[] =>
  Array.from(new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean)));

const resourceToForm = (resource: LearningResource, companyProfile: CompanyProfile): ResourceFormState => ({
  title: resource.title || '',
  description: resource.description || '',
  skillTags: (resource.skill_tags || []).join(', '),
  url: resource.affiliate_url || resource.url || '',
  provider: resource.provider || companyProfile.name || '',
  partnerName: resource.partner_name || companyProfile.name || '',
  durationHours: resource.duration_hours ? String(resource.duration_hours) : '',
  difficulty: resource.difficulty || 'Beginner',
  price: Number.isFinite(Number(resource.price)) && Number(resource.price) > 0 ? String(resource.price) : '',
  currency: resource.currency || 'CZK',
  rating: Number.isFinite(Number(resource.rating)) && Number(resource.rating) > 0 ? String(resource.rating) : '',
  reviewsCount: Number.isFinite(Number(resource.reviews_count)) && Number(resource.reviews_count) > 0 ? String(resource.reviews_count) : '',
  status: resource.status || 'active',
  location: resource.location || '',
});

const CompanyLearningResourcesWorkspace: React.FC<CompanyLearningResourcesWorkspaceProps> = ({ companyProfile }) => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ResourceFormState>(() => emptyForm(companyProfile));

  const loadResources = async () => {
    if (!companyProfile.id) {
      setResources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchLearningResourcesByPartner(companyProfile.id);
      setResources(rows);
    } catch (error) {
      console.error('Failed to load partner learning resources:', error);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResources();
  }, [companyProfile.id]);

  const counts = useMemo(() => ({
    total: resources.length,
    active: resources.filter((item) => (item.status || 'active') === 'active').length,
    draft: resources.filter((item) => item.status === 'draft').length,
    archived: resources.filter((item) => item.status === 'archived').length,
  }), [resources]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm(companyProfile));
  };

  const handleSave = async () => {
    if (!companyProfile.id) return;
    if (!form.title.trim() || parseTagList(form.skillTags).length === 0 || !form.url.trim()) return;

    setSaving(true);
    try {
      const payload = {
        partner_id: companyProfile.id,
        partner_name: form.partnerName.trim() || companyProfile.name,
        provider: form.provider.trim() || companyProfile.name,
        title: form.title.trim(),
        description: form.description.trim(),
        skill_tags: parseTagList(form.skillTags),
        url: form.url.trim(),
        duration_hours: Number(form.durationHours || 0) || 0,
        difficulty: form.difficulty,
        price: Number(form.price || 0) || 0,
        currency: form.currency.trim() || 'CZK',
        rating: Number(form.rating || 0) || 0,
        reviews_count: Number(form.reviewsCount || 0) || 0,
        status: form.status,
        location: form.location.trim(),
      };

      if (editingId) {
        await updateLearningResource(editingId, payload);
      } else {
        await createLearningResource(payload);
      }

      await loadResources();
      resetForm();
      setFormOpen(false);
    } catch (error) {
      console.error('Failed to save learning resource:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (resource: LearningResource) => {
    const nextStatus = resource.status === 'archived' ? 'active' : 'archived';
    try {
      await updateLearningResource(resource.id, { status: nextStatus, partner_id: companyProfile.id });
      await loadResources();
    } catch (error) {
      console.error('Failed to update learning resource status:', error);
    }
  };

  return (
    <div className="space-y-5">
      <SectionPanel
        eyebrow={t('company.learning.badge', { defaultValue: 'Learning resources' })}
        title={t('company.learning.title', { defaultValue: 'Partner learning catalog' })}
        description={t('company.learning.body', { defaultValue: 'Manage the real learning resources that appear in the candidate learning path. This uses the current recruiter account, so no extra provider role is needed in V1.' })}
        actions={(
          <>
            <Button variant="quiet" onClick={() => void loadResources()}>
              <RefreshCcw size={15} />
              {t('company.learning.refresh', { defaultValue: 'Refresh' })}
            </Button>
            <Button onClick={() => {
              resetForm();
              setFormOpen((current) => !current);
            }}>
              <Plus size={15} />
              {editingId ? t('company.learning.new_resource', { defaultValue: 'New resource' }) : t('company.learning.add_resource', { defaultValue: 'Add resource' })}
            </Button>
          </>
        )}
      >
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: t('company.learning.metrics.total', { defaultValue: 'Total' }), value: counts.total },
            { label: t('company.learning.metrics.active', { defaultValue: 'Active' }), value: counts.active },
            { label: t('company.learning.metrics.draft', { defaultValue: 'Draft' }), value: counts.draft },
            { label: t('company.learning.metrics.archived', { defaultValue: 'Archived' }), value: counts.archived },
          ].map((metric) => (
            <SurfaceCard key={metric.label} className="rounded-[22px] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{metric.label}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{metric.value}</div>
            </SurfaceCard>
          ))}
        </div>
      </SectionPanel>

      {formOpen ? (
        <SectionPanel
          title={editingId
            ? t('company.learning.edit_title', { defaultValue: 'Edit learning resource' })
            : t('company.learning.create_title', { defaultValue: 'Create learning resource' })}
          description={t('company.learning.form_body', { defaultValue: 'Skill tags are the primary relevance signal in V1, so keep them specific and clean.' })}
          actions={(
            <Button variant="quiet" onClick={() => {
              resetForm();
              setFormOpen(false);
            }}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
          )}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.title', { defaultValue: 'Title' })}</label>
              <input className={inputClass} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.skill_tags', { defaultValue: 'Skill tags' })}</label>
              <input className={inputClass} value={form.skillTags} onChange={(event) => setForm((current) => ({ ...current, skillTags: event.target.value }))} placeholder={t('company.learning.fields.skill_tags_hint', { defaultValue: 'e.g. SQL, stakeholder management, hospitality ops' })} />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.description', { defaultValue: 'Description' })}</label>
              <textarea className={cn(inputClass, 'min-h-[120px] resize-y')} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.url', { defaultValue: 'Provider URL' })}</label>
              <input className={inputClass} value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.location', { defaultValue: 'Location' })}</label>
              <input className={inputClass} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.provider', { defaultValue: 'Provider label' })}</label>
              <input className={inputClass} value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.partner_name', { defaultValue: 'Partner name' })}</label>
              <input className={inputClass} value={form.partnerName} onChange={(event) => setForm((current) => ({ ...current, partnerName: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.duration', { defaultValue: 'Duration (hours)' })}</label>
              <input className={inputClass} type="number" min="0" value={form.durationHours} onChange={(event) => setForm((current) => ({ ...current, durationHours: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.difficulty', { defaultValue: 'Difficulty' })}</label>
              <select className={inputClass} value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as LearningResource['difficulty'] }))}>
                <option value="Beginner">{t('company.learning.difficulty.beginner', { defaultValue: 'Beginner' })}</option>
                <option value="Intermediate">{t('company.learning.difficulty.intermediate', { defaultValue: 'Intermediate' })}</option>
                <option value="Advanced">{t('company.learning.difficulty.advanced', { defaultValue: 'Advanced' })}</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.price', { defaultValue: 'Price' })}</label>
              <input className={inputClass} type="number" min="0" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.currency', { defaultValue: 'Currency' })}</label>
              <input className={inputClass} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.rating', { defaultValue: 'Rating' })}</label>
              <input className={inputClass} type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.reviews', { defaultValue: 'Reviews count' })}</label>
              <input className={inputClass} type="number" min="0" value={form.reviewsCount} onChange={(event) => setForm((current) => ({ ...current, reviewsCount: event.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">{t('company.learning.fields.status', { defaultValue: 'Status' })}</label>
              <select className={inputClass} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as NonNullable<LearningResource['status']> }))}>
                <option value="active">{t('company.learning.status.active', { defaultValue: 'Active' })}</option>
                <option value="draft">{t('company.learning.status.draft', { defaultValue: 'Draft' })}</option>
                <option value="archived">{t('company.learning.status.archived', { defaultValue: 'Archived' })}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleSave()} loading={saving}>
              <Save size={15} />
              {editingId ? t('company.learning.save_changes', { defaultValue: 'Save changes' }) : t('company.learning.create_resource', { defaultValue: 'Create resource' })}
            </Button>
          </div>
        </SectionPanel>
      ) : null}

      <SectionPanel
        title={t('company.learning.catalog_title', { defaultValue: 'Current catalog' })}
        description={t('company.learning.catalog_body', { defaultValue: 'Only active resources can show up for candidates. Draft stays hidden, archived stays out of ranking.' })}
      >
        {loading ? (
          <SurfaceCard className="rounded-[22px] p-5 text-sm text-[var(--text-muted)]">
            {t('common.loading', { defaultValue: 'Loading...' })}
          </SurfaceCard>
        ) : resources.length === 0 ? (
          <SurfaceCard className="rounded-[22px] p-5 text-sm text-[var(--text-muted)]">
            {t('company.learning.empty', { defaultValue: 'No learning resources yet. Add the first one and it can start appearing in candidate learning paths.' })}
          </SurfaceCard>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {resources.map((resource) => (
              <SurfaceCard key={resource.id} className="rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                      <div className="text-lg font-semibold text-[var(--text-strong)]">{resource.title}</div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-muted)]">{resource.partner_name || resource.provider || companyProfile.name}</div>
                  </div>
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
                    {resource.status || 'active'}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{resource.description || t('company.learning.no_description', { defaultValue: 'No description yet.' })}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(resource.skill_tags || []).slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-3">
                  <div>{t('company.learning.fields.duration', { defaultValue: 'Duration (hours)' })}: <span className="font-semibold text-[var(--text-strong)]">{resource.duration_hours || 0}</span></div>
                  <div>{t('company.learning.fields.price', { defaultValue: 'Price' })}: <span className="font-semibold text-[var(--text-strong)]">{resource.price || 0} {resource.currency || 'CZK'}</span></div>
                  <div>{t('company.learning.fields.difficulty', { defaultValue: 'Difficulty' })}: <span className="font-semibold text-[var(--text-strong)]">{resource.difficulty || 'Beginner'}</span></div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button variant="quiet" onClick={() => {
                    setEditingId(resource.id);
                    setForm(resourceToForm(resource, companyProfile));
                    setFormOpen(true);
                  }}>
                    <Edit3 size={15} />
                    {t('company.learning.edit', { defaultValue: 'Edit' })}
                  </Button>
                  <Button variant="quiet" onClick={() => void handleArchiveToggle(resource)}>
                    <Archive size={15} />
                    {resource.status === 'archived'
                      ? t('company.learning.restore', { defaultValue: 'Restore' })
                      : t('company.learning.archive', { defaultValue: 'Archive' })}
                  </Button>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
};

export default CompanyLearningResourcesWorkspace;
