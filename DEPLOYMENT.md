# Deploy Auto Apply AI for free on Render

The supplied `render.yaml` now selects **one Free web service, with no paid disk
and no additional paid service**. It keeps the existing external MongoDB Atlas
and Upstash Redis databases. This is a demo/portfolio configuration, not an
always-on deployment.

## Free-tier behavior

- Render can sleep after 15 minutes without incoming traffic. Waking it can take
  about a minute. Background jobs do not run while the service is asleep.
- Uploaded PDF files in `/data/resumes` are **temporary** and can disappear on
  sleep, restart, or redeploy. Re-upload a resume when needed. Existing profile
  data, extracted skills, users, jobs, and applications remain in MongoDB.
- There is no persistent disk in this Blueprint. The upload directory name does
  not make it persistent.
- Background imports work while the web service is running. Do not rely on the
  six-hour schedule for continuous unattended ingestion on a sleeping service.
  Use **Admin console → Sync APIs** when demonstrating the app.
- Chromium is included, with one crawler at a time. Heavy headless imports may
  exceed free-instance memory; API imports are the lighter option.
- Hosting is configured as free, but Render usage limits and the independent
  MongoDB, Redis, and AI-provider quotas still apply. No paid upgrades are created
  by this configuration. Review the provider dashboards and do not enable
  automatic paid upgrades if you want to stay within free allowances.
- BullMQ accesses Redis even while idle, so monitor the Upstash command quota.

## 1. Push the prepared source to GitHub

Use your existing repository or a private replacement. Commit/push the current
changes, including `Dockerfile`, `.dockerignore`, `.gitattributes`, `render.yaml`,
`deploy/`, application source, and both package/lock files.

The recreated repository is published from a clean initial snapshot without the
earlier credential-bearing Git history. Your `.env`, installed dependencies,
uploaded resumes, and browser screenshots remain on your laptop but are excluded
from this snapshot and the Docker build. Do not push backup refs or old local
branches containing the previous history. Never upload your current `.env`,
resumes, `node_modules`, screenshots, logs, or `work/` folder.

## 2. Create a Free Render Blueprint

1. Sign in at <https://dashboard.render.com/>.
2. Choose **New → Blueprint** and connect your GitHub repository.
3. Choose the branch containing the latest changes. Render reads root
   `render.yaml`.
4. Confirm **auto-apply-ai** is on **Free**, with **no disk**. If Render proposes
   paid resources, stop and check that the latest free configuration was pushed.
5. Enter these prompted values from `backend/.env`:

| Variable            | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| `MONGODB_URI`       | Your working Atlas URL, using the existing `autoapplyai` database |
| `UPSTASH_REDIS_URL` | Your working `rediss://` connection string                        |
| `GEMINI_API_KEY`    | Your existing Gemini key                                          |
| `GROQ_API_KEY`      | Your existing Groq key                                            |

Paste **only the value, without `KEY=` or surrounding quotes**, into Render's
value boxes. Render generates new JWT signing secrets. The image configures the
frontend, port binding, and upload directory. The website and API use one domain;
no Vercel service or separate frontend API URL is needed.

If you already created the earlier paid service, this local file change does not
change its billing automatically. In Render, review its disk and compute plan
before proceeding. Back up any disk files before removing a paid disk, then
switch the instance to Free. Do not delete a disk containing files you need.

## 3. Allow Render's outbound IP ranges in Atlas

1. Open the new Render service → **Connect → Outbound**.
2. Copy all displayed IP ranges.
3. In MongoDB Atlas → **Database & Network Access → IP Access List**, add them and
   wait until they are Active. Your laptop's allowed IP does not cover Render.
4. If the first deploy failed its health check, use **Manual Deploy → Deploy
   latest commit** after Atlas permits the server.

Keep Upstash eviction disabled for queue/session data.

## 4. Verify the deployed app

1. Wait for Render to show **Live**, then open its `https://...onrender.com` URL.
2. Open `/health`: expect HTTP 200, `status: ready`, MongoDB and Redis connected,
   and workers enabled while the service is awake.
3. Sign in with your existing app email/password. Your admin role is stored in
   the same MongoDB database.
4. Test discovery, API sync, tracking, outreach, day/night mode, and a PDF upload.
   Expect to re-upload the PDF after restarts; its extracted skills are in MongoDB.

The hosted app supports headless imports and API imports. Real Browser/CDP mode
controls a local development browser and is unavailable on the hosted app.
Third-party job sites can still block cloud-hosted scrapers.

## Verification and limits

The production frontend build, lint, backend/integration tests, and browser
checks under production security headers passed during preparation. The Blueprint
is checked against Render's official schema. Docker is not installed on this
machine, so the Linux image build and actual cloud connectivity must still be
verified on Render. Nothing has been deployed or purchased by these local edits.

For an optional local Docker check, run `docker compose up --build`. Compose uses
a local named resume volume; this does not add a persistent disk to Render Free.

## Official references

- <https://render.com/docs/free>
- <https://render.com/docs/docker>
- <https://render.com/docs/blueprint-spec>
- <https://render.com/docs/outbound-ip-addresses>
- <https://upstash.com/docs/redis/integrations/bullmq>
