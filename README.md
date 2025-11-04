# OptiScope

OptiScope is an options-trading assistant that pairs an interactive React console with a Node/Express (TypeScript) API. Phase 1 focuses on manual trade capture, authentication, and real-time dashboard updates to mirror the core user journey:

> User → Login → Add Trade → See trade saved in dashboard

## Stack Overview

- **Frontend:** React 19 + Vite + TypeScript
- **Backend:** Express 4 + TypeScript + PostgreSQL
- **Auth:** Email/password with JWT session tokens
- **Data:** SQL schema for users, trades, option legs, analytics summaries (`server/db/schema.sql`)

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+ running locally (or connection string via `DATABASE_URL`)

## Environment Variables

- Root (frontend): copy `.env.development.example` → `.env.development` and adjust `VITE_API_URL` if the API runs elsewhere.
- Server: copy `server/.env.example` → `server/.env` and update values:
  - `PORT` – defaults to `4000`
  - `DATABASE_URL` – e.g. `postgresql://postgres:postgres@localhost:5432/optiscope`
  - `JWT_SECRET` – generate a secure string

## Database Setup

1. Create the database (adjust user/password as needed):
   ```bash
   createdb optiscope
   ```
2. Apply the schema using the provided script:
   ```bash
   cd server
   npm run migrate
   ```
   The script reads `server/db/schema.sql` and runs it against the configured `DATABASE_URL`.

## Running the App

### Backend API

```bash
cd server
npm install
npm run dev
```

The API starts on `http://localhost:4000` (configurable via `PORT`). Health check: `GET /health`.

### Frontend

```bash
cd ..

npm run dev
```

Visit `http://localhost:5173`. Use the “Launch trading console” button to open the auth + manual trade flow.

## Primary User Flow

1. Register or sign in with email/password (JWT returned on success).
2. Add a trade via the manual console form (symbol, strike, expiry, side, premium, notes).
3. Saved trades stream into the “Recent trades” list immediately, showing leg details and premium math.

## Project Structure (selected)

- `src/App.tsx` – landing page + trading console UI with API hooks
- `server/src/index.ts` – Express bootstrap, routes, middleware
- `server/src/routes` – auth + trades CRUD endpoints
- `server/src/models/trade.ts` – persistence + normalization logic for trades/legs
- `server/src/scripts/migrate.ts` – helper to apply the schema

## Next Milestones

- Extend manual trade capture to multi-leg orchestration
- Wire portfolio analytics and AI commentary once data is available
- Add automated tests for auth + trade lifecycle
