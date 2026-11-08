# Nexus server

The Node API for Nexus. It handles auth, research projects and notes, post drafts, LinkedIn/X publishing and the scheduler, and proxies model work to the AI engine.

**Stack:** Node 20+ · Express · Prisma (PostgreSQL + pgvector) · Passport (Google OAuth) · JWT cookies · bcrypt

## Run

```bash
npm install                 # also runs prisma generate
cp .env.example .env
npx prisma migrate deploy   # create / update tables
npm run dev                 # http://localhost:5001 (nodemon)
npm start                   # production
```

Optional: `node scripts/backfill-embeddings.js` fills in search vectors for reports created before vector search existed (the AI engine must be running).

## Auth

- **Email + password:** `POST /auth/signup`, `POST /auth/login` (bcrypt).
- **Google:** `GET /auth/google` → `/auth/google/callback`. If a Google account's email matches an existing email account, the two are linked.
- **Session:** an HTTP-only `token` cookie holding a JWT signed with `COOKIE_KEY`. It lasts 30 days and is re-issued from `GET /api/current_user` once it's more than a day old, so active users stay signed in. In production the cookie is `Secure; SameSite=None`.
- **LinkedIn / X connect:** `GET /auth/:provider?returnTo=/path` → `/auth/:provider/callback`, which stores the access token and sends the user back to `returnTo`. LinkedIn tokens last 60 days and can't be refreshed for non-partner apps, so users reconnect.

## API

All `/api` routes except `current_user` and `logout` require the session cookie.

| Method | Path | What it does |
| :--- | :--- | :--- |
| GET | `/api/current_user` | Signed-in user + connected accounts (renews the session) |
| GET | `/api/logout` | Clears the session |
| GET | `/api/projects?page&limit&search&sort&status` | List research; `search` uses vector + keyword matching |
| POST | `/api/projects` | Start a research agent (`{ title }`) |
| GET / PUT / DELETE | `/api/projects/:id` | Read (with notes), rename, delete |
| POST | `/api/notes` | Add a note (`{ content, projectId }`) |
| PUT / DELETE | `/api/notes/:id` | Edit / delete a note |
| POST | `/api/generate-linkedin-post` | Report → `{ post_html, hashtags, image_prompt, image_style }` |
| POST | `/api/generate-image` | `{ prompt, style }` → `{ image_url }` |
| GET | `/api/drafts?status=` | Drafts and post history, plus counts per status |
| POST | `/api/drafts` | Create a draft (optionally linked to a project) |
| GET / PUT / DELETE | `/api/drafts/:id` | Read, autosave (drafts and failed posts only), delete |
| POST | `/api/drafts/:id/duplicate` | Copy any post into a new draft |
| POST | `/api/drafts/:id/unschedule` | Cancel a scheduled post and return it to drafts |
| POST | `/api/social/:provider/post` | Publish now (`{ text, imageUrl, draftId }`) |
| POST | `/api/social/:provider/schedule` | Schedule (`{ text, scheduledAt, imageUrl, draftId }`); warns if the connection expires first |

## Scheduler

`processScheduledPosts` runs every 60 seconds inside the server process. It claims due `ScheduledPost` rows (so a post can't be published twice), posts them, retries other errors up to 3 times, and marks the linked draft as published or failed. An expired connection fails the post straight away with a "reconnect" message.

## Data model

`prisma/schema.prisma`: `User`, `SocialAccount`, `Project` (with a 384-dim `vector` embedding), `Note`, `PostDraft` (draft → scheduled → published / failed) and `ScheduledPost`. Migrations live in `prisma/migrations` and are written to be safe to re-run.

Social providers implement a shared interface in `src/services/social/` (`LinkedInProvider`, `XProvider`, picked by `ProviderFactory`).
