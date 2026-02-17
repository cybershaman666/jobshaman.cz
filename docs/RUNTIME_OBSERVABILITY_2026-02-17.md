# Runtime Observability (Search + Network Degradation)

## Co bylo přidáno

- Nový runtime signal collector: `services/runtimeSignals.ts`
- Instrumentace v:
  - `services/jobService.ts`
  - `services/csrfService.ts`
  - `services/jobInteractionService.ts`

## Jak to rychle použít

1. Otevři appku a proveď problémový flow (např. filtry + vyhledávání během výpadku backendu).
2. V konzoli zobraz snapshot:

```js
window.__jobshamanRuntimeSignals
```

3. Pro programový přístup můžeš použít:

```ts
import { getRuntimeSignalSnapshot } from './services/runtimeSignals';
console.log(getRuntimeSignalSnapshot());
```

## Signály

- `search_hybrid_unavailable`
- `search_rpc_overload`
- `search_strict_fallback`
- `search_backend_meta_fallback`
- `csrf_fetch_unavailable`
- `request_timeout`
- `backend_cooldown_entered`
- `request_blocked_by_cooldown`
- `interaction_tracking_degraded`
- `interaction_tracking_skipped`

## Poznámky

- Signal logging je throttled (default 15s na dedupe key), aby se nespamovala konzole.
- Snapshot se drží v `sessionStorage` pod klíčem `js_runtime_signals_v1`.
- Pokud má uživatel povolené analytics cookies, signály se vzorkovaně zapisují do `analytics_events` jako `event_type = 'runtime_signal'`.
