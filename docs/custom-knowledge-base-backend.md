# Custom Knowledge Base Backend

This project now includes a backend for storing **user-specific custom knowledge base entries**.

## What was added

- Supabase SQL migration that creates `public.custom_knowledge_entries`.
- Row-level security policies so users can only access their own entries.
- Supabase Edge Function: `custom-knowledge-base` for CRUD/search.
- Frontend API wrapper in `src/lib/custom-knowledge-base.ts`.

## Data model

Table: `public.custom_knowledge_entries`

- `id` (uuid, PK)
- `user_id` (uuid, `auth.users` FK)
- `title` (text, required)
- `content` (text, required)
- `tags` (text[])
- `metadata` (jsonb)
- `created_at` / `updated_at` (UTC timestamps)

## Edge function API

Function name: `custom-knowledge-base`

- `GET /custom-knowledge-base?q=<term>&limit=<n>`
  - List current user's entries, optional text search.
- `POST /custom-knowledge-base`
  - Create a new entry (`title`, `content`, optional `tags`, `metadata`).
- `PUT /custom-knowledge-base/:id`
  - Update an existing entry.
- `DELETE /custom-knowledge-base/:id`
  - Delete an entry.

Authentication: JWT is required (`verify_jwt = true`).

## Deploy steps

1. Apply migration:
   - `supabase db push`
2. Deploy function:
   - `supabase functions deploy custom-knowledge-base`
3. Ensure app has Supabase env vars set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Frontend usage example

```ts
import { listCustomKnowledgeEntries, createCustomKnowledgeEntry } from "@/lib/custom-knowledge-base";

const items = await listCustomKnowledgeEntries({ q: "confidence", limit: 20 });

await createCustomKnowledgeEntry({
  title: "Interview confidence checklist",
  content: "Use STAR examples for 3 common interview questions.",
  tags: ["interview", "confidence"],
});
```
