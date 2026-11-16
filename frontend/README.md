# Auto Apply AI frontend

A React + Vite career workspace with responsive navigation, a first-visit tour,
personalized job discovery, application tracking, outreach drafts, market insights,
source-based catalog questions, and profiles.

## Run locally

1. Install dependencies in `backend/` and `frontend/` with `npm install` if needed.
2. Configure the backend environment with working MongoDB, Redis, and JWT settings.
3. Run `npm run dev` in `backend/`, then `npm run dev` in `frontend/`.
4. Open the local URL printed by Vite.

Vite forwards `/api` and `/socket.io` to `http://localhost:5000`. For separate
hosting, set `VITE_API_URL` and `VITE_SOCKET_URL` before building (see `.env.example`),
or configure the host to forward those paths to the backend. Configure backend
`CLIENT_ORIGIN` to match the frontend origin. Use the same hostname for frontend
and backend during development so session cookies remain consistent.

## Verify

- `npm run build`: production build with lazy-loaded feature pages.
- `npm run lint`: static checks.
- From the repository root, `node frontend/tests/ui-smoke.cjs`: browser interaction
  checks against a running Vite server. Uses the backend's existing Playwright
  dependency and an already-installed Chromium browser. Set `PREVIEW_URL` to use
  another port. Screenshots and results go to ignored `work/`.

Browser checks use explicitly mocked API responses; they do not verify database,
Redis, AI-provider, or crawler connectivity. They cover login, onboarding, job
filtering and pagination, tracking and status updates, profiles, outreach,
error recovery, session expiry, and overflow at four viewport widths.

The tour is stored per user in this browser and can be replayed from Getting
started. Navigation uses URL hashes and supports browser back/forward. Animations
respect reduced-motion preferences. Charts use ordinary text and CSS bars, with
no chart runtime or external font downloads.

The Day/Night switch is available on sign-in and in the workspace header. It uses
the operating system's theme until a choice is saved, then remembers that choice
in this browser. The sun/moon animation respects reduced motion. Semantic colors
in `src/theme.css` cover every feature page, admin controls, and the walkthrough.
