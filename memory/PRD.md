# Creator Hub — منصة صناع المحتوى

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
### P0 — Engine Restructure (backend refactor)
- Split `server.py` (1240 lines) into 14 Engine modules under `backend/engines/`
- Modules: Social, Marketplace, Community, Incubator, Business, CRM, Content, AI, Academy, Events, Booking, Analytics, Admin, Payment

### P1 — New Engines (Missing Modules)
- **CRM Engine**: Clients + Leads + Pipeline + Contracts + Invoices + Projects
- **Content OS Engine**: Content Calendar + Idea Gen + Scriptwriting + Review/Approval + Publishing + Analytics
- **Tasks Engine**: Tasks + Kanban Boards + Calendar + Deadlines + Team Assign
- **AI Everywhere**: Hooks, Bio enhancement, price suggestion, deal close prediction, project idea development
- **RBAC**: 10 roles (super_admin, ceo, marketing_manager, community_manager, company, creator, trainer, student, client, team_owner) + role-based dashboards
- **Digital Twin (Booking Engine)**: Meeting rooms, studio bookings + Stripe + QR entry
- **Economic**: Pro/Business subscriptions, AI credits, featured services, Academy monetization, SaaS tier

### P2 — Nice-to-have
- WebSockets real-time notifications, video thumbnails, message media, earnings withdrawal, video effects/filters

