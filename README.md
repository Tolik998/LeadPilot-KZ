# LeadPilot KZ

A private CRM for collecting restaurant leads, managing outreach statuses and opening prefilled WhatsApp conversations.

## Prerequisites

- Node.js `>=22.13.0`
- Neon/PostgreSQL database

## Quick Start

```bash
npm install
npm run dev
```

Create `.env.local` first:

```env
DATABASE_URL=postgresql://...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=long-random-password
```

## Deployment

The project is configured for Vercel. Connect a Neon database through the Vercel Marketplace, set `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then deploy:

```bash
npm run dev
npm run build
vercel --prod
```

## Main features

- automatic import from the official 2GIS Places API
- lead statuses and notes
- duplicate protection by 2GIS ID and phone
- prefilled WhatsApp outreach messages
- server-side Basic authentication
- persistent Neon Postgres storage

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the production Next.js build
- `npm test`: run lint and production build checks
