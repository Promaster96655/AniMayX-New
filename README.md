# AniMayX — Watch Free Animes

AniMayX is a responsive, animated obsidian-and-orange (`#080808` / `#121212` / `#FF6A00`) entertainment platform built with React 19, Vite, Tailwind CSS v4, Express, Firebase Authentication, Cloud Firestore, Firebase Storage, ArtPlayer, and HLS.js.

## Features

- **5 Entertainment Categories**:
  1. **Anime** (`/anime`, `/anime/browse`, `/anime/trending`, `/anime/popular`, `/anime/movies`, `/anime/:id`, `/anime/:id/watch`, `/anime/watchlist`) via AniList GraphQL + Jikan v4 + AniSkip v2.
  2. **Movies & Web Series** (`/movies`) via Official TMDB API v3/v4 (explicitly gated on credentials).
  3. **Manga** (`/manga`, `/manga/:id`) via Official MangaDex v5 API with multi-language chapter feed & in-app reader for non-external chapters.
  4. **Light Novels** (`/novels`, `/novels/:id`) via AniList GraphQL.
  5. **Comics** (`/comics`) via ComicVine API (explicitly gated on credentials).
- **Automated Background Sync**: `node-cron` runs an initial import on server startup and incremental synchronization every 60 minutes, preserving admin-locked fields and preventing duplicate jobs.
- **Firebase Auth & 7-Step Profile Setup Wizard**: Email/password registration, email verification, password reset, Google Sign-In, atomic username reservation via Firestore transactions, curated & custom Storage uploads, 6 profile themes, and privacy controls.
- **Protected Anime Admin Panel** (`/admin/anime`): Catalogue CRUD, AniList metadata import, Episode & Authorized Playback Source manager, manual `Sync Now`, sync logs, and Discord community link management.

## Setup & Environment Variables

1. Copy `.env.example` to `.env` and fill in optional/required keys:
   - `TMDB_API_KEY` or `TMDB_READ_TOKEN` — enables Movies & Web Series (`/movies`).
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — enables server-side Firebase Admin SDK writes for background sync persistence, custom claims, and `/admins/{uid}` provisioning.
   - `INITIAL_ADMIN_EMAIL` — defaults to `mrzorvixofficial@gmail.com`.
   - `COMICVINE_API_KEY` — enables western Comics (`/comics`).
   - `DISCORD_GUILD_ID` — optional public Discord guild ID for online member count widget.

## Firebase Configuration & Rules

1. Enable **Email/Password** and **Google** sign-in providers in the Firebase Console under **Authentication → Sign-in method**.
2. Deploy `firestore.rules` and `storage.rules` to your Firebase project (`silicon-circle-5d2jw`).
3. To provision the initial administrator (`mrzorvixofficial@gmail.com`):
   - Register or sign in with `mrzorvixofficial@gmail.com` and complete email verification.
   - Open `/profile` and click **Complete Admin Setup** (calls the one-time `/api/admin/bootstrap` endpoint, which disables itself after completion).

## Scripts

- `npm install` — install dependencies
- `npm run dev` — start full-stack Express + Vite server on port `3000`
- `npm run lint` — run TypeScript type checks
- `npm run test` — run Vitest test suite
- `npm run build` — build production client bundle to `dist/`
- `npm start` — run production server (`node server.ts`)

## Deployment (Railway / Cloud Run)

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Expose `PORT=3000` and configure server environment variables (`TMDB_READ_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`, etc.) in your hosting secrets panel.
