from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService

router = APIRouter()

JCFPM_FALLBACK_DIMENSIONS = [
    "d1_cognitive", "d2_social", "d3_motivational", "d4_energy",
    "d5_values", "d6_ai_readiness", "d7_cognitive_reflection",
    "d8_digital_eq", "d9_systems_thinking", "d10_ambiguity_interpretation",
    "d11_problem_decomposition", "d12_moral_compass",
    "i1_love", "i2_good_at", "i3_world_needs", "i4_paid_for",
]

JCFPM_FALLBACK_PROMPTS: dict[str, list[str]] = {
    "d1_cognitive": [
        "Než se rozhodnu, potřebuji si nejdřív srovnat fakta a souvislosti.",
        "Když řeším důležité zadání, nejdřív si poskládám informace do jasného obrazu.",
        "Všímám si, které informace jsou podstatné a které jen vytvářejí šum.",
        "Umím přepnout mezi detailem a celkovým obrazem podle situace.",
        "Když něco nedává smysl, hledám příčinu místo rychlého závěru.",
        "Před finálním rozhodnutím si rád/a ověřím hlavní předpoklady.",
    ],
    "d2_social": [
        "V týmu umím vytvořit důvěru a jasnou domluvu.",
        "Když vznikne napětí, snažím se pojmenovat věc klidně a konkrétně.",
        "Dovedu vést rozhovor tak, aby se lidé dobrali dalšího kroku.",
        "Umím odhadnout, kdy má smysl mluvit a kdy spíš poslouchat.",
        "Ve spolupráci si hlídám férovost, odpovědnost a jasná očekávání.",
        "Dokážu pomoci skupině vrátit pozornost k cíli.",
    ],
    "d3_motivational": [
        "Nejvíc mě pohání práce, která má viditelný smysl.",
        "Když chápu dopad práce, vydržím u ní déle a s větší energií.",
        "Potřebuji vědět, proč je úkol důležitý, ne jen co mám udělat.",
        "Růst odpovědnosti mě motivuje víc než čistě formální status.",
        "Dobře funguji, když mám možnost něco zlepšit, ne jen udržovat.",
        "Ocenění je pro mě silnější, když souvisí s reálným přínosem.",
    ],
    "d4_energy": [
        "Dlouhodobě zvládám tlak bez ztráty kvality rozhodování.",
        "Umím zabrat ve sprintu a pak si vědomě obnovit energii.",
        "Různorodé úkoly mě spíš aktivují než vyčerpávají.",
        "Dokážu si pohlídat tempo, když se toho děje hodně najednou.",
        "V naléhavých situacích zůstávám použitelný/á pro tým.",
        "Vím, kdy potřebuji hlubokou práci a kdy rychlé přepínání.",
    ],
    "d5_values": [
        "Při rozhodování si hlídám soulad s vlastními hodnotami.",
        "Práce mi musí dávat smysl i z hlediska dlouhodobého dopadu.",
        "Když prostředí porušuje důvěru, rychle ztrácím motivaci.",
        "Umím pojmenovat, co je pro mě v práci nepřekročitelné.",
        "Důležitá rozhodnutí posuzuji i podle jejich dopadu na lidi.",
        "Preferuji prostředí, kde výkon nejde proti integritě.",
    ],
    "d6_ai_readiness": [
        "AI nástroje beru jako přirozenou součást práce.",
        "Rád/a zkouším nové nástroje, pokud reálně zlepšují výsledek.",
        "Umím přemýšlet, kde technologie pomůže a kde je lepší lidský úsudek.",
        "Když se mění pracovní nástroje, beru to jako příležitost učit se.",
        "Dokážu popsat úkol tak, aby mi digitální nástroj vrátil použitelný výstup.",
        "Nové technologie mě spíš zajímají, než aby mě paralyzovaly.",
    ],
    "d7_cognitive_reflection": [
        "Umím zpochybnit vlastní první interpretaci.",
        "Před důležitým krokem se ptám, jaký mám důkaz.",
        "Když mě napadne rychlé řešení, ověřím si alespoň hlavní riziko.",
        "Dovedu přiznat, že moje první intuice mohla být chybná.",
        "U složitějších rozhodnutí hledám i alternativní vysvětlení.",
        "Logické zkratky se snažím zachytit dřív, než ovlivní výsledek.",
    ],
    "d8_digital_eq": [
        "V digitální komunikaci rozpoznám kontext i emocionální tón.",
        "V textu si všímám náznaků napětí, nejistoty nebo nedorozumění.",
        "Umím napsat zprávu tak, aby byla jasná a zároveň nezbytečně tvrdá.",
        "V online spolupráci aktivně pomáhám držet důvěru.",
        "Dokážu rozlišit, kdy stačí zpráva a kdy je lepší hovor.",
        "V asynchronní komunikaci myslím na to, jak ji druhá strana přečte.",
    ],
    "d9_systems_thinking": [
        "Vidím vazby mezi lidmi, procesy a výsledky.",
        "Když se mění jedna část systému, přemýšlím o vedlejších dopadech.",
        "Zajímá mě, proč se problém opakuje, ne jen jak ho rychle odstranit.",
        "Umím popsat tok práce od vstupu až po dopad na zákazníka nebo tým.",
        "Všímám si zpětných vazeb, které mohou rozhodnutí časem změnit.",
        "Komplexní situace si umím převést do mapy vztahů.",
    ],
    "d10_ambiguity_interpretation": [
        "Nejasné zadání mě spíš aktivuje než paralyzuje.",
        "V nejistotě hledám první směr, který se dá ověřit.",
        "Když není dost informací, umím si říct o minimální další signál.",
        "V nejasné situaci vidím nejen rizika, ale i možné příležitosti.",
        "Umím pracovat s tím, že první verze řešení nebude definitivní.",
        "Když se podmínky mění, dovedu upravit plán bez zbytečné paniky.",
    ],
    "d11_problem_decomposition": [
        "Velký problém si umím rozložit na testovatelné části.",
        "Dokážu z chaosu vytvořit první praktický postup.",
        "Před akcí si umím určit, co je blokátor a co může počkat.",
        "Složité zadání převádím do jasných kroků a priorit.",
        "Umím navrhnout menší experiment místo obřího neověřeného plánu.",
        "Když je práce nepřehledná, hledám jednoduchou strukturu dalšího kroku.",
    ],
    "d12_moral_compass": [
        "Při tlaku na výkon neztrácím etický kompas.",
        "Když je rychlá cesta nefér, hledám čistší variantu řešení.",
        "Umím otevřít nepříjemné téma, pokud chrání důvěru nebo bezpečí.",
        "V rozhodnutí zohledňuji i dopady, které nejsou hned vidět.",
        "Nechci vyhrávat způsobem, který dlouhodobě ničí vztahy.",
        "Když tým obchází pravidla, snažím se navrhnout korekci.",
    ],
    "i1_love": [
        "Při některých pracovních aktivitách ztrácím pojem o čase.",
        "Dokážu poznat, u jakých úkolů mi energie přirozeně roste.",
        "Baví mě činnosti, kde se mohu ponořit do problému nebo tvorby.",
        "Když mě práce zajímá, vydržím u ní i bez okamžité odměny.",
        "Umím popsat, jaký typ práce mě opravdu vtahuje.",
        "Chci mít v práci prostor pro činnosti, které mě vnitřně nabíjejí.",
    ],
    "i2_good_at": [
        "Lidé mě v určité oblasti často žádají o radu nebo pomoc.",
        "Umím rozpoznat schopnosti, které používám přirozeně a opakovaně.",
        "Vím, v čem mívám proti ostatním rychlejší orientaci.",
        "Dovedu pojmenovat konkrétní výsledky, které díky mým silám vznikají.",
        "Když něco dělám dobře, snažím se pochopit, která schopnost za tím stojí.",
        "Umím své silné stránky převést do praktické nabídky pro tým.",
    ],
    "i3_world_needs": [
        "Dává mi smysl řešit problémy, které zlepšují život konkrétním lidem.",
        "Práce je pro mě silnější, když chápu, komu pomáhá.",
        "Zajímá mě dopad práce za hranicí samotného úkolu.",
        "Dokážu vydržet u práce déle, když chápu její širší užitek.",
        "Chci používat své schopnosti na problémy, které nejsou jen formální.",
        "Dobře se mi pracuje, když vidím spojení mezi úsilím a reálnou potřebou.",
    ],
    "i4_paid_for": [
        "Umím pojmenovat hodnotu, kterou moje práce přináší firmě nebo zákazníkovi.",
        "Chci rozvíjet schopnosti, za které je trh ochotný férově platit.",
        "Ideální práce pro mě spojuje smysl, sílu a ekonomickou udržitelnost.",
        "Dokážu přemýšlet o své práci jako o hodnotě, ne jen o čase.",
        "Zajímá mě, které moje schopnosti mají skutečnou poptávku.",
        "Chci, aby moje pracovní směřování dávalo smysl i finančně.",
    ],
}

class RitualStep(BaseModel):
    id: str
    text: str

class RitualCompletionRequest(BaseModel):
    steps: List[RitualStep]
    language: Optional[str] = "cs"

@router.post("/ritual/complete")
async def complete_ritual(
    payload: RitualCompletionRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    """
    V2 Ritual Completion:
    Interpret narrative, update weights, refresh embedding.
    """
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    
    try:
        result = await IdentityDomainService.process_ritual_completion(
            user_id=str(domain_user["id"]),
            steps=[step.model_dump() for step in payload.steps],
            language=payload.language
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/profile/me")
async def get_my_profile(current_user: dict = Depends(AccessControlService.get_current_user)):
    """
    Test protected endpoint for V2.
    Requires a valid Supabase JWT token.
    Mirrors user in Northflank Postgres if they don't exist yet.
    """
    # Mirror user in V2 Domain
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"]
    )
    
    # Get profile data
    profile = await IdentityDomainService.get_candidate_profile(domain_user["id"])
    
    return {
        "status": "success",
        "message": "Welcome to V2 API",
        "data": {
            "user": domain_user,
            "profile": profile,
            "features": ["shamanic_cyberpunk_ui", "v2_domain_services"]
        }
    }

@router.patch("/profile/me")
async def update_my_profile(
    updates: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )

    try:
        data = await IdentityDomainService.update_candidate_profile(domain_user["id"], updates)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "status": "success",
        "data": data,
    }

@router.get("/cv")
async def list_my_cv_documents(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.list_cv_documents(domain_user["id"])}

@router.post("/cv")
async def create_my_cv_document(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.create_cv_document(domain_user["id"], payload)}

@router.patch("/cv/{cv_id}")
async def update_my_cv_document(
    cv_id: str,
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    doc = await IdentityDomainService.update_cv_document(domain_user["id"], cv_id, payload)
    if not doc:
        raise HTTPException(status_code=404, detail="CV document not found")
    return {"status": "success", "data": doc}

@router.delete("/cv/{cv_id}")
async def delete_my_cv_document(
    cv_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    deleted = await IdentityDomainService.delete_cv_document(domain_user["id"], cv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="CV document not found")
    return {"status": "success", "data": {"ok": True}}

@router.get("/jcfpm/items")
async def get_jcfpm_items(
    locale: str = Query("cs", min_length=2, max_length=12),
    form: str = Query("jcfpm-v3-ikigai", min_length=3, max_length=80),
):
    # 1. Try the primary form key
    live_items = await IdentityDomainService.list_jcfpm_items(locale=locale, form_key=form)
    if live_items:
        return {
            "status": "success",
            "data": live_items,
            "meta": {
                "source": "postgres",
                "form": form,
                "locale": locale,
                "item_count": len(live_items),
            },
        }

    # 2. Fallback: try with 'cs' locale (requested locale may have no translations)
    if locale.lower() != "cs":
        cs_fallback = await IdentityDomainService.list_jcfpm_items(locale="cs", form_key=form)
        if cs_fallback:
            return {
                "status": "success",
                "data": cs_fallback,
                "meta": {
                    "source": "postgres_locale_fallback",
                    "form": form,
                    "locale": locale,
                    "fallback_locale": "cs",
                    "item_count": len(cs_fallback),
                },
            }

    # 3. Try the fallback form key
    for alt_form in ["jcfpm-v1-lite", "jcfpm-core-v3", "jcfpm-base"]:
        alt_items = await IdentityDomainService.list_jcfpm_items(locale=locale, form_key=alt_form)
        if alt_items:
            return {
                "status": "success",
                "data": alt_items,
                "meta": {
                    "source": "postgres_form_fallback",
                    "form": alt_form,
                    "locale": locale,
                    "item_count": len(alt_items),
                },
            }

    # 4. Hardcoded fallback: generate items for all 16 dimensions × 6 prompts each
    fallback_items = []
    sort_order = 0
    for dim_index, dimension in enumerate(JCFPM_FALLBACK_DIMENSIONS):
        prompts = JCFPM_FALLBACK_PROMPTS.get(dimension, [f"{dimension} prompt"])
        for prompt_index, prompt in enumerate(prompts):
            sort_order += 1
            section = "ikigai" if dimension.startswith("i") else "psychometric"
            fallback_items.append({
                "id": f"v2-{dimension}-{prompt_index + 1}",
                "pool_key": f"v2-{dimension}-{prompt_index + 1}",
                "variant_index": 1,
                "dimension": dimension,
                "section": section,
                "subdimension": None,
                "prompt": prompt,
                "prompt_i18n": {"cs": prompt, "en": prompt},
                "sort_order": sort_order,
                "item_type": "likert",
                "payload": {},
                "payload_i18n": {"cs": {}, "en": {}},
                "assets": {},
                "status": "active",
                "version": "jcfpm-v3-ikigai",
                "scale_min": 1,
                "scale_max": 7,
                "reverse_scoring": False,
                "locale_used": "cs",
                "translation_status": "fallback",
                "form_key": "jcfpm-v3-ikigai-fallback",
            })

    return {
        "status": "success",
        "data": fallback_items,
        "meta": {
            "source": "fallback",
            "form": "jcfpm-v3-ikigai-fallback",
            "locale": locale,
            "item_count": len(fallback_items),
        },
    }

@router.get("/jcfpm/latest")
async def get_my_latest_jcfpm_snapshot(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.get_latest_jcfpm_snapshot(domain_user["id"])}

@router.post("/jcfpm/snapshots")
async def create_my_jcfpm_snapshot(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.create_jcfpm_snapshot(domain_user["id"], payload)}

@router.get("/signals")
async def list_my_identity_signals(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.list_identity_signals(domain_user["id"])}

@router.post("/signals")
async def create_my_identity_signal(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        signal = await IdentityDomainService.create_identity_signal(domain_user["id"], payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "success", "data": signal}

@router.get("/company-shares")
async def list_my_company_shares(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.list_candidate_company_shares(domain_user["id"])}

@router.post("/company-shares")
async def create_my_company_share(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        share = await IdentityDomainService.create_candidate_company_share(domain_user["id"], payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "success", "data": share}

@router.post("/company-shares/{share_id}/revoke")
async def revoke_my_company_share(
    share_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    share = await IdentityDomainService.revoke_candidate_company_share(domain_user["id"], share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Candidate-company share not found")
    return {"status": "success", "data": share}
