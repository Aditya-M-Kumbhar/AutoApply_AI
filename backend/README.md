# Auto Apply AI API, retrieval, and evaluations

## Fix the current backend connections

The current environment reaches both AI providers, but its MongoDB and Redis
hostnames fail DNS resolution (`ENOTFOUND`). Changing an AI key cannot fix a
database hostname. Provider credentials are not printed by the diagnostics.

1. **MongoDB Atlas:** confirm the cluster exists and is running. Open **Connect →
   Drivers → Node.js** and copy the current connection string into `MONGODB_URI`
   in `backend/.env`. Supply the database user's password and a database name.
   Percent-encode special characters in the password, not the entire URI. Allow
   your current IP in Atlas Network Access. Verify DNS and cluster status before
   investigating password authentication.
2. **Redis / Upstash:** copy your database's current TLS Redis URL into
   `UPSTASH_REDIS_URL`: `rediss://default:PASSWORD@YOUR-HOST:6379`. The HTTPS REST
   URL and REST token are not connection strings for this project's ioredis/BullMQ.
3. **Remove stale aliases:** use only `MONGODB_URI` and `UPSTASH_REDIS_URL`.
   Remove `MONGO_URI` and `REDIS_URL`. Different values now produce an explicit
   configuration error instead of silently choosing one. Matching legacy values
   remain compatible.
4. Run `npm run diagnose -- --auth`, then restart with `npm run dev`. `/health/live` confirms
   HTTP is up. `/health` returns 200 only when MongoDB and Redis are connected;
   otherwise it returns 503 with dependency states. Redis is required for
   login/registration/refresh and queues; it is not silently replaced.

Local MongoDB is already available on this machine. For a **separate, initially
empty local database**, use `MONGODB_URI=mongodb://127.0.0.1:27017/autoapplyai`.
This does not copy Atlas data. You still need working local or hosted Redis.
`.env.example` documents the settings; do not overwrite secrets with placeholders.

The website name is independent of the database name. Keep the existing database
name in your Atlas URI if you want to keep using its existing users and listings.
Use `autoapplyai` only when intentionally starting a new database.

Official references:

- [Atlas troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/)
- [Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/)
- [Upstash Redis URL with Express](https://upstash.com/docs/redis/quickstarts/express)

## Administrator access

An administrator uses the same login form and password as their existing app
account. To grant access without deleting a user or changing their password:

```powershell
npm run admin:grant -- --email=your-existing-account@example.com
```

Sign out and sign back in afterward so the new session includes the admin role.
The Admin console then appears in the sidebar. There is no shared default admin
password, and the command refuses to create or replace accounts.

## AI provider configuration

Model-list requests accepted both configured keys. A live synthetic RAG check
generated a cited answer through Groq. Gemini's old default model returned a
retirement error; the updated `gemini-3.8-flash` default returned temporary high
demand during the check, and failover worked. The Groq default is now
`openai/gpt-oss-20b`, which this account lists as available. Override models with
`GEMINI_MODEL` and `GROQ_MODEL` if needed.

`npm run diagnose -- --ai` checks model-list access without generation calls.
It does not prove generation quota or billing. Authentication rejection, key
revocation, or a leaked key can require replacement. Model-not-found errors need
a model/configuration change. No existing `.env` secrets were changed.

## Search and recommendations

`GET /api/v1/jobs?search=react&location=remote&sort=recommended&page=1&limit=20`

- BM25 lexical relevance over weighted title, company, skills, description, and
  location, preserving C++, C#, Node.js, and multiword skills.
- Ranking combines search relevance, profile-skill coverage, and recency.
- `matchExplanation` lists matched/missing skills. `fitScore` is overlap or
  requirement coverage, never a hiring probability. `sort=newest` orders by date.
- Filters/pagination are validated; search is tokenized, not executed as regex.
- The newest 5,000 listings are cached in-process for 30 seconds without profile
  data. Ranking is personalized per request. `retrieval.truncated` reports when
  older listings fall outside the candidate set; totals refer to that set.
  This is bounded local retrieval, not vector search or a distributed index.

## Retrieval augmented answers

`POST /api/v1/assistant/ask`

```json
{ "question": "Which roles require React and TypeScript?", "useAI": false }
```

The pipeline chunks descriptions (850 characters, 150 overlap), retrieves BM25
passages, deduplicates jobs, and returns up to five sources. With `useAI` enabled,
only the question and retrieved listing excerpts go to the model, excluding user
profiles/resumes. Instructions inside sources are treated as untrusted data.
Generation must return structured claims, citation IDs, and exact supporting
quotes. Unknown IDs, invented quotes, or malformed JSON trigger source-only
fallback. No matching evidence produces an abstention.

Quotes establish provenance, **not semantic entailment**: a model can still
misinterpret text. Inspect original listings. Each request is independent; there
is no persistent chat memory or web browsing.

## Verification and evaluation

```powershell
npm test
npm run eval -- --output ../work/evaluation.json
# Optional provider call with synthetic content; may consume quota:
npm run eval -- --live --case react --output ../work/eval-live.json
# Real API integration against existing local MongoDB:
$env:RUN_DB_TESTS='1'
npm test
Remove-Item Env:RUN_DB_TESTS
```

The integration test creates a unique `talentradar_test_*` database, uses a test
JWT to call real API routes, and removes only that test database afterward. It
does not test production login or Redis-backed sessions.

The offline evaluator uses ten synthetic cases and reports Precision@3, Recall@3,
MRR, nDCG@3, latency, empty-retrieval behavior, and citation/quote validator checks.
Precision@3 counts unfilled slots as misses. Live mode adds actual generated
claims for human review and fails if relevant cases only return fallback results.
`--case` selects one fixture. This small suite is not proof of real-user relevance
or hallucination-free generation.
