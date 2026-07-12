# Creator Hub — منصة صناع المحتوى
## Iteration 16 — Phase 2: Invoices + Billing + AI Credits + Quick Link (2026-02)

### Delivered
- **CRM V2 — Invoices Engine (NEW)**: full CRUD (`/api/crm/invoices`), auto-numbering `INV-YYYY-NNNN` (race-safe via `counters` collection + `findOneAndUpdate`), computed totals (subtotal / tax / discount), 5 statuses (draft/sent/paid/overdue/cancelled), stats endpoint.
- **PDF generation**: `reportlab` + `arabic-reshaper` + `python-bidi` + FreeSerif Arabic-capable font. Two endpoints:
  - `GET /api/crm/invoices/{id}/pdf` — branded invoice PDF (Ru'ya header, RTL).
  - `GET /api/crm/deals/{id}/contract-pdf` — full Arabic service contract PDF from deal data.
- **Deal shortcut**: `POST /api/crm/deals/{id}/create-invoice` auto-generates invoice from deal.
- **Economic Tier — Billing Engine (NEW)**: 3 plans (Free/Pro $19/Business $49), monthly AI credit budgets (30/500/3000), Stripe checkout via `emergentintegrations.payments.stripe.checkout`, 30-day plan activation via polling `/api/billing/status/{session_id}`, notifications on activation.
- **AI Credits Metering**: `consume_credit()` + `refund_credit()` helpers, monthly counter in `db.ai_usage` per `{user_id, month}`, gate applied to `/api/ai/assist` and `_ai_call()` in content engine (returns 402 on exhaustion, refunds on failure).
- **Frontend pages (NEW)**: `/crm/invoices` (list + KPIs + filters + create modal with live totals), `/crm/invoices/:id` (detail + status picker + PDF download), `/pricing` (3-plan cards + upgrade → Stripe), `/billing` (current plan + credits meter + upgrade CTA).
- **Deal Detail enhancements**: `create-invoice-btn` + `download-contract-btn` (PDF blob download).
- **Workspace credits chip**: `credits-chip` in hero showing `remaining/total`, links to /billing.
- **Quick Link (friendly suggestion)**: TaskForm now has collapsible ربط سريع section with 3 dropdowns (`link-client`, `link-deal`, `link-content`) auto-populating from CRM/Content data; sends `client_id/deal_id/content_item_id` to `/api/tasks`.

### Verification (iteration_16.json)
- Backend: **14/14 pytest PASS** — invoices CRUD + PDF, contract PDF, billing plans/me/checkout, AI credit consumption + exhaustion 402.
- Frontend: **14/14 Playwright checks PASS** — full E2E of every new page + data-testid + regression on Morning Brief, /u/:username, /crm/clients/:id.
- Post-report improvements applied: (1) refund_credit on AI failure so users aren't charged for failed calls; (2) race-safe invoice numbering via counters collection + max-seeding.


## Iteration 15 — Phase 1: Cross-Engine Linking + AI Everywhere (2026-02)

### Delivered
- **New page `/crm/clients/:id` (CRMClientDetail.jsx)** — 4-tab cross-engine view (Deals / Content / Tasks / Activities) with counts, empty-state CTAs, and click-through to detail pages of every engine. Consumes `/api/workspace/related?client_id=`.
- **CRMClients.jsx** — client cards now navigate to detail via `open-client-<id>`.
- **App.js** — new route `/crm/clients/:id`.
- **CRMDealDetail.jsx enhancements**:
  - New AI card 'تنبؤ إغلاق الصفقة' (data-testid `deal-ai-predict`, button `predict-close-btn`, result `prediction-result`) — Claude Sonnet 4.5 via `/api/ai/assist` (task=deal_close).
  - Related tasks + related content sections (`deal-task-<id>`, `deal-content-<id>`) via `/workspace/related?deal_id=`.
- **ContentDetail.jsx enhancements**:
  - `linked-client-card` at top (visible when content has `client_id`) — click navigates to Client Detail.
  - `content-task-<id>` list — tasks linked to the content item.
- **EditProfile.jsx** — new `improve-bio-btn` (uses `improve_bio`/`profile_bio` AI prompts) that populates/enhances the bio textarea via Claude.

### Verification (iteration_15.json)
- Backend: 8/8 pytest — workspace/related (client_id, deal_id, content_id), crm/clients/{id}, ai/assist (deal_close, improve_bio, profile_bio), morning-brief — **100% PASS**.
- Frontend: Playwright E2E — cross-engine navigation, AI prediction (~5s Arabic response), Improve Bio (~8s Arabic response), all data-testids verified, no console errors, no regression on morning brief or profile route — **100% PASS**.


## Iteration 14 — Morning Brief (مساعد بدء اليوم) (2026-02)

### Delivered
- **Backend endpoint**: `POST /api/workspace/morning-brief` — AI-powered daily kickoff.
  - Gathers user's day (overdue tasks, due-today, upcoming content, stale deals).
  - Sends compact JSON context to Claude Sonnet 4.5 (via emergentintegrations + EMERGENT_LLM_KEY).
  - Returns `{user_id, date, summary (Arabic), focus: [{title, why, engine, ref_id}]×3, from_cache}`.
  - Cached per `{user_id, date}` in `db.workspace_briefs`; `?force=true` regenerates.
  - Deterministic fallback if AI parsing fails.
- **AI prompt**: New `morning_brief` entry in `AI_PROMPTS` — warm Arabic, JSON-only output.
- **Frontend**: New Morning Brief card at the top of `/workspace`.
  - Auto-loads on mount, refresh button (`RefreshCw` spinner), sonner toast on refresh.
  - Focus items are clickable and route to CRM/Tasks/Content engines (ref_id → detail; else engine root).
  - Data-testids: `morning-brief-card`, `morning-brief-summary`, `morning-brief-refresh`, `morning-focus-0/1/2`.

### Verification (iteration_14.json)
- Backend: 4/4 pytest (auth 401, cache miss, cache hit, force=true) — 100% PASS.
- Frontend: Playwright E2E — card renders, Arabic summary populated, 3 focus items clickable, refresh spinner + toast, no console errors, workspace regression intact — 100% PASS.


## Iteration 13 — Hotfix: Profile page crash on "حسابي" nav (2026-02)

### Bug fixed
- **Symptom**: Clicking bottom-nav "حسابي" (data-testid=nav-profile) redirected to an error/blank page.
- **Root cause**: `/app/frontend/src/pages/Profile.jsx` line 144 referenced undefined `user?.role` (aliased as `me` from `useAuth()` on line 10), throwing `ReferenceError: user is not defined` and crashing the whole Profile component.
- **Fix**: Replaced `user?.role === "super_admin"` → `me?.role === "super_admin"`.

### Verification
- Testing agent (iteration_13.json) — 9/9 frontend checks PASS (100%).
- Verified for both super_admin (admin button visible) and freshly signed-up creator (admin button hidden).
- Bottom-nav regression on /feed, /workspace, /explore — no console/page errors.



## Iteration 10 — Sprint "Content OS Engine V1" (2026-07)

### Delivered
- **Full Content OS Engine**: `content_engine.py` from placeholder → ~280 lines.
- **Backend endpoints (~14 new)** under `/api/content/*`:
  - **Meta**: `GET /content/meta` → 7 statuses + 8 platforms + 7 formats
  - **Items**: full CRUD + search + filter (status/platform/client)
  - **Status transitions**: `PUT /content/items/{id}/status` with auto-`published_at` on publish
  - **Kanban**: `GET /content/kanban` → items grouped by all 7 statuses (idea → draft → review → approved → scheduled → published → archived)
  - **Calendar**: `GET /content/calendar?year&month` → items grouped by day
  - **Stats**: total, ideas, drafts, scheduled, published, published_this_month, by_platform, by_status
  - **AI-powered helpers** (Claude Sonnet 4.5): `/content/ai/ideas`, `/content/ai/script`, `/content/ai/caption`, `/content/ai/hashtags`
- **User-scoped** (owner_id filter) — strict isolation verified
- **CRM client link** — optional `client_id` connects content to a CRM client
- **8 platforms** supported: Instagram, TikTok, X, LinkedIn, YouTube, Facebook, Snapchat, Other
- **7 formats**: Reel, Post, Story, Thread, Video, Carousel, Live
- 4 new prompts added to `AI_PROMPTS`

### Frontend (5 pages)
- `/content` — Dashboard (KPIs by status, upcoming scheduled, by-platform breakdown, empty-state onboarding)
- `/content/kanban` — 7-column Kanban board (horizontal scroll), per-card stage menu
- `/content/calendar` — Monthly Arabic calendar with items on scheduled/published days (RTL week starting Saturday)
- `/content/ai` — Dedicated AI creative page: 4 task types (ideas/script/caption/hashtags) + topic input + platform/format selectors + copy result
- `/content/item/:id` — Full editor: inline edit title, status picker, hook/caption/hashtags/script fields, per-field AI Wand2 buttons, apply-to-field flow
- Content OS entry card added to Profile page (side-by-side with CRM card)

### Test coverage (Iteration 10)
- **29/29 backend tests passed** (100%)
- Zero regressions
- User isolation strict ✓
- CRM client integration + enrichment ✓
- All 4 AI endpoints working with Claude Sonnet 4.5 (budget now sufficient) ✓
- Frontend visually verified all 5 pages render correctly

## Original Problem Statement
ابغى اسوي تطبيق يجمع صناع المحتوى ويربط بينهم وبين العملاء والمنصة تكون مثل التيك توك يستطيع الشخص صناعة محتوى لتسويق نفسه او منتجه او خدمته.

## Architecture
- **Frontend**: React 19, Tailwind, Sonner toasts, Arabic RTL layout, TikTok-style vertical scroll feed. Font: Cairo (heading) + Tajawal (body). Primary accent: Electric Yellow (#E3FF00).
- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, Stripe checkout via emergentintegrations, Emergent Object Storage for videos.
- **DB Collections**: users, videos, likes, comments, follows, services, orders, payment_transactions.

## Personas
- **Creator**: publishes short vertical videos, offers paid services (portfolio + pricing).
- **Client**: discovers creators via TikTok-style feed, orders their services, pays via Stripe.
- Every account is both creator AND client (unified).

## Implemented Features (First Release — 2026-02)
- Auth: signup/login (JWT + bcrypt), `GET /auth/me`.
- Users: profile view, follow/unfollow, edit name/bio.
- Videos: multipart upload → Emergent Object Storage, streaming endpoint, TikTok-style snap feed, autoplay on scroll, like, view increment, category tagging.
- Comments: list + add per video.
- Services: creators create/delete services with title, description, price (USD), delivery days.
- Orders: client creates order for a service → pending_payment → paid → delivered.
- Stripe payments: checkout session created from order, redirect flow, status polling, webhook handler.
- Explore: top creators by followers.
- Full Arabic RTL UI with mobile-first (max-w-md) layout and bottom nav.

## Backlog (P1/P2)
- P1: Video thumbnails (currently first-frame). Search creators by name/category. Notifications on order/comment.
- P1: Direct messages between client & creator.
- P2: Creator earnings dashboard, ratings/reviews, disputes, split payouts.
- P2: Video effects, filters, in-app camera.

## Next Actions
- Testing (backend + frontend flows).
- Ask user which feature to prioritize next.

## Iteration 2 — 2026-02 (Added)
- **Reviews & Ratings**: clients can rate paid orders 1-5★ with text, service page shows avg + all reviews.
- **Search**: `GET /api/search?q=` fuzzy match on user name/username + video caption/category.
- **Notifications**: bell icon in feed, notifications for orders, comments, reviews, payments, deliveries, messages. Auto-mark-seen on visit.
- **Direct Messages**: 1-on-1 chat between any two users, with unread counts + polling every 5s.
- **10% Platform Commission**: On paid orders, `platform_fee` (10%) and `creator_earnings` (90%) are stored on both `payment_transactions` and `orders`. Creators see an earnings card on their profile with total gross/fees/net + orders count.

## New Endpoints
- `GET /api/search?q=` → {users, videos}
- `POST /api/reviews`, `GET /api/reviews/service/{id}`, `GET /api/orders/reviewed-ids`
- `GET /api/notifications`, `POST /api/notifications/mark-seen`
- `GET /api/messages/conversations`, `GET/POST /api/messages/with/{username}`
- `GET /api/earnings/me`

## Testing
- Iteration 2: 21/22 passed → 1 bug (missing comment notification)
- Iteration 3: fix verified 100%

## Remaining Backlog
- P2: earnings withdrawal flow (payout to creator bank), notifications real-time via websockets, video thumbnails, message media/images

## Iteration 7 — Sprint "Agency Rebrand" (2026-07)
Vision pivot from "Creator Platform" → "Digital Marketing Agency × Creative Operating System".
Slogan: **"ندشن قصة حب جديدة مع عميلك"** (We launch a new love story with your client).

### Delivered
- **New Agency Landing Page at /** (public, full-width desktop responsive). 8 sections:
  1. Fixed TopNav (logo + menu + CTA)
  2. Hero (huge slogan, dual CTAs, trust indicators, parallax bg image, animated grid + glow)
  3. Manifesto/About (crossed-out competitors, our philosophy, stats)
  4. What We Offer (4 emotional service cards: Brand, Content, Marketing, Growth)
  5. Love Stories (3 testimonial case studies with metrics)
  6. Vision 2030 (5-year roadmap timeline)
  7. Ruaa Principles (8 grid cards)
  8. Contact form (POST /api/leads) + Footer
- **Framer Motion animations** on scroll (fade-in, parallax, opacity fade)
- **Routing restructured**: `/` = Landing, `/feed` = mobile TikTok Feed, `/auth` redirects to `/feed` after login
- **Backend `/api/leads`** (public POST + admin-only GET) with EmailStr validation
- **Backend restart & full re-init**: emergentintegrations Storage OK, Communities seeded, all previous endpoints intact (7/8 regression pass — only AI blocked by LLM budget which is infra, not code)

### Test coverage (Iteration 7)
- Leads endpoint: 5/5 ✅ (valid, invalid email, missing field, unauth, non-admin)
- Regression: 7/8 ✅ (only /api/ai/assist blocked by budget)

## Remaining Roadmap (per Manus report 2026-07)
## Iteration 8 — Sprint "Backend Engine Restructure" (2026-07)

### Delivered
- **Full backend refactor**: monolithic `server.py` (1240 lines) → 22-file modular Engines architecture with ZERO regressions.
- **Structure**:
  - `backend/core/deps.py` (188 lines) — env, db, security, storage, notifications helper, constants
  - `backend/core/schemas.py` (132 lines) — all Pydantic models
  - `backend/engines/` — 18 domain routers:
    - **Active engines** (13): auth, social, marketplace, payment, community, team, incubator, ai, notification, search, events, academy, crm
    - **Placeholder engines** (5, ready for future iterations): admin (RBAC), analytics (platform stats — this one has real data), content (Content OS), tasks (Kanban), booking (Digital Twin)
  - `backend/server.py` (101 lines) — orchestrator + CORS + startup hooks
- **New endpoints introduced**:
  - `GET /api` → engine list + version
  - `GET /api/analytics/platform` → live counts
  - `GET /api/admin|content|tasks|booking/ping` → placeholders

### Test coverage (Iteration 8)
- **54/56 passed** (96.4% pass rate)
- 0 regressions
- 2 skipped: /api/ai/assist (LLM budget exceeded — infra), /api/videos/{id}/view (no videos seeded)
- Every engine verified: auth ✅, social ✅, marketplace ✅, community ✅, team ✅, incubator ✅, notification ✅, search ✅, events ✅, academy ✅, crm ✅, analytics ✅, placeholders ✅

## Remaining Roadmap (per Manus report 2026-07)
### P1 — Next Big Feature (one at a time)
1. **CRM Engine expansion** — Clients, Deals, Pipeline (kanban stages: lead→qualified→proposal→won/lost), Contracts, Invoices, Projects (built on top of existing `/api/leads`)
2. **Content OS Engine** — Content Calendar + Idea Gen + Scriptwriting + Review/Approval workflow + Publishing schedule + Analytics
3. **Tasks Engine** — Tasks + Kanban Boards + Calendar + Deadlines + Team Assign (works with teams engine)
4. **AI Everywhere** — extend AI_PROMPTS with video hooks, bio improvement, price suggestion, deal-close prediction (already prep in deps.py)
5. **RBAC** — 10 roles + role-based dashboards + admin UI
6. **Digital Twin (Booking Engine)** — Meeting rooms + Stripe + QR entry codes
7. **Economic tier** — Pro/Business subscriptions, AI credits, featured services

### P2 — Nice-to-have
- WebSockets real-time notifications, video thumbnails, message media, earnings withdrawal, video effects/filters

