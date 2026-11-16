# Auto Apply AI

A career workspace for job discovery, application tracking, outreach drafts,
market insights, and source-based questions about a job catalog.

## Features

- React interface with responsive navigation, a guided tour, and animated day/night themes.
- BM25 search and content-based recommendations with matched/missing skill explanations.
- Application status tracking, editable outreach drafts, resume skill extraction, and learning paths.
- Retrieval-augmented catalog answers with source excerpts, optional AI summaries, and citation checks.
- Administrator controls for job-source API imports and local/headless browser imports.
- MongoDB persistence, Redis-backed sessions and BullMQ workers, and Socket.IO import activity.
- Synthetic retrieval evaluations and optional live LLM checks.

## Run locally

Use Node.js 22.12 or later in the Node 22 series, a MongoDB database, and Redis.

1. Install dependencies with `npm ci` in both `backend/` and `frontend/`.
2. Create `backend/.env` using `backend/.env.example` and supply your own credentials.
3. Run `npm run dev` in `backend/`, then `npm run dev` in `frontend/`.
4. Open the local URL printed by Vite. Register an app account.

To grant an existing account administrator access without changing its password:

```sh
cd backend
npm run admin:grant -- --email=your-account@example.com
```

Sign out and sign in again after granting access. No shared administrator password is included.

## Deploy for free

[DEPLOYMENT.md](DEPLOYMENT.md) explains the Render Free deployment using the root
`render.yaml` and Dockerfile, with external MongoDB Atlas and Upstash Redis.

The free service can sleep, and uploaded PDF files are temporary. Database records
and extracted skills remain in MongoDB. Hosting and AI-provider usage limits apply.
The Blueprint declares no paid disk or paid compute plan.

## Verify

```sh
cd frontend
npm run build
npm run lint
```

```sh
cd backend
npm test
npm run eval
npm run diagnose -- --auth
```

See [backend/README.md](backend/README.md) for API details and optional integration
tests, and [frontend/README.md](frontend/README.md) for browser checks.

Never commit `.env`, uploaded resumes, browser screenshots, logs, or installed
dependencies. Only placeholder environment examples belong in source control.
