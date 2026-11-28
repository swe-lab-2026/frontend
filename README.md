# BiletFlow — web app

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Talks to the FastAPI backend in
[`swe-lab-2026/backend`](https://github.com/swe-lab-2026/backend) over REST.

One app serves three audiences: attendees (catalog, checkout, tickets, support),
organizers (event cabinet) and Platform Admins (admin portal). Interface languages:
Russian (default), Kazakh and English.

## Features

**Accounts**

- Sign up with email verification code (with resend), sign in, sign out, password reset
  by emailed link or token.
- Profile: name, email language (`en` / `ru` / `kk`), organizer profile, demo
  verification and payout account.
- In-app notifications with an unread badge in the header.

**Attendees**

- Public catalog of upcoming events with search; event page with venue, time in the
  event's timezone, images, ticket types and live availability.
- Promo codes with a server-side price quote; named attendees per ticket.
- Checkout: price review (subtotal, discount, processing fee), reservation timer,
  demo payment (success / failed / abandoned); free registration without payment.
- My orders and order details: ticket QR codes, PDF ticket download, cancel / refund
  with eligibility, Add to calendar (Google link and `.ics`).
- Report an event; list of own reports.
- Support: cases with event / order / ticket context, message thread with polling.
- Campaign QR links (`/campaigns/[token]`) forward to the event page.

**Organizers**

- Event list with a status filter; create, edit, duplicate, delete draft, publish /
  unpublish (with publish checklist), cancel; image upload.
- Ticket types (price, capacity, per-order limits, sale window, hidden) and inventory.
- Event admins / check-in staff assigned by email.
- Paid-sales activation checklist (terms, demo activation fee, verified profile,
  active payout account).
- Promo campaigns with Campaign QR (PNG) and per-campaign performance.
- Analytics: KPIs, revenue, estimated payout, sales over time, attendance, campaigns;
  activity history.
- Attendees by order with cancel and refund; refund policy; refunds of a cancelled event.
- Support requests from attendees about the event.

**Platform Admins** (`/admin/[section]`)

- Users, events, orders, payments, paid-sales activations, payout accounts, refunds,
  disputes, reports, failures, campaigns, escalated support, platform settings
  (activation fee, processing fee) and the admin action log.
- Suspend / unsuspend users and events, stop / resume paid sales, review organizer
  verification and payout accounts, resolve reports and disputes — each with a reason.
- CSV export (server-side for users, events, orders and payments).

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
  page.tsx                               entry: signed-in users go to /events, visitors to /catalog
  (auth)/login, register, verify-email   SCRUM-19: sign-in flow (public)
  (auth)/forgot-password, reset-password password reset (email link carries token and email)
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
  (app)/events/[eventId]/support         SCRUM-25: attendee requests about the event
  (app)/events/[eventId]/paid-sales      SCRUM-34: paid-sales activation checklist
  (app)/events/[eventId]/attendees       attendees by order, cancel and refund
  (app)/events/[eventId]/refunds         refund rules, refunds of a cancelled event
  (app)/admin/[section]                  SCRUM-25: admin portal: moderation, reports, disputes, payouts, fees, CSV
  (public)/notifications                 in-app notifications
  (public)/support/reports               events the user reported
  (public)/support                       SCRUM-25: case list
  (public)/support/new                   SCRUM-25: new case with event / order / ticket context
  (public)/support/[caseId]              SCRUM-25: polled message thread
  (public)/catalog                       SCRUM-21: upcoming public events with search
  (public)/catalog/[eventId]             SCRUM-21: public event page, ticket and promo selection
  (public)/orders                        my orders
  (public)/orders/[orderId]              SCRUM-21: price review, reservation timer, demo payment, tickets
  (public)/campaigns/[token]             SCRUM-23: Campaign QR target, forwards to the event page
components/        ui.tsx (buttons, fields, cards…), chrome.tsx (header, logo, language),
                   admin/, campaigns/, checkout/, events/, notifications/, paid-sales/,
                   refunds/, support/, tickets/ (TicketCard: QR + PDF)
lib/               feature helpers: checkout, refunds, campaigns, calendar, csv, support,
                   paidSales, notifications, validation, usePolling, usePromoQuote …
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

## Docker

The image holds a standalone Next.js server. `BACKEND_URL` is a **build** argument: the
`/api/v1` proxy target is fixed while building, so rebuild to change it.

```bash
# 1. Start the backend first (in the backend repo): docker compose up -d
# 2. In this repo:
docker compose up -d --build      # http://localhost:3000
```

The web container joins the backend's Compose network (`backend_default`, after the folder
the backend was cloned into). Set `BACKEND_NETWORK` when the folder has another name,
`BACKEND_URL` to use another API, and `WEB_PORT` for another port.

## Known gaps

Waiting for the backend:

- Assigned seating (SRS 4.3.1, bonus): there are no seat endpoints.
- In-app notifications cover support, moderation, payout accounts and reports. Order,
  payment, refund and event-update notices are sent by email only.
- `calendar.ics` has times in UTC only (the Google link keeps the event timezone).
- No endpoint makes a user a PLATFORM_ADMIN; the first admin is a database change.
- A support case carries the internal ticket id, so staff see a short reference.

In this app:

- Users, events, orders and payments are exported by the server (at most 10,000 rows,
  English column names); other admin lists are built in the browser (at most 5000).
- Image files can be uploaded once the draft exists, not while creating it.
- The event list has no per-event sales numbers (would need one inventory call per event).
- Kazakh texts have not been reviewed by a native speaker.
