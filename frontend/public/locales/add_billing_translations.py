#!/usr/bin/env python3
"""Add billing translation keys to all supported languages."""
import json
import os

LOCALES_DIR = os.path.dirname(os.path.abspath(__file__))
LANGUAGES = ["en", "cs", "sk", "pl", "de", "at", "da", "sv", "no", "fi"]

# All billing-related translation keys with translations per language
BILLING_TRANSLATIONS = {
    "rebuild.recruiter.nav_billing": {
        "en": "Subscription", "cs": "Předplatné", "sk": "Predplatné", "pl": "Subskrypcja",
        "de": "Abonnement", "at": "Abonnement", "da": "Abonnement", "sv": "Prenumeration",
        "no": "Abonnement", "fi": "Tilaus",
    },
    "rebuild.recruiter.subtitle_billing": {
        "en": "Plan details, usage tracking, invoices, and payment management.",
        "cs": "Detail tarifu, sledování spotřeby, faktury a správa plateb.",
        "sk": "Detail tarifu, sledovanie spotreby, faktúry a správa platieb.",
        "pl": "Szczegóły planu, śledzenie zużycia, faktury i zarządzanie płatnościami.",
        "de": "Plandetails, Nutzungsverfolgung, Rechnungen und Zahlungsverwaltung.",
        "at": "Plandetails, Nutzungsverfolgung, Rechnungen und Zahlungsverwaltung.",
        "da": "Plandetaljer, forbrugssporing, fakturaer og betalingshåndtering.",
        "sv": "Plandetaljer, användningsspårning, fakturor och betalningshantering.",
        "no": "Plandetaljer, brukssporing, fakturaer og betalingshåndtering.",
        "fi": "Tilaustiedot, käytön seuranta, laskut ja maksujen hallinta.",
    },
    "rebuild.billing.current_plan": {
        "en": "Current plan", "cs": "Aktuální tarif", "sk": "Aktuálny tarif", "pl": "Aktualny plan",
        "de": "Aktueller Plan", "at": "Aktueller Plan", "da": "Nuværende plan", "sv": "Nuvarande plan",
        "no": "Gjeldende plan", "fi": "Nykyinen tilaus",
    },
    "rebuild.billing.active": {
        "en": "Active", "cs": "Aktivní", "sk": "Aktívne", "pl": "Aktywna",
        "de": "Aktiv", "at": "Aktiv", "da": "Aktiv", "sv": "Aktiv",
        "no": "Aktiv", "fi": "Aktiivinen",
    },
    "rebuild.billing.manage_payments": {
        "en": "Manage payments", "cs": "Správa plateb", "sk": "Správa platieb", "pl": "Zarządzaj płatnościami",
        "de": "Zahlungen verwalten", "at": "Zahlungen verwalten", "da": "Administrer betalinger", "sv": "Hantera betalningar",
        "no": "Administrer betalinger", "fi": "Hallitse maksuja",
    },
    "rebuild.billing.refresh": {
        "en": "Refresh", "cs": "Obnovit", "sk": "Obnoviť", "pl": "Odśwież",
        "de": "Aktualisieren", "at": "Aktualisieren", "da": "Opdater", "sv": "Uppdatera",
        "no": "Oppdater", "fi": "Päivitä",
    },
    "rebuild.billing.next_renewal": {
        "en": "Next renewal", "cs": "Další obnovení", "sk": "Ďalšie obnovenie", "pl": "Następne odnowienie",
        "de": "Nächste Verlängerung", "at": "Nächste Verlängerung", "da": "Næste fornyelse", "sv": "Nästa förnyelse",
        "no": "Neste fornyelse", "fi": "Seuraava uusinta",
    },
    "rebuild.billing.expires": {
        "en": "Expires", "cs": "Vyprší", "sk": "Vyprší", "pl": "Wygasa",
        "de": "Läuft ab", "at": "Läuft ab", "da": "Udløber", "sv": "Upphör",
        "no": "Utløper", "fi": "Vanhenee",
    },
    "rebuild.billing.days_remaining": {
        "en": "Days remaining", "cs": "Zbývá dní", "sk": "Zostáva dní", "pl": "Dni pozostało",
        "de": "Verbleibende Tage", "at": "Verbleibende Tage", "da": "Dage tilbage", "sv": "Dagar kvar",
        "no": "Dager igjen", "fi": "Päiviä jäljellä",
    },
    "rebuild.billing.usage_overview": {
        "en": "Usage overview", "cs": "Přehled spotřeby", "sk": "Prehľad spotreby", "pl": "Przegląd zużycia",
        "de": "Nutzungsübersicht", "at": "Nutzungsübersicht", "da": "Forbrugsoversigt", "sv": "Användningsöversikt",
        "no": "Bruksoversikt", "fi": "Käyttökatsaus",
    },
    "rebuild.billing.ai_screenings": {
        "en": "AI screenings", "cs": "AI hodnocení", "sk": "AI hodnotenia", "pl": "Oceny AI",
        "de": "KI-Bewertungen", "at": "KI-Bewertungen", "da": "AI-vurderinger", "sv": "AI-bedömningar",
        "no": "AI-vurderinger", "fi": "Tekoälyarvioinnit",
    },
    "rebuild.billing.active_roles": {
        "en": "Active roles", "cs": "Aktivní role", "sk": "Aktívne role", "pl": "Aktywne role",
        "de": "Aktive Rollen", "at": "Aktive Rollen", "da": "Aktive roller", "sv": "Aktiva roller",
        "no": "Aktive roller", "fi": "Aktiiviset roolit",
    },
    "rebuild.billing.dialogue_slots": {
        "en": "Dialogue slots", "cs": "Sloty dialogů", "sk": "Sloty dialógov", "pl": "Sloty dialogów",
        "de": "Dialog-Slots", "at": "Dialog-Slots", "da": "Dialogpladser", "sv": "Dialogplatser",
        "no": "Dialogplasser", "fi": "Dialogipaikat",
    },
    "rebuild.billing.role_opens": {
        "en": "Role opens", "cs": "Otevření rolí", "sk": "Otvorenia rolí", "pl": "Otwarcia ról",
        "de": "Rollen-Öffnungen", "at": "Rollen-Öffnungen", "da": "Rolleåbninger", "sv": "Rollöppningar",
        "no": "Rolleåpninger", "fi": "Rooliavaukset",
    },
    "rebuild.billing.plans": {
        "en": "Available plans", "cs": "Dostupné tarify", "sk": "Dostupné tarify", "pl": "Dostępne plany",
        "de": "Verfügbare Pläne", "at": "Verfügbare Pläne", "da": "Tilgængelige planer", "sv": "Tillgängliga planer",
        "no": "Tilgjengelige planer", "fi": "Saatavilla olevat tilaukset",
    },
    "rebuild.billing.choose_plan": {
        "en": "Choose the right plan for your team",
        "cs": "Vyberte správný tarif pro váš tým",
        "sk": "Vyberte správny tarif pre váš tím",
        "pl": "Wybierz odpowiedni plan dla swojego zespołu",
        "de": "Wählen Sie den richtigen Plan für Ihr Team",
        "at": "Wählen Sie den richtigen Plan für Ihr Team",
        "da": "Vælg den rigtige plan for dit team",
        "sv": "Välj rätt plan för ditt team",
        "no": "Velg riktig plan for teamet ditt",
        "fi": "Valitse oikea tilaus tiimillesi",
    },
    "rebuild.billing.current": {
        "en": "Current", "cs": "Aktuální", "sk": "Aktuálny", "pl": "Aktualny",
        "de": "Aktuell", "at": "Aktuell", "da": "Nuværende", "sv": "Nuvarande",
        "no": "Gjeldende", "fi": "Nykyinen",
    },
    "rebuild.billing.current_plan_btn": {
        "en": "Current plan", "cs": "Aktuální tarif", "sk": "Aktuálny tarif", "pl": "Aktualny plan",
        "de": "Aktueller Plan", "at": "Aktueller Plan", "da": "Nuværende plan", "sv": "Nuvarande plan",
        "no": "Gjeldende plan", "fi": "Nykyinen tilaus",
    },
    "rebuild.billing.upgrade": {
        "en": "Upgrade", "cs": "Upgradovat", "sk": "Upgradovať", "pl": "Ulepsz",
        "de": "Upgraden", "at": "Upgraden", "da": "Opgrader", "sv": "Uppgradera",
        "no": "Oppgrader", "fi": "Päivitä",
    },
    "rebuild.billing.switch": {
        "en": "Switch plan", "cs": "Změnit tarif", "sk": "Zmeniť tarif", "pl": "Zmień plan",
        "de": "Plan wechseln", "at": "Plan wechseln", "da": "Skift plan", "sv": "Byt plan",
        "no": "Bytt plan", "fi": "Vaihda tilausta",
    },
    "rebuild.billing.select": {
        "en": "Select", "cs": "Vybrat", "sk": "Vybrať", "pl": "Wybierz",
        "de": "Auswählen", "at": "Auswählen", "da": "Vælg", "sv": "Välj",
        "no": "Velg", "fi": "Valitse",
    },
    "rebuild.billing.candidates_in_process": {
        "en": "candidates in process", "cs": "kandidátů v procesu", "sk": "kandidátov v procese", "pl": "kandydatów w procesie",
        "de": "Kandidaten im Prozess", "at": "Kandidaten im Prozess", "da": "kandidater i proces", "sv": "kandidater i process",
        "no": "kandidater i prosess", "fi": "hakijaa prosessissa",
    },
    "rebuild.billing.ai_screenings_month": {
        "en": "AI screenings/month", "cs": "AI hodnocení/měsíc", "sk": "AI hodnotení/mesiac", "pl": "ocen AI/miesiąc",
        "de": "KI-Bewertungen/Monat", "at": "KI-Bewertungen/Monat", "da": "AI-vurderinger/måned", "sv": "AI-bedömningar/månad",
        "no": "AI-vurderinger/måned", "fi": "tekoälyarviointia/kk",
    },
    "rebuild.billing.team_members": {
        "en": "team members", "cs": "členů týmu", "sk": "členov tímu", "pl": "członków zespołu",
        "de": "Teammitglieder", "at": "Teammitglieder", "da": "teammedlemmer", "sv": "teammedlemmar",
        "no": "teammedlemmer", "fi": "tiimin jäsentä",
    },
    "rebuild.billing.cancel_title": {
        "en": "Cancel subscription", "cs": "Zrušit předplatné", "sk": "Zrušiť predplatné", "pl": "Anuluj subskrypcję",
        "de": "Abonnement kündigen", "at": "Abonnement kündigen", "da": "Annuller abonnement", "sv": "Avbryt prenumeration",
        "no": "Avbryt abonnement", "fi": "Peruuta tilaus",
    },
    "rebuild.billing.cancel_desc": {
        "en": "Your features will stay active until the end of the billing period.",
        "cs": "Vaše funkce zůstanou aktivní do konce fakturačního období.",
        "sk": "Vaše funkcie zostanú aktívne do konca fakturačného obdobia.",
        "pl": "Twoje funkcje pozostaną aktywne do końca okresu rozliczeniowego.",
        "de": "Ihre Funktionen bleiben bis zum Ende des Abrechnungszeitraums aktiv.",
        "at": "Ihre Funktionen bleiben bis zum Ende des Abrechnungszeitraums aktiv.",
        "da": "Dine funktioner forbliver aktive til slutningen af faktureringsperioden.",
        "sv": "Dina funktioner förblir aktiva till slutet av faktureringsperioden.",
        "no": "Funksjonene dine forblir aktive til slutten av faktureringsperioden.",
        "fi": "Ominaisuutesi pysyvät aktiivisina laskutuskauden loppuun asti.",
    },
    "rebuild.billing.cancel_btn": {
        "en": "Cancel", "cs": "Zrušit", "sk": "Zrušiť", "pl": "Anuluj",
        "de": "Kündigen", "at": "Kündigen", "da": "Annuller", "sv": "Avbryt",
        "no": "Avbryt", "fi": "Peruuta",
    },
    "rebuild.billing.cancel_warning": {
        "en": "Are you sure you want to cancel? Your subscription will remain active until the end of the current billing period.",
        "cs": "Opravdu chcete zrušit? Předplatné zůstane aktivní do konce aktuálního fakturačního období.",
        "sk": "Naozaj chcete zrušiť? Predplatné zostane aktívne do konca aktuálneho fakturačného obdobia.",
        "pl": "Czy na pewno chcesz anulować? Subskrypcja pozostanie aktywna do końca bieżącego okresu rozliczeniowego.",
        "de": "Sind Sie sicher? Ihr Abonnement bleibt bis zum Ende des aktuellen Abrechnungszeitraums aktiv.",
        "at": "Sind Sie sicher? Ihr Abonnement bleibt bis zum Ende des aktuellen Abrechnungszeitraums aktiv.",
        "da": "Er du sikker? Dit abonnement forbliver aktivt til slutningen af den aktuelle faktureringsperiode.",
        "sv": "Är du säker? Din prenumeration förblir aktiv till slutet av den aktuella faktureringsperioden.",
        "no": "Er du sikker? Abonnementet ditt forblir aktivt til slutten av gjeldende faktureringsperiode.",
        "fi": "Oletko varma? Tilauksesi pysyy aktiivisena nykyisen laskutuskauden loppuun asti.",
    },
    "rebuild.billing.keep_plan": {
        "en": "Keep plan", "cs": "Ponechat tarif", "sk": "Ponechať tarif", "pl": "Zachowaj plan",
        "de": "Plan behalten", "at": "Plan behalten", "da": "Behold plan", "sv": "Behåll plan",
        "no": "Behold plan", "fi": "Pidä tilaus",
    },
    "rebuild.billing.confirm_cancel": {
        "en": "Yes, cancel subscription", "cs": "Ano, zrušit předplatné", "sk": "Áno, zrušiť predplatné", "pl": "Tak, anuluj subskrypcję",
        "de": "Ja, Abonnement kündigen", "at": "Ja, Abonnement kündigen", "da": "Ja, annuller abonnement", "sv": "Ja, avbryt prenumeration",
        "no": "Ja, avbryt abonnement", "fi": "Kyllä, peruuta tilaus",
    },
    "rebuild.billing.cancel_error": {
        "en": "Failed to cancel subscription. Please try again.",
        "cs": "Nepodařilo se zrušit předplatné. Zkuste to prosím znovu.",
        "sk": "Nepodarilo sa zrušiť predplatné. Skúste to prosím znova.",
        "pl": "Nie udało się anulować subskrypcji. Spróbuj ponownie.",
        "de": "Abonnement konnte nicht gekündigt werden. Bitte versuchen Sie es erneut.",
        "at": "Abonnement konnte nicht gekündigt werden. Bitte versuchen Sie es erneut.",
        "da": "Kunne ikke annullere abonnementet. Prøv venligst igen.",
        "sv": "Kunde inte avbryta prenumerationen. Försök igen.",
        "no": "Kunne ikke avbryte abonnementet. Prøv igjen.",
        "fi": "Tilauksen peruuttaminen epäonnistui. Yritä uudelleen.",
    },
    "rebuild.billing.load_error": {
        "en": "Failed to load subscription details.",
        "cs": "Nepodařilo se načíst údaje o předplatném.",
        "sk": "Nepodarilo sa načítať údaje o predplatnom.",
        "pl": "Nie udało się załadować szczegółów subskrypcji.",
        "de": "Abonnementdetails konnten nicht geladen werden.",
        "at": "Abonnementdetails konnten nicht geladen werden.",
        "da": "Kunne ikke indlæse abonnementsdetaljer.",
        "sv": "Kunde inte ladda prenumerationsdetaljer.",
        "no": "Kunne ikke laste inn abonnementsdetaljer.",
        "fi": "Tilaustietojen lataaminen epäonnistui.",
    },
    "rebuild.billing.payment_success": {
        "en": "Payment was successful! Your subscription is now active. 🎉",
        "cs": "Platba proběhla úspěšně! Vaše předplatné je nyní aktivní. 🎉",
        "sk": "Platba prebehla úspešne! Vaše predplatné je teraz aktívne. 🎉",
        "pl": "Płatność zakończona sukcesem! Twoja subskrypcja jest teraz aktywna. 🎉",
        "de": "Zahlung erfolgreich! Ihr Abonnement ist jetzt aktiv. 🎉",
        "at": "Zahlung erfolgreich! Ihr Abonnement ist jetzt aktiv. 🎉",
        "da": "Betaling gennemført! Dit abonnement er nu aktivt. 🎉",
        "sv": "Betalningen lyckades! Din prenumeration är nu aktiv. 🎉",
        "no": "Betaling vellykket! Abonnementet ditt er nå aktivt. 🎉",
        "fi": "Maksu onnistui! Tilauksesi on nyt aktiivinen. 🎉",
    },
    "rebuild.billing.payment_cancelled": {
        "en": "Payment was cancelled. You can try again anytime.",
        "cs": "Platba byla zrušena. Můžete to zkusit znovu kdykoliv.",
        "sk": "Platba bola zrušená. Môžete to skúsiť znova kedykoľvek.",
        "pl": "Płatność została anulowana. Możesz spróbować ponownie w każdej chwili.",
        "de": "Zahlung wurde abgebrochen. Sie können es jederzeit erneut versuchen.",
        "at": "Zahlung wurde abgebrochen. Sie können es jederzeit erneut versuchen.",
        "da": "Betaling blev annulleret. Du kan prøve igen når som helst.",
        "sv": "Betalningen avbröts. Du kan försöka igen när som helst.",
        "no": "Betaling ble avbrutt. Du kan prøve igjen når som helst.",
        "fi": "Maksu peruutettiin. Voit yrittää uudelleen milloin tahansa.",
    },
}


def set_nested(d, dotted_key, value):
    """Set a value in a nested dict using a dot-separated key path."""
    parts = dotted_key.split(".")
    for part in parts[:-1]:
        d = d.setdefault(part, {})
    d[parts[-1]] = value


def main():
    for lang in LANGUAGES:
        filepath = os.path.join(LOCALES_DIR, lang, "translation.json")
        if not os.path.exists(filepath):
            print(f"⚠ Skipping {lang}: file not found")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        added = 0
        for key, translations in BILLING_TRANSLATIONS.items():
            value = translations.get(lang, translations["en"])
            # Check if key already exists
            parts = key.split(".")
            node = data
            exists = True
            for part in parts:
                if isinstance(node, dict) and part in node:
                    node = node[part]
                else:
                    exists = False
                    break

            if not exists:
                set_nested(data, key, value)
                added += 1

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        print(f"✅ {lang}: added {added} keys")


if __name__ == "__main__":
    main()
