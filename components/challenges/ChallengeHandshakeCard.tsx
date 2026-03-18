import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bookmark, Handshake, Leaf, MapPin, MessageSquareText, Sparkles, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CommuteAnalysis, Job, JobHumanContext, JobPublicPerson, UserProfile } from '../../types';
import { calculateCommuteReality, isRemoteJob } from '../../services/commuteService';
import { fetchJobHumanContext } from '../../services/jobService';
import { cn, MetricTile, SurfaceCard } from '../ui/primitives';
import { getFallbackCompanyAvatarUrl, isStockCompanyAvatarUrl } from '../../utils/companyStockAvatars';
import { getDomainAccent, getPrimaryJobDomain } from '../../utils/domainAccents';

interface ChallengeHandshakeCardProps {
  job: Job | null;
  userProfile: UserProfile;
  isSaved: boolean;
  onToggleSave: (jobId: string) => void;
  onOpen: (jobId: string) => void;
}

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  if (from || to) return `${(from || to).toLocaleString(locale)} ${currency}`;
  return isCsLike ? 'Mzda neuvedena' : 'Salary not specified';
};

const buildAiReasons = (
  job: Job,
  locale: string,
  commuteAnalysis: CommuteAnalysis | null,
  remoteRole: boolean
): string[] => {
  const reasons: string[] = [];

  if (Array.isArray(job.matchReasons)) {
    for (const reason of job.matchReasons) {
      const text = String(reason || '').trim();
      if (text) reasons.push(text);
    }
  }

  if (remoteRole) {
    reasons.push(
      locale === 'cs' ? 'Rezim prace sedi bez nutnosti dojizdet.' :
      locale === 'sk' ? 'Rezim prace sedi bez potreby dochadzat.' :
      locale === 'de' ? 'Das Arbeitsmodell passt ohne Pendeldruck.' :
      locale === 'pl' ? 'Tryb pracy pasuje bez presji dojazdu.' :
      'The work model fits without commute pressure.'
    );
  } else if (commuteAnalysis) {
    const minutes = commuteAnalysis.timeMinutes * 2;
    if (minutes <= 60) {
      reasons.push(
        locale === 'cs' ? `Dojizdeni vychazi realne kolem ${minutes} minut denne.` :
        locale === 'sk' ? `Dochadzanie vychadza realne okolo ${minutes} minut denne.` :
        locale === 'de' ? `Das Pendeln bleibt realistisch bei etwa ${minutes} Minuten pro Tag.` :
        locale === 'pl' ? `Dojazd wyglada realnie, okolo ${minutes} minut dziennie.` :
        `Commute looks realistic at about ${minutes} minutes a day.`
      );
    }
  } else if (Number.isFinite(Number(job.distanceKm)) && Number(job.distanceKm) > 0 && Number(job.distanceKm) <= 35) {
    const distance = Math.round(Number(job.distanceKm));
    reasons.push(
      locale === 'cs' ? `Je to blizko vasemu okruhu, asi ${distance} km.` :
      locale === 'sk' ? `Je to blizko vasmu okruhu, asi ${distance} km.` :
      locale === 'de' ? `Die Rolle liegt nah an Ihrem Radius, etwa ${distance} km.` :
      locale === 'pl' ? `To blisko Twojego obszaru, okolo ${distance} km.` :
      `It sits close to your area, about ${distance} km away.`
    );
  }

  const jhiScore = Math.round(Number(job.jhi?.score || 0));
  if (jhiScore >= 72) {
    reasons.push(
      locale === 'cs' ? `JHI ${jhiScore}/100 naznacuje lepsi rovnovahu a mensi hluk.` :
      locale === 'sk' ? `JHI ${jhiScore}/100 naznacuje lepsiu rovnovahu a menej hluku.` :
      locale === 'de' ? `JHI ${jhiScore}/100 signalisiert bessere Balance und weniger Larm.` :
      locale === 'pl' ? `JHI ${jhiScore}/100 sugeruje lepsza rownowage i mniej szumu.` :
      `JHI ${jhiScore}/100 suggests better balance and less noise.`
    );
  }

  const mode = String(job.work_model || job.type || '').trim().toLowerCase();
  if (mode === 'hybrid') {
    reasons.push(
      locale === 'cs' ? 'Hybrid dava vic prostoru pro normalni rytmus tydne.' :
      locale === 'sk' ? 'Hybrid dava viac priestoru na normalny rytmus tyzdna.' :
      locale === 'de' ? 'Hybrid lasst mehr Raum fur einen normalen Wochenrhythmus.' :
      locale === 'pl' ? 'Hybrid daje wiecej przestrzeni na normalny rytm tygodnia.' :
      'Hybrid leaves more room for a normal weekly rhythm.'
    );
  }

  return Array.from(new Set(reasons)).slice(0, 3);
};

const ChallengeHandshakeCard: React.FC<ChallengeHandshakeCardProps> = ({
  job,
  userProfile,
  isSaved,
  onToggleSave,
  onOpen,
}) => {
  const { i18n } = useTranslation();
  const getInitials = (value: string): string => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!parts.length) return 'JS';
    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
  };
  const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
  const [humanContext, setHumanContext] = useState<JobHumanContext | null>(null);
  const locale = String(i18n.resolvedLanguage || i18n.language || userProfile?.preferredLocale || 'en')
    .split('-')[0]
    .toLowerCase() || 'en';
  const isCsLike = locale === 'cs' || locale === 'sk';
  const copy = locale === 'cs'
    ? {
      team: 'Tým',
      currentLocation: 'Vaše aktuální poloha',
      aiTitle: 'Proc to AI vytahla nahoru',
      aiBody: 'AI necita jen klicova slova. Sklada dohromady vas smer, dojezd, rezim prace a signal kvality role.',
      aiNextStep: 'Po otevreni dialogu se AI opri i o vas pribeh a profil, aby dalsi doporuceni byla presnejsi.',
      selectNode: 'Vyberte node',
      selectNodeBody: 'Klikněte na roli nebo firmu v mapě.',
      miniCta: 'Vstoupit do mini výzvy',
      companyCta: 'Vstoupit do firmy',
      contact: 'Kontakt',
      locationTbd: 'Lokalita TBD',
      save: 'Uložit',
      saved: 'Uloženo',
      challenge: 'Výzva',
      goal: 'Cíl',
      firstStep: 'První krok',
      risk: 'Riziko',
      fullDescription: 'Celý popis nabídky',
      commuteRemote: 'Remote = žádné dojíždění.',
      commuteLong: '⚠ Dlouhé dojíždění.',
      commuteMixed: '🙂 Přijatelné, ale stojí čas.',
      commuteNear: '🙂 Blízko.',
      commuteMissing: 'Doplň adresu pro výpočet.',
      goodBalance: '🙂 Dobrá rovnováha.',
      mixedBalance: '↔ Střední rovnováha.',
      strain: '⚠ Pozor na zátěž.',
      signInCommute: 'Přihlas se pro výpočet reality dojezdu.',
      addAddress: 'Doplň adresu/souřadnice v profilu pro commute výpočet.',
    }
    : locale === 'sk'
      ? {
        team: 'Tím',
        currentLocation: 'Vaša aktuálna poloha',
        aiTitle: 'Preco to AI vytiahla vyssie',
        aiBody: 'AI necita len klucove slova. Sklada dohromady vas smer, dochadzanie, rezim prace a signal kvality role.',
        aiNextStep: 'Po otvoreni dialogu sa AI oprie aj o vas pribeh a profil, aby dalsie odporucania boli presnejsie.',
        selectNode: 'Vyberte node',
        selectNodeBody: 'Kliknite na rolu alebo firmu v mape.',
        miniCta: 'Vstúpiť do mini výzvy',
        companyCta: 'Vstúpiť do firmy',
        contact: 'Kontakt',
        locationTbd: 'Lokalita TBD',
        save: 'Uložiť',
        saved: 'Uložené',
        challenge: 'Výzva',
        goal: 'Cieľ',
        firstStep: 'Prvý krok',
        risk: 'Riziko',
        fullDescription: 'Celý popis ponuky',
        commuteRemote: 'Remote = žiadne dochádzanie.',
        commuteLong: '⚠ Dlhé dochádzanie.',
        commuteMixed: '🙂 Prijateľné, ale stojí čas.',
        commuteNear: '🙂 Blízko.',
        commuteMissing: 'Doplň adresu pre výpočet.',
        goodBalance: '🙂 Dobrá rovnováha.',
        mixedBalance: '↔ Stredná rovnováha.',
        strain: '⚠ Pozor na záťaž.',
        signInCommute: 'Prihlás sa pre výpočet reality dochádzania.',
        addAddress: 'Doplň adresu/súradnice v profile pre commute výpočet.',
      }
      : locale === 'de'
        ? {
          team: 'Team',
          currentLocation: 'Ihr aktueller Standort',
          aiTitle: 'Warum die AI diese Rolle hochzieht',
          aiBody: 'Die AI liest nicht nur Schlagworte. Sie verbindet Richtung, Pendelrealitat, Arbeitsmodell und Qualitätssignale.',
          aiNextStep: 'Nach dem Offnen eines Dialogs nutzt die AI auch Ihre Story und Ihr Profil, um die nachsten Empfehlungen zu scharfen.',
          selectNode: 'Knoten wählen',
          selectNodeBody: 'Klicken Sie in der Karte auf eine Rolle oder Firma.',
          miniCta: 'Mini-Challenge öffnen',
          companyCta: 'In die Firma eintreten',
          contact: 'Kontakt',
          locationTbd: 'Ort offen',
          save: 'Speichern',
          saved: 'Gespeichert',
          challenge: 'Challenge',
          goal: 'Ziel',
          firstStep: 'Erster Schritt',
          risk: 'Risiko',
          fullDescription: 'Vollständige Beschreibung',
          commuteRemote: 'Remote = kein Pendeln.',
          commuteLong: '⚠ Langer Pendelweg.',
          commuteMixed: '🙂 Okay, kostet aber Zeit.',
          commuteNear: '🙂 In der Nähe.',
          commuteMissing: 'Adresse ergänzen, um es zu berechnen.',
          goodBalance: '🙂 Gute Balance.',
          mixedBalance: '↔ Gemischte Balance.',
          strain: '⚠ Mögliche Belastung.',
          signInCommute: 'Anmelden, um die Pendelrealität zu berechnen.',
          addAddress: 'Adresse/Koordinaten im Profil ergänzen, um Pendeln zu berechnen.',
        }
        : locale === 'pl'
          ? {
            team: 'Zespół',
            currentLocation: 'Twoja aktualna lokalizacja',
            aiTitle: 'Dlaczego AI podbila te role',
            aiBody: 'AI nie czyta tylko slow kluczowych. Laczy Twoj kierunek, dojazd, tryb pracy i sygnaly jakosci roli.',
            aiNextStep: 'Po otwarciu dialogu AI oprze sie tez o Twoja historie i profil, zeby kolejne rekomendacje byly trafniejsze.',
            selectNode: 'Wybierz node',
            selectNodeBody: 'Kliknij rolę albo firmę na mapie.',
            miniCta: 'Wejdź do mini wyzwania',
            companyCta: 'Wejdź do firmy',
            contact: 'Kontakt',
            locationTbd: 'Lokalizacja TBD',
            save: 'Zapisz',
            saved: 'Zapisane',
            challenge: 'Wyzwanie',
            goal: 'Cel',
            firstStep: 'Pierwszy krok',
            risk: 'Ryzyko',
            fullDescription: 'Pełny opis oferty',
            commuteRemote: 'Remote = bez dojazdu.',
            commuteLong: '⚠ Długi dojazd.',
            commuteMixed: '🙂 Da się, ale kosztuje czas.',
            commuteNear: '🙂 Blisko.',
            commuteMissing: 'Dodaj adres, żeby to policzyć.',
            goodBalance: '🙂 Dobra równowaga.',
            mixedBalance: '↔ Mieszana równowaga.',
            strain: '⚠ Uważaj na obciążenie.',
            signInCommute: 'Zaloguj się, żeby policzyć realia dojazdu.',
            addAddress: 'Dodaj adres/współrzędne w profilu, żeby policzyć dojazd.',
          }
          : {
            team: 'Team',
            currentLocation: 'Your current location',
            aiTitle: 'Why AI pushed this role up',
            aiBody: 'AI is not reading keywords only. It combines your direction, commute reality, work model, and quality signals.',
            aiNextStep: 'Once you open a dialogue, AI also leans on your story and profile to sharpen the next recommendations.',
            selectNode: 'Select a node',
            selectNodeBody: 'Click a role or company in the map.',
            miniCta: 'Enter the mini challenge',
            companyCta: 'Enter the company',
            contact: 'Hiring manager',
            locationTbd: 'Location TBD',
            save: 'Save',
            saved: 'Saved',
            challenge: 'Challenge',
            goal: 'Goal',
            firstStep: 'First step',
            risk: 'Risk',
            fullDescription: 'Full Job Description',
            commuteRemote: 'Remote = no commute.',
            commuteLong: '⚠ Long commute.',
            commuteMixed: '🙂 OK, but costs time.',
            commuteNear: '🙂 Nearby.',
            commuteMissing: 'Add address to compute.',
            goodBalance: '🙂 Good life balance.',
            mixedBalance: '↔ Mixed balance.',
            strain: '⚠ Potential strain.',
            signInCommute: 'Sign in to compute commute reality.',
            addAddress: 'Add your address/coordinates to compute commute.',
          };

  const isImported = job ? job.listingKind === 'imported' : false;
  const isNativeChallenge = Boolean(job && !isImported && job.company_id) && String(job?.source || '').trim().toLowerCase() === 'jobshaman.cz';
  const publisher: JobPublicPerson | null = humanContext?.publisher || null;

  const avatarUrl = useMemo(() => {
    if (!job) return '';
    const publisherAvatar = String(publisher?.avatar_url || '').trim();
    if (publisherAvatar) return publisherAvatar;
    const logo = String(job.companyProfile?.logo_url || '').trim();
    return logo || getFallbackCompanyAvatarUrl(job.company);
  }, [job, publisher?.avatar_url]);

  const headerMetaLine = useMemo(() => {
    if (publisher) {
      const role = String(publisher.display_role || '').trim();
      return role ? `${publisher.display_name} · ${role}` : publisher.display_name;
    }
    return copy.team;
  }, [copy.team, publisher]);
  const useAvatarMonogram = isStockCompanyAvatarUrl(avatarUrl);
  const avatarInitials = getInitials(publisher?.display_name || job?.company || 'JobShaman');

  const remoteRole = job ? isRemoteJob(job) : false;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!job || !isNativeChallenge) {
        setHumanContext(null);
        return;
      }
      try {
        const payload = await fetchJobHumanContext(job.id);
        if (!cancelled) setHumanContext(payload);
      } catch (error) {
        console.warn('Human context fetch failed:', error);
        if (!cancelled) setHumanContext(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isNativeChallenge, job]);

  useEffect(() => {
    if (!job) {
      setCommuteAnalysis(null);
      return;
    }
    if (!userProfile?.isLoggedIn) {
      setCommuteAnalysis(null);
      return;
    }
    if ((!userProfile.address && !userProfile.coordinates) && !remoteRole) {
      setCommuteAnalysis(null);
      return;
    }
    try {
      const safeJob = {
        ...job,
        benefits: Array.isArray((job as any).benefits) ? (job as any).benefits : [],
        tags: Array.isArray((job as any).tags) ? (job as any).tags : [],
      } as Job;
      const profileForCalc = userProfile.address
        ? userProfile
        : {
          ...userProfile,
          address: copy.currentLocation,
        };
      setCommuteAnalysis(calculateCommuteReality(safeJob, profileForCalc));
    } catch (err) {
      console.warn('Failed to calculate commute reality', err);
      setCommuteAnalysis(null);
    }
  }, [copy.currentLocation, job, remoteRole, userProfile]);

  if (!job) {
    return (
      <SurfaceCard className="app-organic-panel space-y-3 border-[rgba(var(--accent-rgb),0.14)] bg-white/80 p-5 shadow-[var(--shadow-overlay)] dark:bg-[rgba(15,23,42,0.78)]">
        <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.selectNode}</div>
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          {copy.selectNodeBody}
        </p>
      </SurfaceCard>
    );
  }

  const ctaLabel = job.challenge_format === 'micro_job'
    ? copy.miniCta
    : copy.companyCta;

  const salaryLabel = formatSalary(job, isCsLike ? 'cs-CZ' : 'en', isCsLike);
  const commuteValue = commuteAnalysis
    ? `${commuteAnalysis.timeMinutes * 2} min`
    : remoteRole
      ? '0 min'
      : '—';
  const problem = String(job.challenge || '').trim();
  const goal = String(job.companyGoal || '').trim();
  const firstStep = String(job.firstStepPrompt || '').trim();
  const risk = String(job.risk || '').trim();
  const aiReasons = buildAiReasons(job, locale, commuteAnalysis, remoteRole);
  const domainAccent = getDomainAccent(getPrimaryJobDomain(job));
  const accentStyle = domainAccent
    ? ({
      ['--card-accent-rgb' as any]: domainAccent.rgb,
    } as React.CSSProperties)
    : undefined;

  return (
    <div style={accentStyle}>
      <SurfaceCard className="app-organic-panel relative overflow-hidden border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.14)] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(var(--card-accent-rgb, var(--accent-green-rgb)),0.06)_56%,rgba(246,251,247,0.74))] p-5 shadow-[var(--shadow-overlay)] backdrop-blur-2xl dark:bg-[linear-gradient(135deg,rgba(8,18,12,0.72),rgba(var(--card-accent-rgb, var(--accent-green-rgb)),0.08)_56%,rgba(12,18,14,0.78))]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-35">
          <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),transparent_55%)]" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle at 35% 35%, rgba(var(--card-accent-rgb, var(--accent-green-rgb)),0.22), transparent 60%)' }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {useAvatarMonogram ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.12)] text-sm font-bold text-[var(--text-strong)] ring-1 ring-[rgba(var(--accent-rgb),0.20)] dark:text-white">
                {avatarInitials}
              </div>
            ) : (
              <img
                src={avatarUrl}
                alt={job.company}
                className="h-12 w-12 rounded-2xl object-cover ring-1 ring-[rgba(var(--accent-rgb),0.20)]"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--text-strong)]">{job.company}</div>
              <div className="mt-1 line-clamp-2 break-words text-xs font-medium text-[var(--text-faint)]">{job.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.16)] bg-white/60 px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] dark:bg-white/8">
                  {copy.contact}
                  <span className="truncate text-[var(--text-faint)]">{headerMetaLine}</span>
                </span>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.16)] bg-white/60 px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] dark:bg-white/8">
                  <MapPin size={13} className="text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]" />
                  <span className="truncate">{job.location || copy.locationTbd}</span>
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={cn(
              "shrink-0 rounded-2xl border p-3 transition",
              isSaved
                ? "border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.26)] bg-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.12)] text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]"
                : "border-[var(--border-subtle)] bg-white/70 text-[var(--text-muted)] hover:text-[var(--text-strong)] dark:bg-white/5 dark:hover:bg-white/10"
            )}
            onClick={() => onToggleSave(job.id)}
            title={isSaved ? copy.saved : copy.save}
          >
            <Bookmark size={18} className={isSaved ? 'fill-current' : ''} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {aiReasons.length > 0 ? (
            <div className="app-organic-panel-soft rounded-[1.4rem] border border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(var(--card-accent-rgb, var(--accent-rgb)),0.09))] p-4 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(var(--card-accent-rgb, var(--accent-rgb)),0.12))]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                <Sparkles size={14} className="text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]" />
                {copy.aiTitle}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {copy.aiBody}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aiReasons.map((reason) => (
                  <span
                    key={reason}
                    className="app-organic-pill inline-flex items-center rounded-full border border-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.14)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] dark:bg-white/8"
                  >
                    {reason}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--text-faint)]">
                {copy.aiNextStep}
              </p>
            </div>
          ) : null}

          <div className="app-organic-panel-soft rounded-[1.25rem] border border-[rgba(var(--accent-rgb),0.14)] bg-white/70 p-4 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              <Target size={14} className="text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]" />
              {copy.challenge}
            </div>
            <div className="mt-2 break-words text-sm leading-7 text-[var(--text)]">
              {problem || '—'}
            </div>
          </div>

          {goal ? (
            <div className="app-organic-panel-soft rounded-[1.25rem] border border-[rgba(var(--accent-green-rgb),0.18)] bg-[rgba(var(--accent-green-rgb),0.06)] p-4 dark:bg-[rgba(var(--accent-green-rgb),0.10)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                <Leaf size={14} className="text-[var(--accent-green)]" />
                {copy.goal}
              </div>
              <div className="mt-2 break-words text-sm leading-7 text-[var(--text)]">{goal}</div>
            </div>
          ) : null}

          {firstStep ? (
            <div className="app-organic-panel-soft rounded-[1.25rem] border border-[rgba(var(--accent-rgb),0.14)] bg-[rgba(var(--accent-rgb),0.05)] p-4 dark:bg-[rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                <MessageSquareText size={14} className="text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]" />
                {copy.firstStep}
              </div>
              <div className="mt-2 break-words text-sm leading-7 text-[var(--text)]">{firstStep}</div>
            </div>
          ) : null}

          {risk ? (
            <div className="app-organic-panel-soft rounded-[1.25rem] border border-[rgba(var(--accent-rgb),0.14)] bg-white/60 p-4 dark:bg-white/5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                <AlertTriangle size={14} className="text-[rgba(var(--card-accent-rgb, var(--accent-rgb)),0.92)]" />
                {copy.risk}
              </div>
              <div className="mt-2 break-words text-sm leading-7 text-[var(--text)]">{risk}</div>
            </div>
          ) : null}

          {isImported && (job.aiAnalysis?.summary || job.description) ? (
            <div className="app-organic-panel-soft rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/40 p-4 dark:bg-white/5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" />
                {copy.fullDescription}
              </div>
              <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-muted)]">
                {job.aiAnalysis?.summary || job.description}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label={locale === 'de' ? 'Gehalt' : locale === 'pl' ? 'Pensja' : isCsLike ? 'Mzda' : 'Salary'} value={salaryLabel} tone="accent" />
            <MetricTile
              label={locale === 'de' ? 'Pendeln' : locale === 'pl' ? 'Dojazd' : isCsLike ? 'Dojíždění' : 'Commute'}
              value={commuteValue}
              helper={
                remoteRole
                  ? copy.commuteRemote
                  : commuteAnalysis
                    ? (commuteAnalysis.timeMinutes * 2 >= 90
                      ? copy.commuteLong
                      : commuteAnalysis.timeMinutes * 2 >= 60
                        ? copy.commuteMixed
                        : copy.commuteNear)
                    : copy.commuteMissing
              }
              tone={commuteAnalysis || remoteRole ? 'success' : 'default'}
            />
            <MetricTile
              label="JHI"
              value={`${Math.round(job.jhi?.score || 0)}/100`}
              helper={
                Number(job.jhi?.score || 0) >= 75
                  ? copy.goodBalance
                  : Number(job.jhi?.score || 0) >= 55
                    ? copy.mixedBalance
                    : copy.strain
              }
              tone={Number(job.jhi?.score || 0) >= 70 ? 'success' : 'default'}
            />
            <MetricTile label={locale === 'de' ? 'Modell' : locale === 'pl' ? 'Tryb' : isCsLike ? 'Režim' : 'Mode'} value={String(job.work_model || job.type || '').trim() || '—'} />
          </div>

          <button
            type="button"
            onClick={() => onOpen(job.id)}
            className="app-button-primary app-organic-cta w-full justify-center"
          >
            {job.challenge_format === 'micro_job' ? <Leaf size={16} /> : <Handshake size={16} />}
            {ctaLabel}
            <ArrowRight size={16} />
          </button>

          {!userProfile.isLoggedIn ? (
            <div className="text-center text-xs text-[var(--text-faint)]">
              {copy.signInCommute}
            </div>
          ) : (!remoteRole && !commuteAnalysis && !userProfile.address && !userProfile.coordinates) ? (
            <div className="text-center text-xs text-[var(--text-faint)]">
              {copy.addAddress}
            </div>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
};

export default ChallengeHandshakeCard;
