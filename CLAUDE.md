# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AI-powered assistant for French legal guidance on "rupture conventionnelle" (negotiated employment termination). Guides employees through eligibility, compensation calculation, negotiation strategy, and France Travail procedures.

## Build & Deployment

### Commands
```bash
npm run dev       # Next.js dev server (http://localhost:3000)
npm run build     # Production build
npm run start     # Start production server
```

### Tech Stack
- **Framework**: Next.js 16.2.4 (App Router)
- **Runtime**: React 19.2.4 with TypeScript 5
- **Styling**: Tailwind CSS 4 + Radix UI (button, card, progress, badge, textarea, separator, slot)
- **API Client**: @anthropic-ai/sdk 0.91.1 (Claude API)
- **Database**: Supabase (PostgreSQL) with Auth (anon + RLS)
- **Storage**: Supabase Storage for PDF documents
- **Payment**: Stripe (v22.1.0) with checkout & webhook
- **UI Icons**: Lucide React
- **Utilities**: class-variance-authority, clsx, tailwind-merge

### Config Files
- `next.config.ts` — Next.js 16 config
- `tsconfig.json` — Strict mode, ES2017 target, path alias `@/*` → root
- `package.json` — No test/lint commands; Tailwind PostCSS

---

## Architecture Overview

### High-Level Flow
1. **Public Landing** (`/`) — Info about RC process, how it works, pricing
2. **Auth Routes** (`/(auth)`) — Anonymous signup auto-creates Supabase user
3. **App Routes** (`/(app)`) — Protected dashboard with step-based workflow
4. **API Routes** (`/api/*`) — Backend for Claude, document extraction, Stripe

### Data Flow
```
Client → API Route → Claude API / Supabase → Response Stream (SSE)
                  → PDF Upload → Anthropic Vision → Extract JSON → DB
```

### Database Schema (Supabase)
- **rc_sessions** — User session, payment status, collected data (`data: jsonb`)
- **rc_steps** — 6-step workflow with status (locked/in_progress/completed)
- **rc_messages** — Chat history (user/assistant pairs per step)
- **rc_documents** — Uploaded PDFs with extracted data
- **rc_storage** — PDF storage under `rc-documents/{user_id}/{session_id}/`

### Authentication
- Supabase Auth with anonymous + real user support
- Anonymous users auto-created on first visit
- Real users (auth) unlock premium steps and save across sessions

### Step Workflow (STEP_ORDER)
1. **eligibility** (free) — Verify RC eligibility, analyze situation
2. **indemnite_legale** (free) — Calculate legal minimum indemnity (upload payslips)
3. **indemnite_conv** (premium) — Check collective agreement indemnity
4. **negociation** (premium) — Negotiation strategy, target range, script
5. **carence** (free) — France Travail (unemployment) waiting period rules
6. **post_signature** (premium) — Post-signature checklist, deadline tracking

Each step:
- Has custom system prompt for Claude context
- Tracks required documents (e.g., `bulletin_salaire`, `contrat_travail`)
- Locks/unlocks based on payment status
- Auto-extracts JSON at step end (`<data>...</data>` markers)

---

## Key Patterns

### API Routes (Claude Streaming)
**POST /api/chat**
- Stream-based interaction with Claude Sonnet 4.6
- System prompt includes step instructions + collected session data
- Auto-starts with `__start__` trigger (hidden, no DB save)
- Parses `<data>{json}</data>` from response to update rc_sessions
- Saves messages, auto-unlocks next step if free or user paid

**POST /api/extract**
- File upload (FormData) → Supabase Storage
- Base64 encode PDF → Claude Vision API
- Extract to JSON via step-specific EXTRACTION_PROMPTS
- Merge into rc_sessions.data for downstream steps

**POST /api/stripe/checkout** & **/webhook**
- Checkout: Create Stripe session → redirect
- Webhook: Listen for `payment_intent.succeeded` → mark session paid

### Client Patterns
- **"use client"** top-level; server client in `/lib/supabase/client.ts`
- **Server layout** (`/(app)/layout.tsx`) → Auth check, header render
- **Supabase SSR** via cookies → secure auth on server
- **Message history** passed to Claude on each call (context window limit)

### Supabase Config
- **Server client** (`lib/supabase/server.ts`) — SSR, cookies, server components
- **Browser client** (`lib/supabase/client.ts`) — NEXT_PUBLIC URLs, anon key
- **Environment**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Claude API Integration
- **Model**: claude-sonnet-4-6
- **Max tokens**: 1500 (chat), 1000 (extraction)
- **Streaming**: ReadableStream with text deltas
- **Vision**: PDF extraction via `document` content type + base64
- **System prompts**: Baked into STEPS config (lib/rc-logic.ts)

---

## Project Structure

```
juste-accord/
├── app/
│   ├── (app)/                    # Protected routes
│   │   ├── layout.tsx            # Auth check, header
│   │   └── dashboard/page.tsx    # Step workflow UI
│   ├── (auth)/                   # Public auth
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── chat/route.ts         # Claude streaming
│   │   ├── extract/route.ts      # PDF → JSON extraction
│   │   ├── auth/signout/route.ts
│   │   ├── reset/route.ts
│   │   └── stripe/
│   │       ├── checkout/route.ts
│   │       └── webhook/route.ts
│   ├── layout.tsx                # Root layout, metadata
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Tailwind + custom
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # SSR client
│   │   └── client.ts             # Browser client
│   ├── rc-logic.ts               # STEPS config + prompts
│   ├── stripe.ts                 # Stripe instance
│   └── utils.ts                  # Helper functions
├── components/
│   ├── flow/
│   │   ├── StepCard.tsx
│   │   ├── FlowProgress.tsx
│   │   └── PaywallBanner.tsx
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── ChatMessage.tsx
│   │   └── DocumentUpload.tsx
│   └── ui/                       # Radix UI primitives
├── types/index.ts                # TypeScript types
├── public/                       # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
└── CLAUDE.md                     # This file
```

---

## Type Definitions

```typescript
type StepId = 'eligibility' | 'indemnite_legale' | 'indemnite_conv' | 'negociation' | 'carence' | 'post_signature'
type StepStatus = 'locked' | 'in_progress' | 'completed'

interface RCSession {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  is_paid: boolean
  stripe_payment_intent_id: string | null
  data: Record<string, unknown>  // Collected data from steps
}

interface RCStep {
  id: string
  session_id: string
  step_id: StepId
  status: StepStatus
  completed_at: string | null
  extracted_data: Record<string, unknown>
}

interface RCMessage {
  id: string
  session_id: string
  step_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface RCDocument {
  id: string
  session_id: string
  step_id: string
  file_name: string
  storage_path: string
  extracted_data: Record<string, unknown>
  uploaded_at: string
}

interface StepConfig {
  id: StepId
  title: string
  description: string
  isPremium: boolean
  requiredDocuments: { key: string; label: string; required: boolean }[]
  systemPrompt: string
}
```

---

## Environment Variables

Required (create `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-v0-...
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Key Implementation Notes

### Document Extraction
- PDFs uploaded to `/api/extract` with `FormData`
- Stored in Supabase Storage
- Converted to base64 → Claude Vision API
- Step-specific prompts extract: `salary_brut`, `salary_net`, `end_date`, etc.
- JSON parsed and merged into `rc_sessions.data`

### Step Progression
- Steps locked by default; first step auto-starts
- Free steps unlock on completion for all users
- Premium steps unlock only for paid users (`is_paid: true`)
- Completion triggers data extraction and next step unlock

### Message History
- Full conversation preserved in `rc_messages` table
- Passed to Claude on each turn for context
- Max 1500 tokens per response (document context limit)

### Anonymous → Real User
- Anonymous user created on landing
- Can do free steps without auth
- Must sign up / log in to unlock premium steps
- Session persists across browsers via Supabase auth

---

## Common Tasks

### Add a New Step
1. Add `StepId` to union type in `types/index.ts`
2. Add entry to `STEPS` in `lib/rc-logic.ts` with systemPrompt, documents
3. Update `STEP_ORDER` array in chat route
4. Create `(app)/steps/[stepId]/page.tsx` if custom UI needed

### Change Claude Model
- Edit `model: 'claude-sonnet-4-6'` in `/api/chat/route.ts` and `/api/extract/route.ts`
- Verify max_tokens align with new model's context

### Debug Supabase Issues
- Check auth state: `supabase.auth.getUser()`
- Review RLS policies on tables
- Verify NEXT_PUBLIC URLs and ANON_KEY

### Test PDF Extraction
- Use `/api/extract` FormData endpoint with sample PDF
- Check extracted_data in rc_documents table
- Verify prompt returns valid JSON

---

## Deployment Notes

- Vercel recommended (Next.js native)
- Set environment variables in Vercel dashboard
- Supabase DB auto-scales
- Stripe webhook URL: `https://your-domain.com/api/stripe/webhook`
- ANTHROPIC_API_KEY is sensitive — use Vercel environment encryption

## Known Patterns

1. **Streaming responses** — Use ReadableStream with TextEncoder, loop over `stream` async iterator
2. **SSR auth** — Server components await `createClient()`, then `getUser()`
3. **PDF extraction** — Base64 in Anthropic `document` content type
4. **Data persistence** — Step completion merges JSON into rc_sessions.data
5. **Fallback for anonymous** — Auto-signup happens in landing page useEffect
