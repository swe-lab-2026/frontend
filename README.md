# BiletFlow — web app (organizer cabinet)

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Talks to the FastAPI backend in
[`swe-lab-2026/backend`](https://github.com/swe-lab-2026/backend) over REST.

## Run locally

1. Start the backend on `http://localhost:8000` (see the backend README).
   Its `CORS_ORIGINS` does not matter for the web app: the browser calls `/api/v1/*` on
   the Next.js server, which proxies to the backend (`next.config.ts`).
2. Configure and start the web app:

   ```bash
   cp .env.example .env.local   # BACKEND_URL=http://localhost:8000
   npm install
   npm run dev                  # http://localhost:3000
   ```

In development the backend prints email verification codes to its log
(`verification code for <email>: 123456`) instead of sending email.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest): timezones, API client, validation, dictionaries |

## Structure

```
app/
  (auth)/login, register, verify-email   SCRUM-19: sign-in flow (public)
  (app)/layout.tsx                       protected area: redirects to /login when signed out
  (app)/profile                          SCRUM-19: account, organizer profile, demo payout account
  (app)/events                           SCRUM-20: event list with status filter
  (app)/events/new                       SCRUM-20: create draft
  (app)/events/[eventId]                 SCRUM-20: overview (stats, publish checklist, event admins)
  (app)/events/[eventId]/edit            SCRUM-20: edit details
  (app)/events/[eventId]/tickets         SCRUM-20: ticket types + inventory
  (app)/events/[eventId]/campaigns       SCRUM-23: promo campaigns, Campaign QR, performance
  (app)/events/[eventId]/analytics       SCRUM-24: KPIs, revenue, sales over time, attendance, campaigns
  (app)/events/[eventId]/history         SCRUM-24: activity timeline
  (public)/catalog/[eventId]             SCRUM-21: public event page, ticket and promo selection
  (public)/orders/[orderId]              SCRUM-21: price review, reservation timer, demo payment
  (public)/campaigns/[token]             SCRUM-23: Campaign QR target, forwards to the event page
components/        ui.tsx (buttons, fields, cards…), chrome.tsx (header, logo, language), events/*
lib/api/           types.ts (mirrors backend schemas), client.ts (fetch + token refresh), endpoints.ts
lib/i18n/          ru (default), kk, en dictionaries — en.ts is the reference type
lib/datetime.ts    event times are entered in the venue's IANA timezone and sent with an offset
```

## Conventions

- **API types** in `lib/api/types.ts` mirror `app/schemas/*` in the backend. When the
  backend changes a schema, update this file in the same sprint.
- **Text** never goes straight into JSX: add the key to `en.ts`, `ru.ts` and `kk.ts`
  (a test fails if the three drift apart). Kazakh strings need review by a native speaker.
- **Errors**: backend `error.code` values map to `t.errors.*`; field errors from
  `VALIDATION_ERROR` are shown under the matching input.
- **Auth**: access + refresh tokens are kept in `localStorage` and refreshed once on a
  401 (the backend rotates refresh tokens and rejects reuse). This is simple but readable
  by any XSS; an httpOnly-cookie BFF would be the production-grade option.

## Known gaps (backend not ready yet)

- Image upload; paid-sales activation screen. No endpoint marks an organizer VERIFIED or a
  payout account ACTIVE, so activation also needs a manual database change.
- Attendees cannot see remaining stock or whether paid sales are active before ordering:
  the event page learns it from the server's rejection and then blocks that ticket.
- Checkout has no attendee fields in the API; tickets are issued to the signed-in account.
- Analytics has no time series: the sales chart sends one request per bar (at most 31).
- Support cases and platform administration have no screens yet.
- Organizers can no longer cancel a free registration: the backend answers 403.
- No `GET` for the payout account, so the profile page only shows it after saving.
- The event list has no per-event sales numbers (would need one inventory call per event).
