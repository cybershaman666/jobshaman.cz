# Handshake Core V1 – pořadí migrací

Spouštěj přesně v tomto pořadí:

1. `database/migrations/20260302_application_dossiers_and_job_drafts.sql`
2. `database/migrations/20260305_external_assets.sql`
3. `database/migrations/20260302_assessment_links_and_library.sql`
4. `database/migrations/20260302_company_activity_log.sql`
5. `database/migrations/20260303_expand_job_role_profiles.sql`
6. `database/migrations/20260303_application_messages.sql`
7. `database/migrations/20260303_application_message_storage.sql`

Poznámky:

- `database/migrations/playground-2.mongodb.js` nespouštět (není SQL migrace).
- Pokud některý krok selže, zastav se na tom kroku a pokračuj až po opravě.
