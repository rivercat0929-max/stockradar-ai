# StockRadar AI

StockRadar AI is a responsive web MVP for portfolio tracking, stock research, alerts, and backtest summaries. It uses Next.js, TypeScript, Tailwind CSS, Prisma, and a Neon PostgreSQL database for deployment on Vercel.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma
- Neon PostgreSQL
- Vercel

## Pages

- `/` Dashboard
- `/holdings` Portfolio holdings
- `/stocks/AMZN` Stock detail, with other sample tickers supported
- `/radar` Stock Radar
- `/calendar` Event Calendar
- `/backtest` Backtest Lab

## Neon PostgreSQL Setup

Create a Neon PostgreSQL database manually. Do not commit real connection strings or passwords.

Local `.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require&channel_binding=require"
```

Vercel:

1. Open Project Settings.
2. Go to Environment Variables.
3. Add `DATABASE_URL`.
4. Paste the Neon PostgreSQL connection string.
5. Enable it for Production, Preview, and Development.

## Prisma Commands

Generate Prisma Client:

```bash
npx prisma generate
```

Create/apply the initial PostgreSQL migration:

```bash
npx prisma migrate dev --name init_postgres
```

## Local Development

```bash
npm install
npx prisma generate
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Environment Safety

The following files must not be committed:

- `.env`
- `.env.local`

Use `.env.example` only for placeholder values.

## Disclaimer

This product is for stock research, data analysis, and investment education only. It is not investment advice, financial advice, or a recommendation to buy or sell securities. Scores, signals, backtests, and AI summaries are for reference only. Past performance does not guarantee future results. Investing involves risk, and users are responsible for their own decisions.
