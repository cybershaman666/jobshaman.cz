# Co jsme dnes postavili (pro business/marketing)

## 1) Jednou větou
Dnes jsme z JobShamanu udělali výrazně chytřejší a lépe řiditelný doporučovací systém: už jen „nehádá“, ale měří, co lidé opravdu dělají, učí se z toho a hlídá, aby doporučení nebyla jednotvárná.

## 2) Co to znamená lidsky
Představte si to jako zkušeného poradce:
- Nejen doporučí práci.
- Ale také si pamatuje, co člověk viděl.
- Sleduje, na co reagoval.
- A podle toho příště doporučí lépe.
- Zároveň hlídá, aby neukazoval pořád stejné firmy a stejné typy pozic.

## 3) Co se konkrétně implementovalo

### A) Měření toho, co uživatel opravdu viděl
Dříve jsme měli hlavně kliky.  
Teď ukládáme i **zobrazení doporučení** (tzv. „exposure“):
- jaká nabídka byla ukázána,
- na jaké pozici v seznamu,
- s jakým skóre,
- pod jakou verzí modelu.

Proč je to důležité:
- Konečně máme férový základ pro metriky (např. CTR).
- Víme, jestli problém je v kvalitě doporučení, nebo jen v tom, že uživatel nabídku vůbec neviděl.

### B) Silnější signály než jen klik
Začali jsme sbírat víc signálů chování:
- otevření detailu,
- klik na přihlášení,
- uložení nabídky,
- čas strávený na detailu,
- scroll.

Proč je to důležité:
- Systém rozlišuje „náhodný klik“ vs. „reálný zájem“.
- Doporučení se budou zlepšovat rychleji a přesněji.

### C) Posun z „skóre podobnosti“ na „pravděpodobnost akce“
Přidali jsme první verzi modelu, který odhaduje:  
**„Jaká je šance, že na tuto nabídku uživatel zareaguje?“**

Proč je to důležité:
- Doporučování je víc obchodně orientované (reakce/aplikace), ne jen technicky „podobné“.
- Model je zatím jednoduchý a čitelný (dobře auditovatelný).

### D) Offline kontrola kvality modelu
Před dalším posouváním modelu už máme metriky kvality:
- AUC,
- log loss,
- precision@5,
- precision@10.

Proč je to důležité:
- Změny se dají ověřit na datech, ne podle pocitu.
- Snižuje se riziko, že „nová verze“ ve skutečnosti zhorší výkon.

### E) Ochrana proti „tunelovému vidění“ systému
Přidali jsme guardrails, aby systém neukazoval stále to samé:
- limit podobných nabídek od jedné firmy,
- minimální podíl nových nabídek,
- minimální podíl „long-tail“ (méně očividných) firem,
- řízený podíl explorace (objevování nových možností).

Proč je to důležité:
- Uživatel neuvidí jen „největší a nejprofláklejší“ role.
- Zvyšujeme šanci objevit relevantní, ale jinak přehlížené příležitosti.

## 4) Co je nově vidět v adminu
V admin dashboardu jsou teď nové informace:
- kolik bylo zobrazení doporučení,
- jaký je podíl explorace / nových nabídek / long-tail,
- základní offline kvalita modelu (AUC, log loss, P@5).

Praktický přínos:
- Můžete sledovat kvalitu doporučení jako byznys metriku, ne jen jako technickou.

## 5) Co to přináší byznysově
- Lepší relevance doporučení -> vyšší šance na reakci uživatele.
- Lepší měření -> rychlejší a bezpečnější rozhodování, co upravovat.
- Menší riziko zacyklení systému -> stabilnější dlouhodobý růst kvality.
- Silnější důvěra v produkt -> umíme doložit, proč systém doporučuje právě tohle.

## 6) Co je další logický krok
V příští fázi dává smysl:
1. Doladit váhy guardrailů podle prvních dat.
2. Spustit řízené A/B testy mezi verzemi doporučování.
3. Napojit výsledky na business KPI (aplikace, aktivace, retence).

---

Pokud to máte říct jednou větou partnerovi:
**„Dnes jsme z doporučování udělali měřitelný a řiditelný motor růstu: víme, co lidé vidí, jak reagují, a systém už neoptimalizuje jen na podobnost, ale na reálnou šanci akce.“**
