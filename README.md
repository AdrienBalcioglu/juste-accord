# Juste Accord

An AI assistant that guides French employees through a *rupture conventionnelle*, the negotiated termination of an employment contract.

It asks one question at a time, reads your payslips and contract, and takes you from "am I eligible?" to "what do I do after signing?". The interface and the assistant are in French.

## What it does

| Step | Content | Access |
| --- | --- | --- |
| Eligibility | Contract type, seniority, context: a clear verdict | Free |
| Legal severance | Calculation from your payslips (Art. L1237-19) | Free |
| Collective agreement severance | Syntec, banking, insurance, metalworking and others, compared with the legal amount | Paid |
| Negotiation | Target range, personalised script, traps to avoid | Paid |
| Waiting period | Delay before unemployment benefits (France Travail) | Paid |
| After signing | Checklist and deadlines | Paid |

The paid steps are unlocked by a one-off Stripe payment.

Juste Accord gives legal information, not legal advice. For a complex case, see an employment lawyer.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Claude API · Stripe

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

1. Create a Supabase project, run `supabase/migrations/001_initial.sql`, and enable anonymous sign-ins.
2. Fill `.env.local` with your Supabase, Anthropic and Stripe keys.
3. Point a Stripe webhook to `/api/stripe/webhook` for the `checkout.session.completed` event.

## Security

- **Data isolation.** Every table has row level security: a user only reads and writes their own sessions, messages and documents. Uploaded PDFs go to a private storage bucket.
- **API cost control.** Visitors start with an anonymous session, so each account has a daily cap on chat messages and document extractions (`lib/limits.ts`). Messages, history and files are bounded in size, and only PDFs are accepted.
- **Ownership checks.** Each API route checks that the session belongs to the signed-in user before it stores anything or calls the Claude API.
- **Payments.** Paid steps are checked on the server. The Stripe webhook verifies the signature of every event.
- **Secrets.** All keys are read from environment variables. Nothing is committed.

If you deploy your own instance, turn on CAPTCHA for anonymous sign-ins in Supabase, so that new anonymous accounts cannot be created in bulk to get around the daily caps.

## License

[GNU AGPL v3](LICENSE) © 2026 Adrien Balcioglu

You can read, run and modify this code. If you run a modified version as a service, you must publish your changes under the same license.
