# Auto Apply AI

**Find your next role. Keep your search organized.**

Auto Apply AI brings job discovery, application tracking, and outreach into one career workspace. Explore opportunities that match your skills, understand where you can grow, and keep track of your next steps.

## What you can do

| Feature | How it helps |
| --- | --- |
| Discover jobs | Search by role, company, or location and explore recommendations based on your profile. |
| Understand your matches | See which skills match a listing and which skills you may need to develop. |
| Track applications | Keep opportunities together and update their status as your search progresses. |
| Prepare outreach | Create editable introduction drafts for tracked jobs, then copy and send them yourself. |
| Explore market insights | See the skills and roles appearing in the job catalog. |
| Ask the catalog | Ask questions about listings and review source excerpts behind the answers, with optional AI summaries. |
| Build your profile | Add your skills and upload a PDF resume to support more useful recommendations. |

A guided walkthrough helps first-time users find their way around. The responsive interface includes day and night themes, animated transitions, and support for reduced-motion preferences.

## Your first steps

1. Create an account and open **My profile** to add your skills or resume.
2. Visit **Discover jobs** to search the catalog and review your matches.
3. Select **Apply** to open the employer's application page. After applying, select **Track** to save the opportunity.
4. Manage your progress in **Applications**, prepare a message in **Outreach**, or explore **Market insights** and **Ask the catalog**.

Applications are submitted on the employer's website. You choose when to send outreach drafts. Match scores describe skill overlap rather than the probability of getting hired. Available jobs and insights depend on the listings imported into the catalog.

## Run your own instance

### Requirements

- Node.js 22.12 or later within the Node 22 series
- MongoDB and Redis, either local or hosted
- Optional Gemini or Groq credentials for AI generation

### Installation

```sh
git clone https://github.com/Aditya-M-Kumbhar/AutoApply_AI.git
cd AutoApply_AI
npm ci --prefix backend
npm ci --prefix frontend
```

Copy `backend/.env.example` to `backend/.env`. Configure `MONGODB_URI`, `UPSTASH_REDIS_URL`, and two different random values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. The example file describes the remaining settings. Keep credentials out of source control.

Start the backend and frontend in separate terminals:

```sh
cd backend
npm run dev
```

```sh
cd frontend
npm run dev
```

Open the URL printed by Vite and register an account. Search and source-based catalog retrieval work without an LLM key; generation features require a configured provider.

### Populate the job catalog

An administrator can import listings through **Admin console**, using job-source APIs or a supported page import. To grant an existing account administrator access, run this command from `backend/`:

```sh
npm run admin:grant -- --email=your-account@example.com
```

Sign out and sign in again to access the console. There is no shared default administrator password. Browser imports depend on the source website and the browser capabilities available in the hosting environment.

## Deploy for free

[DEPLOYMENT.md](DEPLOYMENT.md) explains the Render Free deployment using the root
`render.yaml` and Dockerfile, with external MongoDB Atlas and Upstash Redis.

The free service can sleep, and uploaded PDF files are temporary. Database records
and extracted skills remain in MongoDB. Hosting and AI-provider usage limits apply.
The Blueprint declares no paid disk or paid compute plan.

## Built with

- **Interface:** React, Vite, Tailwind CSS, and Lucide icons
- **API:** Node.js and Express
- **Data and background work:** MongoDB, Redis, BullMQ, and Socket.IO
- **Search and answers:** BM25 retrieval, skill-based ranking, and retrieval-augmented generation with citation checks
- **Job imports:** Source API integrations and browser automation

## Development and checks

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

## Feedback and contributions

Found a bug or have an idea? [Open an issue](https://github.com/Aditya-M-Kumbhar/AutoApply_AI/issues) with the steps to reproduce the problem or a description of the improvement. Pull requests should explain the change and the checks performed. Remove credentials and personal data from logs or screenshots before sharing them.
