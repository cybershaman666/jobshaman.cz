import React from 'react';
import {
  Briefcase,
  Check,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Layers,
  Layout,
  ListTodo,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Rocket,
  Settings,
  Sparkles,
  Target,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { cn } from '../cn';
import type { Role, RoleFamily, HandshakeBlueprint, HandshakeBlueprintStep } from '../models';
import type { AssessmentTask } from '../../services/v2ChallengeService';
import {
  fieldClass,
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from '../ui/shellStyles';
import { roleFamilyLabel } from '../shellDomain';

export type RoleEditorStep = 'essence' | 'skills' | 'handshake' | 'logistics' | 'review';

interface RoleEditorProps {
  initialRole?: Partial<Role>;
  onSave: (roleData: any) => Promise<void>;
  onCancel: () => void;
  onAiDraft: (input: any) => Promise<any>;
  busy: boolean;
  t: (key: string, options?: any) => string;
}

export const RoleEditorV2: React.FC<RoleEditorProps> = ({
  initialRole,
  onSave,
  onCancel,
  onAiDraft,
  busy,
  t,
}) => {
  const [currentStep, setCurrentStep] = React.useState<RoleEditorStep>('essence');
  
  // State for role essence
  const [title, setTitle] = React.useState(initialRole?.title || '');
  const [roleFamily, setRoleFamily] = React.useState<RoleFamily>(initialRole?.roleFamily || 'engineering');
  const [summary, setSummary] = React.useState(initialRole?.summary || '');
  const [challenge, setChallenge] = React.useState(initialRole?.challenge || '');
  const [mission, setMission] = React.useState(initialRole?.mission || '');

  // State for skills
  const [skills, setSkills] = React.useState<string[]>(initialRole?.skills || []);
  const [newSkill, setNewSkill] = React.useState('');

  // State for handshake blueprint
  const [blueprintSteps, setBlueprintSteps] = React.useState<HandshakeBlueprintStep[]>(
    (initialRole?.handshakeBlueprint as HandshakeBlueprint)?.steps || []
  );
  const [assessmentTasks, setAssessmentTasks] = React.useState<AssessmentTask[]>(
    (initialRole?.assessmentTasks as AssessmentTask[]) || []
  );

  // State for logistics
  const [location, setLocation] = React.useState(initialRole?.location || '');
  const [workModel, setWorkModel] = React.useState<Role['workModel']>(initialRole?.workModel || 'Hybrid');
  const [salaryFrom, setSalaryFrom] = React.useState(initialRole?.salaryFrom?.toString() || '');
  const [salaryTo, setSalaryTo] = React.useState(initialRole?.salaryTo?.toString() || '');
  const [currency, setCurrency] = React.useState<Role['currency']>(initialRole?.currency || 'CZK');

  const [aiBusy, setAiBusy] = React.useState(false);

  const steps: { id: RoleEditorStep; label: string; icon: any }[] = [
    { id: 'essence', label: t('rebuild.editor.step_essence', { defaultValue: 'Role Essence' }), icon: Rocket },
    { id: 'skills', label: t('rebuild.editor.step_skills', { defaultValue: 'Skills & Benchmarks' }), icon: Target },
    { id: 'handshake', label: t('rebuild.editor.step_handshake', { defaultValue: 'Handshake Journey' }), icon: Zap },
    { id: 'logistics', label: t('rebuild.editor.step_logistics', { defaultValue: 'Logistics' }), icon: Settings },
    { id: 'review', label: t('rebuild.editor.step_review', { defaultValue: 'Review & Launch' }), icon: Layout },
  ];

  const handleNext = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSkill.trim()) {
      if (!skills.includes(newSkill.trim())) {
        setSkills([...skills, newSkill.trim()]);
      }
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleAiAssist = async () => {
    setAiBusy(true);
    try {
      const result = await onAiDraft({
        title,
        roleFamily,
        summary,
        challenge,
        skills,
      });
      
      if (result.ai_output) {
        const out = result.ai_output;
        if (out.title) setTitle(out.title);
        if (out.problem_statement) setSummary(out.problem_statement);
        if (out.mission) setMission(out.mission);
        if (Array.isArray(out.skills)) {
          const newSkills = Array.from(new Set([...skills, ...out.skills]));
          setSkills(newSkills);
        }
        if (Array.isArray(out.assessment_tasks)) {
           setAssessmentTasks(out.assessment_tasks);
        }
        if (out.handshake_blueprint_v1?.steps) {
           setBlueprintSteps(out.handshake_blueprint_v1.steps);
        }
      }
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = () => {
    onSave({
      title,
      roleFamily,
      summary,
      challenge,
      mission,
      skills,
      location,
      workModel,
      salaryFrom: salaryFrom ? parseInt(salaryFrom) : null,
      salaryTo: salaryTo ? parseInt(salaryTo) : null,
      currency,
      assessmentTasks,
      handshakeBlueprint: {
        steps: blueprintSteps,
        roleFamily,
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
            {initialRole?.id ? t('rebuild.editor.edit_title', { defaultValue: 'Edit Role' }) : t('rebuild.editor.create_title', { defaultValue: 'Create New Role' })}
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            {t('rebuild.editor.subtitle', { defaultValue: 'Define the mission and build the assessment journey.' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className={secondaryButtonClass}>
            {t('rebuild.actions.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button 
            onClick={handleSave} 
            disabled={busy || !title} 
            className={cn(primaryButtonClass, 'bg-[#c28a2c] hover:bg-[#a87421] border-[#a87421] shadow-amber-900/20')}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t('rebuild.actions.save_role', { defaultValue: 'Save Role' })}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = steps.findIndex(s => s.id === currentStep) > idx;
            
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group',
                  isActive 
                    ? 'bg-[#fff7e8] text-[#9a6a1d] dark:bg-amber-950/30 dark:text-amber-400' 
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isActive ? 'border-[#c28a2c] bg-[#c28a2c] text-white' : isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 dark:border-slate-700'
                )}>
                  {isCompleted ? <Check size={14} /> : idx + 1}
                </div>
                <span className="flex-1 text-left">{step.label}</span>
                {isActive && <ChevronRight size={14} className="opacity-50" />}
              </button>
            );
          })}

          <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 p-5 border border-indigo-100/50 dark:border-indigo-900/30">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                <Sparkles size={12} />
                {t('rebuild.editor.ai_co_pilot', { defaultValue: 'AI Co-pilot' })}
              </div>
              <p className="mt-3 text-xs leading-5 text-indigo-900/70 dark:text-indigo-300/70">
                {t('rebuild.editor.ai_hint', { defaultValue: 'Let our AI draft the role mission and assessment tasks based on your core title.' })}
              </p>
              <button 
                onClick={handleAiAssist} 
                disabled={aiBusy || !title}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all disabled:opacity-50"
              >
                {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {t('rebuild.editor.generate_draft', { defaultValue: 'Generate AI Draft' })}
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30 p-10">
          <div className="max-w-3xl mx-auto">
            {currentStep === 'essence' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <div className={pillEyebrowClass}>{t('rebuild.editor.section_essence', { defaultValue: 'Step 1: Role Essence' })}</div>
                  <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('rebuild.editor.essence_title', { defaultValue: 'What is this role about?' })}
                  </h3>
                  <p className="mt-2 text-slate-500">
                    {t('rebuild.editor.essence_copy', { defaultValue: 'Define the core identity of the position. A strong title and mission attract high-quality talent.' })}
                  </p>
                </section>

                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.role_title', { defaultValue: 'Role Title' })}
                      <input 
                        value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        placeholder={t('rebuild.editor.title_placeholder', { defaultValue: 'e.g. Senior Frontend Architect' })}
                        className={fieldClass} 
                      />
                    </label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.role_family', { defaultValue: 'Area' })}
                      <select 
                        value={roleFamily} 
                        onChange={e => setRoleFamily(e.target.value as RoleFamily)} 
                        className={fieldClass}
                      >
                        {Object.entries(roleFamilyLabel).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    {t('rebuild.editor.problem_statement', { defaultValue: 'Problem Statement / Challenge' })}
                    <span className="mt-1 block text-xs font-normal text-slate-500 leading-5">
                      {t('rebuild.editor.challenge_hint', { defaultValue: 'What specific problem will this person solve? Why does this role exist right now?' })}
                    </span>
                    <textarea 
                      value={summary} 
                      onChange={e => setSummary(e.target.value)} 
                      rows={4} 
                      placeholder={t('rebuild.editor.challenge_placeholder', { defaultValue: 'e.g. Our current dashboard takes 5 seconds to load. We need someone to lead the performance refactor...' })}
                      className={textareaClass} 
                    />
                  </label>

                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    {t('rebuild.editor.mission', { defaultValue: 'Long-term Mission' })}
                    <span className="mt-1 block text-xs font-normal text-slate-500 leading-5">
                      {t('rebuild.editor.mission_hint', { defaultValue: 'Where will this person take the product or team in 12 months?' })}
                    </span>
                    <textarea 
                      value={mission} 
                      onChange={e => setMission(e.target.value)} 
                      rows={3} 
                      placeholder={t('rebuild.editor.mission_placeholder', { defaultValue: 'e.g. Establish a world-class design system and mentor 5 junior developers.' })}
                      className={textareaClass} 
                    />
                  </label>
                </div>
              </div>
            )}

            {currentStep === 'skills' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <div className={pillEyebrowClass}>{t('rebuild.editor.section_skills', { defaultValue: 'Step 2: Skills & Benchmarks' })}</div>
                  <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('rebuild.editor.skills_title', { defaultValue: 'Define the skill profile' })}
                  </h3>
                  <p className="mt-2 text-slate-500">
                    {t('rebuild.editor.skills_copy', { defaultValue: 'What specific abilities are required? We will use these to match candidates and evaluate their assessments.' })}
                  </p>
                </section>

                <div className="space-y-6">
                  <div className="relative">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {t('rebuild.editor.add_skills', { defaultValue: 'Add Skills' })}
                    </label>
                    <div className="flex gap-2">
                      <input 
                        value={newSkill} 
                        onChange={e => setNewSkill(e.target.value)} 
                        onKeyDown={handleAddSkill}
                        placeholder={t('rebuild.editor.skills_placeholder', { defaultValue: 'e.g. React, TypeScript, Performance Optimization...' })}
                        className={cn(fieldClass, 'mt-0')} 
                      />
                      <button 
                        onClick={() => { if(newSkill.trim()) { setSkills([...skills, newSkill.trim()]); setNewSkill(''); } }}
                        className={cn(primaryButtonClass, 'rounded-xl px-4')}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skills.length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-4">{t('rebuild.editor.no_skills', { defaultValue: 'No skills added yet. Use the field above or AI assistant.' })}</p>
                    ) : (
                      skills.map(skill => (
                        <div key={skill} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 font-semibold text-sm group transition-all hover:border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20">
                          {skill}
                          <button onClick={() => handleRemoveSkill(skill)} className="text-slate-400 hover:text-rose-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
                    <Target className="mx-auto text-slate-300 mb-4" size={32} />
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">{t('rebuild.editor.skill_matching', { defaultValue: 'Automatic skill matching' })}</h4>
                    <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                      {t('rebuild.editor.skill_matching_desc', { defaultValue: 'Candidates with these skills will be automatically prioritized in your talent pool.' })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'handshake' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <div className={pillEyebrowClass}>{t('rebuild.editor.section_handshake', { defaultValue: 'Step 3: Handshake Journey' })}</div>
                  <div className="flex items-center justify-between mt-4">
                    <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {t('rebuild.editor.handshake_title', { defaultValue: 'Build the journey' })}
                    </h3>
                    <button 
                      onClick={() => {
                        const newStep: HandshakeBlueprintStep = {
                          id: `custom-${Date.now()}`,
                          type: 'scenario_response',
                          title: t('rebuild.editor.default_step_title', { defaultValue: 'New Assessment Step' }),
                          prompt: '',
                          helper: '',
                          required: true,
                          uiVariant: 'story_field'
                        };
                        setBlueprintSteps([...blueprintSteps, newStep]);
                      }}
                      className={cn(secondaryButtonClass, 'text-xs py-2 px-3')}
                    >
                      <Plus size={14} /> {t('rebuild.editor.add_step', { defaultValue: 'Add Step' })}
                    </button>
                  </div>
                  <p className="mt-2 text-slate-500">
                    {t('rebuild.editor.handshake_copy', { defaultValue: 'Tailor the candidate experience. Define specific tasks that prove the required skills.' })}
                  </p>
                </section>

                <div className="space-y-4">
                  {blueprintSteps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                      <Zap className="mx-auto text-slate-300 mb-4 opacity-50" size={48} />
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">{t('rebuild.editor.no_steps_title', { defaultValue: 'Your journey is empty' })}</h4>
                      <p className="mt-2 text-sm text-slate-500 mb-6">{t('rebuild.editor.no_steps_desc', { defaultValue: 'Use AI Co-pilot to generate a journey or add steps manually.' })}</p>
                      <button 
                        onClick={handleAiAssist} 
                        className={cn(primaryButtonClass, 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 shadow-indigo-900/20')}
                      >
                        <Sparkles size={16} />
                        {t('rebuild.editor.generate_with_ai', { defaultValue: 'Generate Journey with AI' })}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 relative before:absolute before:left-6 before:top-8 before:bottom-8 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                      {blueprintSteps.map((step, idx) => (
                        <div key={step.id} className="relative pl-14 group">
                          <div className="absolute left-0 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-400 group-hover:border-amber-400 group-hover:text-amber-500 transition-all shadow-sm">
                            <span className="text-xs font-black">{idx + 1}</span>
                          </div>
                          
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <input 
                                    value={step.title} 
                                    onChange={e => {
                                      const next = [...blueprintSteps];
                                      next[idx] = { ...next[idx], title: e.target.value };
                                      setBlueprintSteps(next);
                                    }}
                                    className="text-lg font-bold bg-transparent border-none p-0 focus:ring-0 text-slate-900 dark:text-white w-full"
                                    placeholder={t('rebuild.editor.step_title_placeholder', { defaultValue: 'Step Title' })}
                                  />
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <select 
                                    value={step.type}
                                    onChange={e => {
                                      const next = [...blueprintSteps];
                                      next[idx] = { ...next[idx], type: e.target.value as any };
                                      setBlueprintSteps(next);
                                    }}
                                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-transparent border-none p-0 focus:ring-0"
                                  >
                                    <option value="identity">{t('rebuild.editor.type_identity', { defaultValue: 'Identity' })}</option>
                                    <option value="motivation">{t('rebuild.editor.type_motivation', { defaultValue: 'Motivation' })}</option>
                                    <option value="skill_alignment">{t('rebuild.editor.type_skill_alignment', { defaultValue: 'Skill Alignment' })}</option>
                                    <option value="scenario_response">{t('rebuild.editor.type_scenario_response', { defaultValue: 'Scenario Response' })}</option>
                                    <option value="task_workspace">{t('rebuild.editor.type_task_workspace', { defaultValue: 'Task Workspace' })}</option>
                                    <option value="portfolio_or_proof">{t('rebuild.editor.type_portfolio_proof', { defaultValue: 'Portfolio/Proof' })}</option>
                                    <option value="schedule_request">{t('rebuild.editor.type_schedule', { defaultValue: 'Schedule' })}</option>
                                  </select>
                                </div>
                              </div>
                              <button 
                                onClick={() => setBlueprintSteps(blueprintSteps.filter((_, i) => i !== idx))}
                                className="text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="mt-4 space-y-4">
                              <label className="block">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('rebuild.editor.step_prompt', { defaultValue: 'Task Prompt' })}</span>
                                <textarea 
                                  value={step.prompt}
                                  onChange={e => {
                                    const next = [...blueprintSteps];
                                    next[idx] = { ...next[idx], prompt: e.target.value };
                                    setBlueprintSteps(next);
                                  }}
                                  rows={2}
                                  className={cn(textareaClass, 'mt-1 text-sm py-2 px-3')}
                                  placeholder={t('rebuild.editor.step_prompt_placeholder', { defaultValue: 'What should the candidate do or answer?' })}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('rebuild.editor.step_helper', { defaultValue: 'Helper Text' })}</span>
                                <input 
                                  value={step.helper}
                                  onChange={e => {
                                    const next = [...blueprintSteps];
                                    next[idx] = { ...next[idx], helper: e.target.value };
                                    setBlueprintSteps(next);
                                  }}
                                  className={cn(fieldClass, 'mt-1 text-sm py-2 px-3')}
                                  placeholder={t('rebuild.editor.step_helper_placeholder', { defaultValue: 'Small hint or instruction' })}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 'logistics' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <div className={pillEyebrowClass}>{t('rebuild.editor.section_logistics', { defaultValue: 'Step 4: Logistics & Metadata' })}</div>
                  <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('rebuild.editor.logistics_title', { defaultValue: 'Where and how?' })}
                  </h3>
                  <p className="mt-2 text-slate-500">
                    {t('rebuild.editor.logistics_copy', { defaultValue: 'Finalize the practical details of the role.' })}
                  </p>
                </section>

                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.location', { defaultValue: 'Location' })}
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          value={location} 
                          onChange={e => setLocation(e.target.value)} 
                          placeholder={t('rebuild.editor.location_placeholder', { defaultValue: 'e.g. Prague, CZ' })}
                          className={cn(fieldClass, 'pl-10')} 
                        />
                      </div>
                    </label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.work_model', { defaultValue: 'Collaboration Model' })}
                      <select 
                        value={workModel} 
                        onChange={e => setWorkModel(e.target.value as any)} 
                        className={fieldClass}
                      >
                         <option value="Hybrid">{t('rebuild.recruiter.work_hybrid', { defaultValue: 'Hybrid' })}</option>
                        <option value="Remote">{t('rebuild.recruiter.work_remote', { defaultValue: 'Remote' })}</option>
                        <option value="On-site">{t('rebuild.recruiter.work_onsite', { defaultValue: 'On-site' })}</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.salary_from', { defaultValue: 'Salary From' })}
                      <input 
                        type="number" 
                        value={salaryFrom} 
                        onChange={e => setSalaryFrom(e.target.value)} 
                        className={fieldClass} 
                      />
                    </label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.salary_to', { defaultValue: 'Salary To' })}
                      <input 
                        type="number" 
                        value={salaryTo} 
                        onChange={e => setSalaryTo(e.target.value)} 
                        className={fieldClass} 
                      />
                    </label>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                      {t('rebuild.editor.currency', { defaultValue: 'Currency' })}
                      <select 
                        value={currency} 
                        onChange={e => setCurrency(e.target.value as any)} 
                        className={fieldClass}
                      >
                        <option value="CZK">CZK</option>
                        <option value="EUR">EUR</option>
                        <option value="PLN">PLN</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'review' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <div className={pillEyebrowClass}>{t('rebuild.editor.section_review', { defaultValue: 'Step 5: Review & Launch' })}</div>
                  <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('rebuild.editor.review_title', { defaultValue: 'Ready to publish?' })}
                  </h3>
                  <p className="mt-2 text-slate-500">
                    {t('rebuild.editor.review_copy', { defaultValue: 'Review the role details before making it visible to candidates.' })}
                  </p>
                </section>

                <div className={cn(panelClass, 'p-0 overflow-hidden')}>
                  <div className="bg-slate-900 p-8 text-white">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider">{roleFamilyLabel[roleFamily]}</span>
                      <span className="px-3 py-1 bg-emerald-500 rounded-full text-[10px] font-bold uppercase tracking-wider">{t('rebuild.editor.preview_tag', { defaultValue: 'Skill-First Handshake' })}</span>
                    </div>
                    <h4 className="mt-6 text-4xl font-black tracking-tight leading-[0.95]">{title}</h4>
                    <p className="mt-4 text-lg text-white/70 leading-8 max-w-2xl">{summary}</p>
                    <div className="mt-8 flex flex-wrap gap-4 text-sm font-bold text-white/50">
                      <div className="flex items-center gap-2"><MapPin size={16} /> {location}</div>
                      <div className="flex items-center gap-2"><Clock size={16} /> {workModel}</div>
                      <div className="flex items-center gap-2"><Zap size={16} /> {salaryFrom && salaryTo ? `${salaryFrom} - ${salaryTo} ${currency}` : t('rebuild.editor.salary_tbd', { defaultValue: 'Salary TBD' })}</div>
                    </div>
                  </div>
                  
                  <div className="p-8 space-y-8">
                    <div>
                      <h5 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{t('rebuild.editor.skills_required', { defaultValue: 'Required Skills' })}</h5>
                      <div className="flex flex-wrap gap-2">
                        {skills.map(s => <span key={s} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold">{s}</span>)}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{t('rebuild.editor.handshake_journey', { defaultValue: 'Handshake Journey' })}</h5>
                      <div className="space-y-3">
                        {blueprintSteps.map((step, idx) => (
                          <div key={step.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{step.type.replace('_', ' ')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-center pt-8">
                  <button 
                    onClick={handleSave} 
                    className={cn(primaryButtonClass, 'h-16 px-12 text-lg rounded-[22px] bg-[#c28a2c] hover:bg-[#a87421] border-[#a87421] shadow-2xl shadow-amber-900/30')}
                  >
                    {busy ? <Loader2 size={24} className="animate-spin" /> : <Rocket size={24} />}
                    {t('rebuild.editor.launch_role', { defaultValue: 'Launch Role to Marketplace' })}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Step Controls */}
      <div className="px-10 py-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button 
          onClick={handleBack} 
          disabled={currentStep === 'essence'}
          className={cn(secondaryButtonClass, 'px-8 disabled:opacity-30')}
        >
          {t('rebuild.actions.back', { defaultValue: 'Back' })}
        </button>
        <div className="flex items-center gap-2">
          {steps.map(s => (
            <div 
              key={s.id} 
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                currentStep === s.id ? 'w-8 bg-[#c28a2c]' : 'w-2 bg-slate-200 dark:bg-slate-800'
              )} 
            />
          ))}
        </div>
        <button 
          onClick={currentStep === 'review' ? handleSave : handleNext} 
          className={cn(primaryButtonClass, 'px-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100')}
        >
          {currentStep === 'review' ? t('rebuild.actions.finish', { defaultValue: 'Finish & Publish' }) : t('rebuild.actions.next', { defaultValue: 'Next Step' })}
          {currentStep !== 'review' && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
};
