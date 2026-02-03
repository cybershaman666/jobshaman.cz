# Job Search Improvements - Implementation Guide

## Overview
This migration adds full-text search capabilities with fuzzy matching to the JobShaman job search functionality. It now handles:

1. **Typo tolerance** - Finds jobs even with misspellings (e.g., "řidič" vs "řidič")
2. **Partial matching** - Matches parts of position titles (e.g., finding "Řidič/Skladník sk.B" when searching for "řidič sk. B")
3. **Accent-insensitive search** - Finds matches regardless of diacritics
4. **Relevance scoring** - Results are ranked by how well they match the search term

## What Gets Improved

### Before (current behavior)
- Simple case-insensitive substring matching using ILIKE
- No fuzzy matching - typos like "řídic" wouldn't find "řidič"
- No relevance ranking
- Limited partial matching

### After (with this migration)
- **Trigram-based fuzzy matching** - Handles typos and misspellings
- **Word boundary matching** - "řidič sk." finds "Řidič/Skladník sk.B"
- **Relevance scoring** - Exact matches ranked highest, followed by prefix matches, then fuzzy matches
- **Accent normalization** - "ridic" finds "řidič"
- **Multi-field search** - Searches both title and description

## How to Apply the Migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → SQL Editor
2. Open and run the migration file: `database/migrations/20260203_improve_job_search.sql`
3. Wait for all SQL to execute successfully

### Option 2: Via Supabase CLI
```bash
supabase db push
```

### Option 3: Manual SQL
Copy the SQL from `database/migrations/20260203_improve_job_search.sql` and paste it into your Supabase SQL editor.

## Testing the Improved Search

After applying the migration, test these scenarios:

### Test Case 1: Typo Tolerance
- Search: `"řídic"` (misspelled "řidič")
- Expected: Finds jobs with "řidič" in the title/description
- Result: ✅ Should find matches with ~70%+ similarity

### Test Case 2: Partial Position Matching
- Search: `"řidič sk. B"`
- Expected: Finds "Řidič/Skladník sk.B" positions
- Result: ✅ Should find exact substring matches

### Test Case 3: Accent Insensitivity
- Search: `"ridic"` (without accent)
- Expected: Finds "řidič" positions
- Result: ✅ Should find matches via unaccent normalization

### Test Case 4: Prefix Matching
- Search: `"Řidič"`
- Expected: Returns jobs sorted by relevance
- Result: ✅ Exact matches first, then partial matches

### Test Case 5: Mixed Case & Spaces
- Search: `"ŘIDIČ SK"`
- Expected: Finds all case variations
- Result: ✅ Case-insensitive matching

## Performance Considerations

- **Trigram indexes** are created on `title` and `description` columns for fast fuzzy matching
- **Unaccent index** improves accent-insensitive searches
- The RPC function is marked as STABLE, allowing Supabase to cache results better
- Relevance scoring is calculated efficiently with a dedicated function

## Frontend Changes (Already Applied)

The frontend already passes the `search_term` parameter to the backend RPC. No frontend changes are needed - it will automatically benefit from the improved backend search.

### How it works:
1. User types in the search box: `"řidič sk. B"`
2. Frontend calls `usePaginatedJobs` with `searchTerm: "řidič sk. B"`
3. Backend `search_jobs_with_filters` RPC function receives it
4. Results are sorted by relevance score (highest first)
5. Results are displayed to the user with best matches first

## Migration SQL Structure

The migration includes:

1. **Extension enablement** - Enables `pg_trgm` (trigram) and `unaccent` extensions
2. **Index creation** - Creates GIN indexes on title and description
3. **Relevance function** - `calculate_job_relevance_score()` - calculates how well a job matches a search term
4. **Improved RPC function** - `search_jobs_with_filters()` - updated to use fuzzy matching and ranking

## Rollback

If you need to revert this migration, you can:

1. Drop the new function:
```sql
DROP FUNCTION IF EXISTS search_jobs_with_filters(text, double precision, double precision, double precision, text, text[], text[], numeric, text, text[], int, int, text[]);
DROP FUNCTION IF EXISTS calculate_job_relevance_score(text, text, text);
```

2. Drop the indexes:
```sql
DROP INDEX IF EXISTS idx_jobs_title_trgm;
DROP INDEX IF EXISTS idx_jobs_description_trgm;
DROP INDEX IF EXISTS idx_jobs_title_unaccent;
```

3. Recreate the original `search_jobs_with_filters` if it existed before.

## Search Score Breakdown

The relevance score is calculated as follows (higher = more relevant):

| Match Type | Points |
|------------|--------|
| Exact title match | +100 |
| Title starts with search term | +80 |
| Substring in title | +60 |
| Trigram similarity in title | +0-50 |
| Trigram similarity in description | +0-20 |
| Word boundary match | +40 |

Example: Searching "řidič sk. B" in "Řidič/Skladník sk.B":
- Substring match in title: +60
- Word boundary match: +40
- **Total: 100 points** ← Will rank very high

## Notes

- The search is **case-insensitive** and **accent-insensitive**
- Trigram similarity threshold is set to 0.3 (30%) - can be adjusted if needed
- The function supports all existing filters (city, contract type, benefits, etc.)
- Relevance scoring works in combination with existing distance-based sorting

