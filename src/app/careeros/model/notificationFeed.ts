import type { TFunction } from 'i18next';

import type { UserProfile } from '../../../../types';
import { fetchMyDialogueMessages, fetchMyDialoguesWithCapacity } from '../../../../services/jobApplicationService';

export interface NotificationFeedItem {
  id: string;
  kind: 'company_message' | 'dialogue_update' | 'high_match' | 'digest';
  title: string;
  body: string;
  timestamp: string;
  ctaLabel: string;
  challengeId?: string | null;
}

export interface NotificationMatchCandidate {
  id: string;
  title: string;
  company: string;
  score: number;
  location?: string | null;
  salary?: string | null;
  isSaved?: boolean;
}

interface BuildNotificationFeedInput {
  locale?: string;
  matchCandidates: NotificationMatchCandidate[];
  userProfile: Pick<
    UserProfile,
    'id' | 'dailyDigestEnabled' | 'dailyDigestLastSentAt' | 'dailyDigestPushEnabled' | 'dailyDigestTime' | 'dailyDigestTimezone'
  >;
  t: TFunction;
  maxItems?: number;
}

const compactText = (value: string, max = 120): string => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(1, max - 1)).trim()}…`;
};

const normalizeLocale = (value?: string): 'cs' | 'sk' | 'de' | 'pl' | 'en' => {
  const base = String(value || 'en').split('-')[0].toLowerCase();
  if (base === 'at') return 'de';
  if (base === 'cs' || base === 'sk' || base === 'de' || base === 'pl') return base;
  return 'en';
};

const localizedText = (
  locale: string | undefined,
  variants: { cs: string; sk: string; de: string; pl: string; en: string },
): string => variants[normalizeLocale(locale)];

const parseTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildHighMatchNotifications = (
  matchCandidates: NotificationMatchCandidate[],
  t: TFunction,
  now: number,
): NotificationFeedItem[] =>
  matchCandidates
    .filter((candidate) => candidate.score >= 85 && !candidate.isSaved)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((candidate, index) => {
      const bodySegments = [
        `${candidate.company} · ${candidate.score}% match`,
        candidate.location ? compactText(candidate.location, 38) : null,
        candidate.salary ? compactText(candidate.salary, 22) : null,
      ].filter(Boolean);

      return {
        id: `high-match:${candidate.id}`,
        kind: 'high_match',
        title: t('careeros.notifications.new_high_match', {
          defaultValue: 'New high match: {{title}}',
          title: candidate.title,
        }),
        body: bodySegments.join(' · ') || candidate.company,
        timestamp: new Date(now - index * 11 * 60 * 1000).toISOString(),
        ctaLabel: t('careeros.mini.open_challenge', { defaultValue: 'Open challenge' }),
        challengeId: candidate.id,
      };
    });

const buildDialogueStatusNotification = (
  locale: string | undefined,
  dialogue: Awaited<ReturnType<typeof fetchMyDialoguesWithCapacity>>['dialogues'][number],
): NotificationFeedItem | null => {
  const company = String(dialogue.company_name || dialogue.job_snapshot?.company || 'Company').trim() || 'Company';
  const roleTitle = String(dialogue.job_snapshot?.title || '').trim();
  const timestamp = dialogue.updated_at || dialogue.submitted_at || new Date().toISOString();
  const safeRoleTitle = roleTitle || localizedText(locale, {
    cs: 'tvoje reakce',
    sk: 'tvoja reakcia',
    de: 'deine Reaktion',
    pl: 'Twoje zgłoszenie',
    en: 'your challenge',
  });

  if (dialogue.status === 'hired') {
    return {
      id: `dialogue-update:${dialogue.id}:hired`,
      kind: 'dialogue_update',
      title: localizedText(locale, {
        cs: `${company} tě chce posunout do finále`,
        sk: `${company} ťa chce posunúť do finále`,
        de: `${company} will dich in die finale Phase holen`,
        pl: `${company} chce Cię przesunąć do finału`,
        en: `${company} wants to move you into the final stage`,
      }),
      body: localizedText(locale, {
        cs: `${safeRoleTitle} dostala pozitivní rozhodnutí. Vyplatí se zkontrolovat další krok.`,
        sk: `${safeRoleTitle} dostala pozitívne rozhodnutie. Oplatí sa skontrolovať ďalší krok.`,
        de: `Für ${safeRoleTitle} kam ein positives Update an. Es lohnt sich, den nächsten Schritt zu prüfen.`,
        pl: `${safeRoleTitle} dostało pozytywną decyzję. Warto zkontrolować kolejny krok.`,
        en: `${safeRoleTitle} received a positive decision. Worth checking the next step.`,
      }),
      timestamp,
      ctaLabel: localizedText(locale, {
        cs: 'Otevřít profil',
        sk: 'Otvoriť profil',
        de: 'Profil öffnen',
        pl: 'Otwórz profil',
        en: 'Open profile',
      }),
    };
  }

  if (dialogue.status === 'shortlisted') {
    return {
      id: `dialogue-update:${dialogue.id}:shortlisted`,
      kind: 'dialogue_update',
      title: localizedText(locale, {
        cs: `${company} tě posunula dál`,
        sk: `${company} ťa posunula ďalej`,
        de: `${company} hat dich weitergeschoben`,
        pl: `${company} przesunęła Cię dalej`,
        en: `${company} moved you forward`,
      }),
      body: localizedText(locale, {
        cs: `${safeRoleTitle} je dál ve hře. Teď se hodí zkontrolovat reakční okno a další krok.`,
        sk: `${safeRoleTitle} je ďalej v hre. Teraz sa hodí skontrolovať reakčné okno a ďalší krok.`,
        de: `${safeRoleTitle} ist weiter im Rennen. Jetzt lohnt sich ein Blick auf das Reaktionsfenster und den nächsten Schritt.`,
        pl: `${safeRoleTitle} wciąż jest w grze. Warto sprawdzić okno odpowiedzi i kolejny krok.`,
        en: `${safeRoleTitle} is still moving. Good moment to check the response window and next step.`,
      }),
      timestamp,
      ctaLabel: localizedText(locale, {
        cs: 'Otevřít profil',
        sk: 'Otvoriť profil',
        de: 'Profil öffnen',
        pl: 'Otwórz profil',
        en: 'Open profile',
      }),
    };
  }

  if (dialogue.status === 'reviewed') {
    return {
      id: `dialogue-update:${dialogue.id}:reviewed`,
      kind: 'dialogue_update',
      title: localizedText(locale, {
        cs: `${company} si prošla tvoji reakci`,
        sk: `${company} si prešla tvoju reakciu`,
        de: `${company} hat deine Reaktion geprüft`,
        pl: `${company} przejrzała Twoją odpowiedź`,
        en: `${company} reviewed your response`,
      }),
      body: localizedText(locale, {
        cs: `${safeRoleTitle} je teď v pohybu. Jakmile přijde další krok, objeví se tady.`,
        sk: `${safeRoleTitle} je teraz v pohybe. Keď príde ďalší krok, objaví sa tu.`,
        de: `${safeRoleTitle} ist jetzt in Bewegung. Sobald der nächste Schritt kommt, erscheint er hier.`,
        pl: `${safeRoleTitle} jest teraz w ruchu. Gdy pojawi się kolejny krok, zobaczysz go tutaj.`,
        en: `${safeRoleTitle} is now moving. When the next step arrives, it will show up here.`,
      }),
      timestamp,
      ctaLabel: localizedText(locale, {
        cs: 'Otevřít profil',
        sk: 'Otvoriť profil',
        de: 'Profil öffnen',
        pl: 'Otwórz profil',
        en: 'Open profile',
      }),
    };
  }

  if (dialogue.dialogue_current_turn === 'candidate' || dialogue.dialogue_is_overdue) {
    return {
      id: `dialogue-update:${dialogue.id}:turn`,
      kind: 'dialogue_update',
      title: localizedText(locale, {
        cs: `${company} čeká na tvoji odpověď`,
        sk: `${company} čaká na tvoju odpoveď`,
        de: `${company} wartet auf deine Antwort`,
        pl: `${company} czeka na Twoją odpowiedź`,
        en: `${company} is waiting for your reply`,
      }),
      body: localizedText(locale, {
        cs: `${safeRoleTitle} potřebuje další krok z tvé strany. Vyplatí se to nenechat vychladnout.`,
        sk: `${safeRoleTitle} potrebuje ďalší krok z tvojej strany. Oplatí sa to nenechať vychladnúť.`,
        de: `Für ${safeRoleTitle} braucht es den nächsten Schritt von dir. Besser nicht zu lange liegen lassen.`,
        pl: `${safeRoleTitle} potrzebuje kolejnego kroku z Twojej strony. Warto nie zostawiać tego zbyt długo.`,
        en: `${safeRoleTitle} needs the next step from you. Better not let it cool down.`,
      }),
      timestamp,
      ctaLabel: localizedText(locale, {
        cs: 'Otevřít profil',
        sk: 'Otvoriť profil',
        de: 'Profil öffnen',
        pl: 'Otwórz profil',
        en: 'Open profile',
      }),
    };
  }

  if (['rejected', 'closed', 'closed_rejected', 'closed_timeout', 'closed_withdrawn', 'closed_role_filled'].includes(dialogue.status)) {
    return {
      id: `dialogue-update:${dialogue.id}:closed`,
      kind: 'dialogue_update',
      title: localizedText(locale, {
        cs: `${company} poslala update k reakci`,
        sk: `${company} poslala update k reakcii`,
        de: `${company} hat ein Update zu deiner Reaktion geschickt`,
        pl: `${company} wysłała aktualizację do zgłoszenia`,
        en: `${company} sent an update on your application`,
      }),
      body: localizedText(locale, {
        cs: `${safeRoleTitle} se změnila. Otevři profil a zkontroluj detail.`,
        sk: `${safeRoleTitle} sa zmenila. Otvor profil a skontroluj detail.`,
        de: `Bei ${safeRoleTitle} hat sich etwas geändert. Öffne dein Profil und prüfe die Details.`,
        pl: `${safeRoleTitle} się zmieniło. Otwórz profil i sprawdź szczegóły.`,
        en: `${safeRoleTitle} changed state. Open your profile to inspect the details.`,
      }),
      timestamp,
      ctaLabel: localizedText(locale, {
        cs: 'Otevřít profil',
        sk: 'Otvoriť profil',
        de: 'Profil öffnen',
        pl: 'Otwórz profil',
        en: 'Open profile',
      }),
    };
  }

  return null;
};

const buildDigestNotification = (
  locale: string | undefined,
  userProfile: BuildNotificationFeedInput['userProfile'],
): NotificationFeedItem | null => {
  const sentAt = parseTimestamp(userProfile.dailyDigestLastSentAt);
  if (!sentAt) return null;
  if (Date.now() - sentAt > 48 * 60 * 60 * 1000) return null;

  const deliveryMode = userProfile.dailyDigestPushEnabled
    ? localizedText(locale, {
        cs: 'e-mailu a push',
        sk: 'e-mailu a pushu',
        de: 'E-Mail und Push',
        pl: 'e-maila i pusha',
        en: 'email and push',
      })
    : localizedText(locale, {
        cs: 'e-mailu',
        sk: 'e-mailu',
        de: 'E-Mail',
        pl: 'e-maila',
        en: 'email',
      });

  const scheduleHint = userProfile.dailyDigestTime
    ? localizedText(locale, {
        cs: ` kolem ${userProfile.dailyDigestTime}`,
        sk: ` okolo ${userProfile.dailyDigestTime}`,
        de: ` gegen ${userProfile.dailyDigestTime}`,
        pl: ` około ${userProfile.dailyDigestTime}`,
        en: ` around ${userProfile.dailyDigestTime}`,
      })
    : '';

  return {
    id: `digest:${userProfile.dailyDigestLastSentAt}`,
    kind: 'digest',
    title: localizedText(locale, {
      cs: 'Daily digest byl odeslán',
      sk: 'Daily digest bol odoslaný',
      de: 'Daily Digest wurde versendet',
      pl: 'Daily digest został wysłany',
      en: 'Daily digest was sent',
    }),
    body: localizedText(locale, {
      cs: `Poslední souhrn odešel do ${deliveryMode}${scheduleHint}. Nové top matches už se propsaly i sem.`,
      sk: `Posledný súhrn odišiel do ${deliveryMode}${scheduleHint}. Nové top matches sa už premietli aj sem.`,
      de: `Das letzte Update ging per ${deliveryMode}${scheduleHint} raus. Frische Top-Matches sind jetzt auch hier sichtbar.`,
      pl: `Ostatnie podsumowanie poszło przez ${deliveryMode}${scheduleHint}. Świeże top matche už są widoczne także tutaj.`,
      en: `Your latest digest went out via ${deliveryMode}${scheduleHint}. Fresh top matches are reflected here too.`,
    }),
    timestamp: new Date(sentAt).toISOString(),
    ctaLabel: localizedText(locale, {
      cs: 'Otevřít karty',
      sk: 'Otvoriť karty',
      de: 'Karten öffnen',
      pl: 'Otwórz karty',
      en: 'Open cards',
    }),
  };
};

export const buildCareerOSNotificationFeed = async ({
  locale,
  matchCandidates,
  userProfile,
  t,
  maxItems = 8,
}: BuildNotificationFeedInput): Promise<NotificationFeedItem[]> => {
  const now = Date.now();
  const items: NotificationFeedItem[] = buildHighMatchNotifications(matchCandidates, t, now);
  const digestItem = buildDigestNotification(locale, userProfile);
  if (digestItem) items.push(digestItem);

  if (userProfile.id) {
    try {
      const { dialogues } = await fetchMyDialoguesWithCapacity(12);
      const dialogueSnapshots = dialogues
        .filter((dialogue) => {
          const updatedAt = parseTimestamp(dialogue.updated_at || dialogue.submitted_at || null);
          const isFresh = updatedAt > now - 10 * 24 * 60 * 60 * 1000;
          return isFresh || dialogue.dialogue_current_turn === 'candidate' || dialogue.dialogue_is_overdue;
        })
        .sort(
          (left, right) =>
            parseTimestamp(right.updated_at || right.submitted_at || null) - parseTimestamp(left.updated_at || left.submitted_at || null),
        )
        .slice(0, 6);

      const messagesByDialogue = await Promise.all(
        dialogueSnapshots.map(async (dialogue) => ({
          dialogue,
          messages: await fetchMyDialogueMessages(dialogue.id),
        })),
      );

      messagesByDialogue.forEach(({ dialogue, messages }) => {
        const latestUnreadRecruiterMessage = [...messages]
          .reverse()
          .find((message) => message.sender_role === 'recruiter' && !message.read_by_candidate_at);

        if (latestUnreadRecruiterMessage) {
          const company = String(dialogue.company_name || dialogue.job_snapshot?.company || 'Company').trim() || 'Company';
          items.push({
            id: `company-message:${dialogue.id}:${latestUnreadRecruiterMessage.id}`,
            kind: 'company_message',
            title: localizedText(locale, {
              cs: `${company} poslala zprávu`,
              sk: `${company} poslala správu`,
              de: `${company} hat dir geschrieben`,
              pl: `${company} wysłała wiadomość`,
              en: `${company} sent a message`,
            }),
            body: compactText(
              latestUnreadRecruiterMessage.body
                || localizedText(locale, {
                  cs: 'V dialogu čeká nová firemní odpověď.',
                  sk: 'V dialógu čaká nová firemná odpoveď.',
                  de: 'Im Dialog wartet eine neue Antwort vom Unternehmen.',
                  pl: 'W dialogu czeka nowa odpowiedź firmy.',
                  en: 'A new company reply is waiting in your dialogue.',
                }),
              120,
            ),
            timestamp: latestUnreadRecruiterMessage.created_at,
            ctaLabel: localizedText(locale, {
              cs: 'Otevřít profil',
              sk: 'Otvoriť profil',
              de: 'Profil öffnen',
              pl: 'Otwórz profil',
              en: 'Open profile',
            }),
          });
          return;
        }

        const statusNotification = buildDialogueStatusNotification(locale, dialogue);
        if (statusNotification) items.push(statusNotification);
      });
    } catch (error) {
      console.warn('[CareerOS] Failed to build live notification feed:', error);
    }
  }

  const deduped = Array.from(new Map(items.map((item) => [item.id, item])).values());
  return deduped
    .sort((left, right) => parseTimestamp(right.timestamp) - parseTimestamp(left.timestamp))
    .slice(0, maxItems);
};
