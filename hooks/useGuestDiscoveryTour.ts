import { useCallback, useEffect, useMemo, useState } from 'react';
import { GuestDiscoveryTourStep } from '../components/GuestDiscoveryTourOverlay';
import { checkCookieConsent, getCookiePreferences } from '../services/cookieConsentService';

const GUEST_DISCOVERY_TOUR_COMPLETED_KEY = 'guest_discovery_tour_completed';
const GUEST_DISCOVERY_TOUR_SEEN_AT_KEY = 'guest_discovery_tour_seen_at';

const shouldBypassCookieBanner = () => {
    const params = new URLSearchParams(window.location.search);
    const cookieBanner = params.get('cookieBanner') || params.get('cookie_banner');
    if (cookieBanner) {
        const value = cookieBanner.toLowerCase();
        return value === '0' || value === 'false' || value === 'off';
    }
    const noCookies = params.get('noCookies') || params.get('no_cookies');
    if (noCookies) {
        const value = noCookies.toLowerCase();
        return value === '1' || value === 'true' || value === 'on';
    }
    return false;
};

const hasCompletedGuestDiscoveryTour = () => {
    try {
        return localStorage.getItem(GUEST_DISCOVERY_TOUR_COMPLETED_KEY) === 'true';
    } catch {
        return false;
    }
};

const markGuestDiscoveryTourCompleted = () => {
    try {
        localStorage.setItem(GUEST_DISCOVERY_TOUR_COMPLETED_KEY, 'true');
        localStorage.setItem(GUEST_DISCOVERY_TOUR_SEEN_AT_KEY, new Date().toISOString());
    } catch (error) {
        console.warn('Failed to persist discovery tour completion:', error);
    }
};

type UseGuestDiscoveryTourArgs = {
    language: string;
    isLoggedIn: boolean;
    isHomeListView: boolean;
};

export const useGuestDiscoveryTour = ({
    language,
    isLoggedIn,
    isHomeListView,
}: UseGuestDiscoveryTourArgs) => {
    const [showCookieBanner, setShowCookieBanner] = useState(false);
    const [pendingGuestDiscoveryTour, setPendingGuestDiscoveryTour] = useState(false);
    const [showGuestDiscoveryTour, setShowGuestDiscoveryTour] = useState(false);

    const guestDiscoveryTourSteps = useMemo<GuestDiscoveryTourStep[]>(() => {
        const locale = (language || 'en').split('-')[0].toLowerCase();
        if (locale === 'sk') {
            return [
                {
                    id: 'search',
                    selector: '#appheader-discovery-search, #challenge-discovery-search',
                    title: '1. Vyhľadávanie je vstup do celej aplikácie',
                    body: 'Začni jedným slovom, rolou alebo firmou. Toto pole je najrýchlejšia cesta, ako okamžite získať použiteľný feed.'
                },
                {
                    id: 'setup',
                    selector: '#challenge-marketplace-setup-card, #challenge-why-roles',
                    title: '2. Životná situácia + JHI',
                    body: 'Shaman neradí ponuky len všeobecne. Berie do úvahy aj tvoju situáciu, smer a osobnú rozhodovaciu vrstvu, aby feed nebol len zoznam bez priority.'
                },
                {
                    id: 'geography',
                    selector: '#challenge-location-scope-section, #challenge-commute-section',
                    title: '3. Geografia a prihraničie',
                    body: 'Tu riadiš, kam má vyhľadávanie siahať: len domáci trh, aj okolité trhy alebo len zahraničie. V kombinácii s dochádzaním to dáva zmysel hlavne ľuďom pri hraniciach.'
                },
                {
                    id: 'slots',
                    selector: '#challenge-slots-card',
                    title: '4. Slotový systém',
                    body: 'Nejde o nekonečné rozosielanie CV. Aktívne dialógy sú obmedzené, aby si sa sústredil na reálne konverzácie s vyššou šancou na odpoveď.'
                },
                {
                    id: 'jcfpm',
                    selector: '#challenge-premium-feature-jcfpm',
                    title: '5. JCFPM a hlbší kontext',
                    body: 'JCFPM a ďalšie podporné vrstvy pomáhajú systému pochopiť, ako funguješ a čo je pre teba dlhodobo udržateľné, nielen čo vieš napísať do CV.'
                }
            ];
        }
        if (locale === 'de' || locale === 'at') {
            return [
                {
                    id: 'search',
                    selector: '#appheader-discovery-search, #challenge-discovery-search',
                    title: '1. Die Suche ist der Einstieg in die gesamte App',
                    body: 'Starte mit einem Stichwort, einer Rolle oder einem Unternehmen. Dieses Feld ist der schnellste Weg zu einem sofort nutzbaren Feed.'
                },
                {
                    id: 'setup',
                    selector: '#challenge-marketplace-setup-card, #challenge-why-roles',
                    title: '2. Lebenssituation + JHI',
                    body: 'Shaman sortiert Rollen nicht nur allgemein. Das System berücksichtigt auch deinen Kontext, deine Richtung und eine persönliche Entscheidungsebene, damit der Feed nicht nur eine flache Liste ist.'
                },
                {
                    id: 'geography',
                    selector: '#challenge-location-scope-section, #challenge-commute-section',
                    title: '3. Geografie und Grenzregionen',
                    body: 'Hier steuerst du, wie weit die Suche reichen soll: nur Heimatmarkt, auch benachbarte Märkte oder nur Ausland. Zusammen mit Pendeldistanz ist das besonders nahe der Grenze relevant.'
                },
                {
                    id: 'slots',
                    selector: '#challenge-slots-card',
                    title: '4. Das Slot-System',
                    body: 'Es geht nicht um endloses CV-Versenden. Aktive Dialoge sind begrenzt, damit du dich auf reale Gespräche mit höherer Antwortwahrscheinlichkeit konzentrierst.'
                },
                {
                    id: 'jcfpm',
                    selector: '#challenge-premium-feature-jcfpm',
                    title: '5. JCFPM und tieferer Kontext',
                    body: 'JCFPM und weitere Schichten helfen dem System zu verstehen, wie du arbeitest und was für dich langfristig tragfähig ist, nicht nur was in deinem CV steht.'
                }
            ];
        }
        if (locale === 'pl') {
            return [
                {
                    id: 'search',
                    selector: '#appheader-discovery-search, #challenge-discovery-search',
                    title: '1. Wyszukiwanie to główne wejście do aplikacji',
                    body: 'Zacznij od jednego słowa, roli albo firmy. To pole jest najszybszą drogą do natychmiast użytecznego feedu.'
                },
                {
                    id: 'setup',
                    selector: '#challenge-marketplace-setup-card, #challenge-why-roles',
                    title: '2. Sytuacja życiowa + JHI',
                    body: 'Shaman nie układa ofert tylko ogólnie. Bierze pod uwagę także Twoją sytuację, kierunek i osobistą warstwę decyzyjną, żeby feed nie był tylko płaską listą.'
                },
                {
                    id: 'geography',
                    selector: '#challenge-location-scope-section, #challenge-commute-section',
                    title: '3. Geografia i region przygraniczny',
                    body: 'Tutaj ustawiasz, jak daleko ma sięgać wyszukiwanie: tylko rynek krajowy, także rynki sąsiednie albo tylko zagranica. W połączeniu z dojazdem ma to szczególny sens blisko granicy.'
                },
                {
                    id: 'slots',
                    selector: '#challenge-slots-card',
                    title: '4. System slotów',
                    body: 'Nie chodzi o nieskończone wysyłanie CV. Aktywne dialogi są ograniczone, żeby skupić się na realnych rozmowach z większą szansą na odpowiedź.'
                },
                {
                    id: 'jcfpm',
                    selector: '#challenge-premium-feature-jcfpm',
                    title: '5. JCFPM i głębszy kontekst',
                    body: 'JCFPM i kolejne warstwy pomagają systemowi zrozumieć, jak działasz i co jest dla Ciebie długoterminowo zrównoważone, a nie tylko co wpiszesz do CV.'
                }
            ];
        }
        const isCsLike = locale === 'cs';
        return [
            {
                id: 'search',
                selector: '#appheader-discovery-search, #challenge-discovery-search',
                title: isCsLike ? '1. Vyhledávání je vstup do celé aplikace' : '1. Search is the main entry point',
                body: isCsLike
                    ? 'Začni jedním slovem, rolí nebo firmou. Tohle pole je nejrychlejší cesta, jak okamžitě dostat použitelný feed.'
                    : 'Start with one keyword, role, or company. This field is the fastest way to get a usable feed immediately.'
            },
            {
                id: 'setup',
                selector: '#challenge-marketplace-setup-card, #challenge-why-roles',
                title: isCsLike ? '2. Životní situace + JHI' : '2. Life context + JHI',
                body: isCsLike
                    ? 'Shaman neřadí nabídky jen obecně. Bere v úvahu i tvoji situaci, směr a osobní rozhodovací vrstvu, aby feed nebyl jen seznam bez priority.'
                    : 'Shaman does not rank roles generically. It also uses your context, direction, and personal decision layer so the feed is more than an undifferentiated list.'
            },
            {
                id: 'geography',
                selector: '#challenge-location-scope-section, #challenge-commute-section',
                title: isCsLike ? '3. Geografie a příhraničí' : '3. Geography and cross-border scope',
                body: isCsLike
                    ? 'Tady řídíš, kde má hledání sahat: jen domácí trh, i okolní trhy, nebo jen zahraničí. V kombinaci s dojížděním to dává smysl hlavně lidem u hranic.'
                    : 'This controls where search should reach: only your home market, nearby markets too, or only abroad. Combined with commute, this is especially useful near borders.'
            },
            {
                id: 'slots',
                selector: '#challenge-slots-card',
                title: isCsLike ? '4. Slotový systém' : '4. The slot system',
                body: isCsLike
                    ? 'Nejde o nekonečné rozesílání CV. Aktivní dialogy jsou omezené, aby ses soustředil na reálné konverzace s vyšší šancí na odpověď.'
                    : 'This is not about endless CV spraying. Active dialogues are limited so you focus on real conversations with a higher chance of response.'
            },
            {
                id: 'jcfpm',
                selector: '#challenge-premium-feature-jcfpm',
                title: isCsLike ? '5. JCFPM a hlubší kontext' : '5. JCFPM and deeper context',
                body: isCsLike
                    ? 'JCFPM a další podpůrné vrstvy pomáhají systému pochopit, jak funguješ a co je pro tebe dlouhodobě udržitelné, ne jen co umíš napsat do CV.'
                    : 'JCFPM and the supporting layers help the system understand how you operate and what is sustainable for you long term, not only what you can list on a CV.'
            }
        ];
    }, [language]);

    const guestDiscoveryTourLabels = useMemo(() => {
        const locale = (language || 'en').split('-')[0].toLowerCase();
        if (locale === 'cs') {
            return {
                skip: 'Přeskočit',
                back: 'Zpět',
                next: 'Další',
                finish: 'Dokončit',
                close: 'Zavřít průvodce'
            };
        }
        if (locale === 'sk') {
            return {
                skip: 'Preskočiť',
                back: 'Späť',
                next: 'Ďalej',
                finish: 'Dokončiť',
                close: 'Zavrieť sprievodcu'
            };
        }
        if (locale === 'de' || locale === 'at') {
            return {
                skip: 'Überspringen',
                back: 'Zurück',
                next: 'Weiter',
                finish: 'Fertig',
                close: 'Tour schließen'
            };
        }
        if (locale === 'pl') {
            return {
                skip: 'Pomiń',
                back: 'Wstecz',
                next: 'Dalej',
                finish: 'Zakończ',
                close: 'Zamknij przewodnik'
            };
        }
        return {
            skip: 'Skip',
            back: 'Back',
            next: 'Next',
            finish: 'Finish',
            close: 'Close tour'
        };
    }, [language]);

    useEffect(() => {
        if (shouldBypassCookieBanner()) {
            setShowCookieBanner(false);
            return;
        }
        const hasConsent = checkCookieConsent();
        setShowCookieBanner(!hasConsent);

        if (hasConsent) {
            const preferences = getCookiePreferences();
            if (preferences?.analytics) {
                console.log('Analytics consent granted');
            }
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            setPendingGuestDiscoveryTour(false);
            setShowGuestDiscoveryTour(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (!pendingGuestDiscoveryTour || showCookieBanner || isLoggedIn || !isHomeListView) {
            return;
        }
        if (hasCompletedGuestDiscoveryTour()) {
            setPendingGuestDiscoveryTour(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setShowGuestDiscoveryTour(true);
            setPendingGuestDiscoveryTour(false);
        }, 280);

        return () => window.clearTimeout(timeoutId);
    }, [isHomeListView, isLoggedIn, pendingGuestDiscoveryTour, showCookieBanner]);

    const handleCookieAccept = useCallback((preferences: any) => {
        console.log('Cookie preferences accepted:', preferences);
        setShowCookieBanner(false);
        if (!isLoggedIn && !hasCompletedGuestDiscoveryTour()) {
            setPendingGuestDiscoveryTour(true);
        }
    }, [isLoggedIn]);

    const handleCookieCustomize = useCallback(() => {
        console.log('Customize cookie preferences');
        setShowCookieBanner(false);
    }, []);

    const completeGuestDiscoveryTour = useCallback(() => {
        markGuestDiscoveryTourCompleted();
        setShowGuestDiscoveryTour(false);
        setPendingGuestDiscoveryTour(false);
    }, []);

    return {
        showCookieBanner,
        showGuestDiscoveryTour,
        guestDiscoveryTourSteps,
        guestDiscoveryTourLabels,
        handleCookieAccept,
        handleCookieCustomize,
        completeGuestDiscoveryTour,
    };
};
