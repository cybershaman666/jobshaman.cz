import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  Palette, 
  Mail, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  Shield, 
  Upload,
  Globe,
  Camera,
  Layout,
  RefreshCw,
  Loader2,
  Sparkles
} from 'lucide-react';
import { cn } from '../cn';
import { 
  panelClass, 
  fieldClass, 
  primaryButtonClass, 
  secondaryButtonClass, 
  textareaClass, 
  pillEyebrowClass 
} from '../ui/shellStyles';
import { 
  fetchCompanyMembers, 
  inviteTeammate, 
  updateCompanyProfile 
} from '../../services/v2UserService';
import type { CompanyProfile, UserProfile } from '../../types';

interface RecruiterSettingsPageProps {
  company: CompanyProfile;
  userProfile: UserProfile;
  t: (key: string, options?: any) => string;
  onRefreshCompany: () => Promise<void>;
}

type SettingsTab = 'general' | 'team' | 'brand';

export const RecruiterSettingsPage: React.FC<RecruiterSettingsPageProps> = ({ 
  company, 
  userProfile, 
  t, 
  onRefreshCompany 
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isSaving, setIsSaving] = useState(false);
  
  // General Info State
  const [name, setName] = useState(company.name || '');
  const [website, setWebsite] = useState(company.website_url || (company as any).website || '');
  const [industry, setIndustry] = useState(company.industry || '');
  const [narrative, setNarrative] = useState(company.narrative || '');
  
  // Brand State
  const [brandColor, setBrandColor] = useState(company.brand_color || '#2563eb');
  const [accentColor, setAccentColor] = useState(company.accent_color || '#0ea5e9');
  const [logoUrl, setLogoUrl] = useState(company.logo_url || (company as any).logo || '');
  const [coverUrl, setCoverUrl] = useState(company.cover_url || (company as any).coverImage || '');
  
  // Team State
  const [members, setMembers] = useState<any[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (activeTab === 'team') {
      loadMembers();
    }
  }, [activeTab]);

  const loadMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const data = await fetchCompanyMembers(company.id);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      await updateCompanyProfile(company.id, {
        name,
        website_url: website,
        industry,
        narrative
      });
      await onRefreshCompany();
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    setIsSaving(true);
    try {
      await updateCompanyProfile(company.id, {
        brand_color: brandColor,
        accent_color: accentColor,
        logo_url: logoUrl,
        cover_url: coverUrl
      });
      await onRefreshCompany();
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    setIsInviting(true);
    try {
      await inviteTeammate(company.id, inviteEmail, inviteName);
      setInviteEmail('');
      setInviteName('');
      setIsInviteModalOpen(false);
      loadMembers();
    } catch (err) {
      console.error('Invitation failed', err);
    } finally {
      setIsInviting(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'general', label: t('rebuild.recruiter.settings_general', { defaultValue: 'General' }), icon: Building2 },
    { id: 'team', label: t('rebuild.recruiter.settings_team', { defaultValue: 'Team' }), icon: Users },
    { id: 'brand', label: t('rebuild.recruiter.settings_brand', { defaultValue: 'Brand' }), icon: Palette },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className={pillEyebrowClass}>{t('rebuild.recruiter.settings_label', { defaultValue: 'Workspace Settings' })}</div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{company.name}</h1>
        </div>
        
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main Content Area */}
        <div className="lg:col-span-8">
          {activeTab === 'general' && (
            <div className={cn(panelClass, 'space-y-8 p-8')}>
              <section className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.company_name', { defaultValue: 'Company Name' })}</label>
                    <input 
                      className={fieldClass} 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Acme Corp" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.website', { defaultValue: 'Website' })}</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                        className={cn(fieldClass, 'pl-10')} 
                        value={website} 
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://acme.com" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.industry', { defaultValue: 'Industry' })}</label>
                    <input 
                      className={fieldClass} 
                      value={industry} 
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Technology, Fintech..." 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.narrative', { defaultValue: 'Company Narrative' })}</label>
                    <textarea 
                      className={cn(textareaClass, 'min-h-[200px]')} 
                      value={narrative} 
                      onChange={(e) => setNarrative(e.target.value)}
                      placeholder={t('rebuild.recruiter.narrative_placeholder', { defaultValue: 'Describe what your company does, your mission and culture...' })} 
                    />
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button 
                    onClick={handleSaveGeneral}
                    disabled={isSaving}
                    className={cn(primaryButtonClass, 'gap-2')}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t('rebuild.recruiter.save_changes', { defaultValue: 'Save Changes' })}
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'team' && (
            <div className={cn(panelClass, 'p-0 overflow-hidden')}>
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{t('rebuild.recruiter.team_members', { defaultValue: 'Team Members' })}</h3>
                  <p className="text-sm text-slate-500">{t('rebuild.recruiter.team_copy', { defaultValue: 'Manage who has access to this workspace.' })}</p>
                </div>
                <button 
                  onClick={() => setIsInviteModalOpen(true)}
                  className={cn(primaryButtonClass, 'gap-2 px-4')}
                >
                  <Plus className="h-4 w-4" />
                  {t('rebuild.recruiter.invite_teammate', { defaultValue: 'Invite Teammate' })}
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {isLoadingMembers ? (
                  <div className="flex items-center justify-center p-12 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Users className="mx-auto mb-4 h-12 w-12 opacity-20" />
                    <p>{t('rebuild.recruiter.no_members', { defaultValue: 'No teammates yet.' })}</p>
                  </div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-6 transition-colors hover:bg-slate-50/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">
                          {(member.name || member.invited_name || member.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{member.name || member.invited_name || member.email}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Mail className="h-3 w-3" />
                            {member.email || member.invited_email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {member.status === 'invited' ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 border border-amber-100">
                            {t('rebuild.recruiter.status_invited', { defaultValue: 'Pending' })}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 border border-emerald-100">
                            {t('rebuild.recruiter.status_active', { defaultValue: 'Active' })}
                          </span>
                        )}
                        <div className="text-sm font-medium text-slate-400">
                          {member.role === 'owner' ? t('rebuild.recruiter.role_owner', { defaultValue: 'Owner' }) : t('rebuild.recruiter.role_recruiter', { defaultValue: 'Recruiter' })}
                        </div>
                        {member.user_id !== userProfile.id && member.role !== 'owner' && (
                          <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'brand' && (
            <div className={cn(panelClass, 'space-y-8 p-8')}>
              <section className="space-y-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Palette className="h-5 w-5 text-indigo-500" />
                      {t('rebuild.recruiter.visual_identity', { defaultValue: 'Visual Identity' })}
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.brand_color', { defaultValue: 'Primary Brand Color' })}</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="color" 
                            className="h-12 w-12 cursor-pointer rounded-lg border-2 border-slate-100 p-0 overflow-hidden" 
                            value={brandColor} 
                            onChange={(e) => setBrandColor(e.target.value)}
                          />
                          <input 
                            className={cn(fieldClass, 'font-mono text-sm')} 
                            value={brandColor} 
                            onChange={(e) => setBrandColor(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.accent_color', { defaultValue: 'Accent Color' })}</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="color" 
                            className="h-12 w-12 cursor-pointer rounded-lg border-2 border-slate-100 p-0 overflow-hidden" 
                            value={accentColor} 
                            onChange={(e) => setAccentColor(e.target.value)}
                          />
                          <input 
                            className={cn(fieldClass, 'font-mono text-sm')} 
                            value={accentColor} 
                            onChange={(e) => setAccentColor(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="pt-4 space-y-2">
                        <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.presets', { defaultValue: 'Premium Presets' })}</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { brand: '#2563eb', accent: '#0ea5e9', label: 'Classic Blue' },
                            { brand: '#7c3aed', accent: '#c026d3', label: 'Purple Mist' },
                            { brand: '#059669', accent: '#10b981', label: 'Emerald' },
                            { brand: '#dc2626', accent: '#f87171', label: 'Crimson' },
                            { brand: '#0f172a', accent: '#334155', label: 'Dark Slate' },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() => {
                                setBrandColor(preset.brand);
                                setAccentColor(preset.accent);
                              }}
                              className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 transition-transform hover:scale-110"
                              style={{ background: preset.brand }}
                              title={preset.label}
                            >
                              <div className="h-3 w-3 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-40" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Layout className="h-5 w-5 text-emerald-500" />
                      {t('rebuild.recruiter.assets', { defaultValue: 'Logo & Cover' })}
                    </h3>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.logo', { defaultValue: 'Company Logo' })}</label>
                        <div className="flex items-start gap-4">
                          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                            {logoUrl ? (
                              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                            ) : (
                              <Camera className="h-8 w-8 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input 
                              className={cn(fieldClass, 'text-xs')} 
                              placeholder="https://...logo.png"
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('rebuild.recruiter.logo_hint', { defaultValue: 'Square SVG or PNG is recommended' })}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.cover', { defaultValue: 'Brand Cover' })}</label>
                        <div className="space-y-3">
                          <div className="aspect-[3/1] w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                            {coverUrl ? (
                              <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
                            ) : (
                              <Layout className="h-8 w-8 text-slate-300" />
                            )}
                          </div>
                          <input 
                            className={cn(fieldClass, 'text-xs')} 
                            placeholder="https://...cover.jpg"
                            value={coverUrl}
                            onChange={(e) => setCoverUrl(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-8 border-t border-slate-100">
                  <button 
                    onClick={handleSaveBrand}
                    disabled={isSaving}
                    className={cn(primaryButtonClass, 'gap-2')}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t('rebuild.recruiter.save_branding', { defaultValue: 'Apply Branding' })}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Sidebar / Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-8 space-y-6">
            <div className={cn(panelClass, 'overflow-hidden p-0')}>
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('rebuild.recruiter.preview', { defaultValue: 'Preview' })}</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Globe className="h-3 w-3" />
                  Public Profile
                </span>
              </div>
              
              {/* Mini Preview Card */}
              <div className="p-6">
                <div className="relative mb-4 h-24 overflow-hidden rounded-lg bg-slate-100">
                  {coverUrl && <img src={coverUrl} className="h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-black/10" />
                  <div 
                    className="absolute bottom-3 left-4 h-12 w-12 rounded-xl border-2 border-white bg-white shadow-sm overflow-hidden"
                  >
                    {logoUrl && <img src={logoUrl} className="h-full w-full object-contain p-1" />}
                  </div>
                </div>
                
                <h4 className="text-lg font-bold text-slate-900">{name || company.name}</h4>
                <p className="mt-1 text-xs font-medium text-slate-500 uppercase tracking-wide">{industry || company.industry}</p>
                
                <div className="mt-4 flex gap-2">
                  <div className="h-8 flex-1 rounded-md" style={{ background: brandColor }} />
                  <div className="h-8 w-12 rounded-md" style={{ background: accentColor }} />
                </div>
                
                <p className="mt-4 line-clamp-3 text-sm text-slate-600 italic">
                  "{narrative || company.narrative || (company as any).description || 'No description provided yet...'}"
                </p>
                
                <div className="mt-6 space-y-3">
                  <div className="h-2 w-full rounded bg-slate-100" />
                  <div className="h-2 w-4/5 rounded bg-slate-100" />
                  <div className="h-2 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-indigo-50 p-6 border border-indigo-100">
              <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                <Sparkles className="h-4 w-4" />
                Premium Branding
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-indigo-700/80">
                Your custom colors and logo will be used across your job posts, invitation emails, and the candidate handshake interface.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className={cn(panelClass, 'w-full max-w-md animate-in fade-in zoom-in duration-200')}>
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h3 className="text-xl font-bold text-slate-900">{t('rebuild.recruiter.invite_teammate', { defaultValue: 'Invite Teammate' })}</h3>
              <button 
                onClick={() => setIsInviteModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.invite_email', { defaultValue: 'Email Address' })}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email"
                    required
                    className={cn(fieldClass, 'pl-10')} 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('rebuild.recruiter.invite_name', { defaultValue: 'Full Name (Optional)' })}</label>
                <input 
                  className={fieldClass} 
                  value={inviteName} 
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe" 
                />
              </div>
              
              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={isInviting || !inviteEmail}
                  className={cn(primaryButtonClass, 'w-full gap-2')}
                >
                  {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t('rebuild.recruiter.send_invitation', { defaultValue: 'Send Invitation' })}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
