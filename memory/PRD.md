# Creator Hub — منصة صناع المحتوى
## Iteration 28 — Moyasar Live-Keys Wired + PCI-Compliant Intent Flow + Sentry Active (2026-02)

### Delivered
- **Moyasar TEST keys wired** into `.env`:
  - `MOYASAR_PUBLISHABLE_KEY=pk_test_zEefm8dTVdHMeDSGSuwFwD5Y4uJzkyLXbYsSwFof`
  - `MOYASAR_SECRET_KEY=sk_test_...` (server-side only)
  - `MOYASAR_WEBHOOK_SECRET=Omarr187@&`
  - `SENTRY_DSN` — active + verified test event delivered
- **REFACTORED `/api/tips` and `/api/creators/{u}/subscribe` to PCI-compliant intent pattern:**
  - Backend creates the pending `tips` / `subscriptions` row, returns a `{intent}` object (amount_halalas, publishable_key, callback_url, given_id, metadata, methods).
  - Card data NEVER touches our servers — Moyasar.js on frontend collects & POSTs directly to Moyasar.
  - Reconciliation happens via `/api/webhooks/moyasar`.
- **Webhook verification hardened** — accepts 3 mechanisms (Moyasar's docs vary by version):
  1. `X-Moyasar-Secret-Token` header (plain compare)
  2. `secret_token` field in body (plain compare)
  3. `X-Moyasar-Signature` header (HMAC-SHA256 of raw body)
  All use `hmac.compare_digest` (constant-time). Missing/wrong → 401.
- **Frontend `MoyasarCheckout.jsx`** — takes an `intent` prop, loads Moyasar.js CDN, renders the hosted card form (Arabic language, mada/visa/mastercard, Apple Pay, STC Pay). CDN version corrected to `mpf/1.7.3/moyasar.{js,css}` (1.15.0 was 403).
- **`TipModal.jsx`** and **`SubscribeCard.jsx`** now open `MoyasarCheckout` with the backend-issued intent.

### Verification (iteration_28.json)
- **Backend pytest: 21/21 GREEN** — config, tip intent, subscribe intent (with plan required, duplicate 409, self-sub 400), webhook 3 verification paths, webhook idempotency (double-send doesn't double-credit), subscription initial credits `wallet_ledger` with 90% earnings, rate limits (`/tips` 20/hour, `/wallet/payout` 5/hour), Sentry env active.
- **Frontend E2E**: `/wallet` renders with 83.6 SAR from earlier test data, breakdown rows visible; `/u/crm_tester` tip flow opens tip-modal → submit-tip → moyasar-checkout modal → Moyasar's hosted form renders (name/card/expiry/CVC/pay button); same for subscribe flow with save_card=true.

### Status
- 🟢 **Backend fully operational** with real Moyasar test keys.
- 🟢 **Frontend fully operational** — user can enter real test cards.
- 🟢 **Sentry active** — errors from production reach dashboard.
- ⚠️ **Moyasar Payouts endpoint** — creates DB records only. Once user activates Payouts service in Moyasar dashboard, we'll wire the actual /v1/payouts API call (or handle manually until then).

## Iteration 27 — Monetization Pack v1 (Moyasar) + Sentry Hooks (2026-02)

### Delivered — Full Creator Economy Loop
- **Moyasar Engine** (NEW `/app/backend/engines/moyasar_engine.py`, 19 endpoints)
  - `GET /moyasar/config` — publishable key + methods (creditcard/applepay/stcpay) + platform_fee
  - **Tips (إكراميات)**: `POST /tips` (5-5000 SAR, 6 quick amounts, custom, 280-char msg), `GET /tips/received`, `GET /tips/sent`. Records in `db.tips` BEFORE Moyasar call (idempotent reconciliation).
  - **Creator Subscriptions**: `PUT /creators/me/subscription-plan` (price, title, up to 8 perks, active flag), `GET /creators/{u}/subscription-plan`, `POST /creators/{u}/subscribe` (creates pending sub + Moyasar payment with save_card=true), `GET /subscriptions/me`, `GET /subscriptions/subscribers`, `DELETE /subscriptions/{id}` (cancel_at_period_end).
  - **Wallet**: `GET /wallet` — aggregated balance (tips + subscriptions ledger + orders − reserved payouts) with 3-way breakdown. `POST /wallet/payout` — Saudi IBAN validation (SA prefix, 15+ chars, 50 SAR min, rate-limited 5/hour).
  - **Webhook**: `POST /webhooks/moyasar` — HMAC-SHA256 signature verification (permissive when secret empty for dev), stores raw events in `db.moyasar_events`, cascades to `_handle_tip_event` / `_handle_subscription_initial` / `_handle_subscription_renewal`. Idempotent (skips if already paid).
- **Sentry Integration** (`server.py`) — `sentry_sdk.init` with FastAPI + Starlette integrations, safe no-op when `SENTRY_DSN` empty. Traces sample 10%. Ready to activate on DSN provision.
- **Frontend Wallet page** `/app/frontend/src/pages/Wallet.jsx` — gradient hero balance + 3 breakdown rows + payout button (disabled < 50 SAR) + payouts history with 4-state badges + PayoutModal with IBAN + beneficiary + mobile + city.
- **TipModal** — 6 quick amounts + custom + 3 methods + 280-char message + gradient CTA.
- **SubscribeCard** — dual-mode (fan sees subscribe / creator sees edit), gradient purple/pink, perk checklist. PlanEditModal with title + price + up to 8 perks + active toggle.
- **Feed integration** — HandCoins "ادعم" button on every non-owner video → TipModal.
- **Profile integration** — 3-button row (Follow + Tip HandCoins + Message + Menu) + SubscribeCard inline + earnings card now clickable button `open-wallet-btn` navigating to /wallet.
- **App.js** — new `/wallet` protected route.
- **.env** — Moyasar keys (`MOYASAR_PUBLISHABLE_KEY=pk_live_...`, secret+webhook empty pending user), Sentry DSN empty. Zero-DSN-safe.

### Verification (iteration_27.json)
- **Backend pytest: 29/29 GREEN** — config, plan CRUD, wallet aggregation, payout validation (IBAN/amount/balance), tip creation (self-tip 400, valid → creates pending row even though external returns 503), subscription creation flows, webhook idempotency, rate limits, health with Sentry hook.
- **Frontend E2E**: /wallet page renders + all 3 breakdown rows + payout button state; TipModal on Feed non-owner videos + Profile non-owner header; SubscribeCard on creator with plan; PlanEditModal for owner without plan; payout modal validation.

### Blockers for full activation (user side)
- ⚠️ **MOYASAR_SECRET_KEY empty** — user needs to send test-mode `sk_test_...` from Moyasar dashboard
- ⚠️ **MOYASAR_WEBHOOK_SECRET empty** — user needs to activate webhook in Moyasar dashboard and share the Shared Secret
- ⚠️ **SENTRY_DSN empty** — pending user's DSN from sentry.io

## Iteration 26 — P0 Launch Blockers (2026-02)

### Delivered — Security · Compliance · Legal · Moderation
- **Rate limiting** (slowapi): `@limiter.limit` on `POST /auth/login` (10/min), `/auth/signup` (5/min), `/leads` (3/min). Honours `X-Forwarded-For`/`X-Real-IP`. Global default 300/min.
- **Magic-bytes validation** (`filetype`): Rejects spoofed extensions on
  - `/videos/upload` (mp4/mov/webm/m4v only)
  - `/users/me/avatar` (jpg/png/webp only)
  - `/messages/media` (image/video/file with denylist for exe/sh/bat/…)
- **Banned users cannot log in** (403 + Arabic error)
- **Moderation Engine** (NEW `/app/backend/engines/moderation_engine.py`)
  - `POST /api/reports` (dedupe on open target per reporter)
  - `GET /api/reports/me`, `GET /api/moderation/meta`
  - `POST/DELETE /api/users/{username}/block` (cascades unfollow)
  - `GET /api/users/me/blocks`
  - `GET /api/admin/reports` + `/stats` + `PUT /admin/reports/{id}` — resolve/dismiss + 4 actions (none/content_removed/user_warned/user_banned) that cascade to actual content
- **`/api/health`** endpoint with DB ping
- **Legal pages (Arabic RTL)** at `/legal/terms`, `/legal/privacy`, `/legal/refund` — full text drafted covering PDPL + GDPR + tax/refund policy. Linked from Landing footer + Auth page + LegalShell cross-links.
- **`accept-terms` checkbox** on signup step 3 — submit blocked until checked. Sonner error if user tries to submit without checking.
- **ReportModal** reusable component (`/app/frontend/src/components/ReportModal.jsx`) triggered from:
  - Video card (non-owner sees `video-report-{id}` flag icon)
  - Profile page (non-owner sees `user-menu-btn` → sheet with report + block)
- **Admin Reports page** (`/admin/reports`) — 4 stat pills + filter chips + expandable cards with resolve/warn/ban/dismiss actions.
- **AdminDashboard** — new `stat-reports` KPI card navigating to /admin/reports.
- **axios interceptor** — user-friendly Arabic toast on 429 responses.

### Verification (iteration_26.json)
- **Backend pytest: 23/23 GREEN** — health, rate-limit auth/signup/leads, magic-bytes (video/avatar), moderation flows (create/dedupe/invalid/list), blocks (self/unknown/cascade/list), admin reports (list/filter/enrich/stats/resolve/dismiss with action cascading to DB), banned-login block.
- **Frontend E2E** (Playwright 1920x4000): Legal pages render + footer links + LegalShell cross-links; Auth signup terms gate; Feed video-report opens ReportModal with 9 reasons; Profile user-menu-btn opens sheet with report/block; Block toggles server-side + button text updates; Admin /admin/reports full flow (stat cards, filter chips, expand card, resolve buttons); Admin dashboard `stat-reports` navigates.

### Known limitations
- **CORS still `*`** in preview (server reads from env — user should set `CORS_ORIGINS=https://doc-restore-3.emergent.host` in production).
- **Sentry** not integrated — pending user's DSN.

## Iteration 24-25 — 5-Bug Batch Fix (Recos / Video Delete / Followers / Contact Admin) (2026-02)

### Delivered
- **Bug 1: Workspace Recommendations always visible**
  - `Workspace.jsx`: recos-card is now unconditionally rendered — shows skeleton on load, empty state with `recos-generate` button if API returns 0 items, otherwise the 3 items.
- **Bug 2: Video Comments confirmed working**
  - Backend `POST /api/videos/{id}/comments` returns comment + increments count + notifies owner. Frontend `comment-input`+`submit-comment` were already wired; z-index fix (below) made them fully clickable.
- **Bug 3: Video Settings + Delete for owner**
  - Backend NEW `DELETE /api/videos/{video_id}` — owner-only (or super_admin) soft delete + cascade removes comments + likes.
  - Frontend `Feed.jsx` VideoCard: owner-only MoreVertical → sheet with `delete-video-btn-{id}` + confirm; also `Profile.jsx` own-videos grid: `delete-video-{id}` overlay button.
- **Bug 4: Followers/Following clickable list**
  - Backend NEW `GET /api/users/{username}/followers` and `GET /api/users/{username}/following` — return enriched user list with `is_following` flag for viewer.
  - Frontend `Profile.jsx`: `open-followers-btn` / `open-following-btn` open `FollowListModal` — clickable rows navigate to /u/{username}.
- **Bug 5: Admin "تواصل معنا" (Contact Us) viewer**
  - Backend NEW `GET /api/admin/leads?status=` (super_admin) + `PUT /api/admin/leads/{id}/status` with 5-state workflow (new / in_review / contacted / won / lost).
  - Frontend NEW page `/admin/leads` (AdminLeads.jsx) — expandable cards + status filter chips + inline status update + mailto reply. Nav tab `admin-tab-leads` added to AdminShell. Dashboard stat card `stat-leads` now clickable & navigates to /admin/leads.
- **Follow-up z-index fix** (iter25): Feed.jsx CommentsSheet + ServicesSheet wrappers z-50 → z-[60] (were being intercepted by bottom-nav z-50 — same class of bug fixed for Chat.jsx in iter22).

### Verification (iteration_24.json + iteration_25.json)
- Backend: **15/15 pytest PASS** — workspace recos, DELETE video owner/admin/403/404/cascade, followers+following+is_following flag, admin/leads GET+filter+PUT status valid/invalid/404/403, cross-user comment regression.
- Frontend (iter24): admin-tab-leads, admin-leads page + filter chips + lead expansion + status update PUT→200, workspace recos-card (3 items + refresh), open-followers-btn + open-following-btn modals (GET 200), 3× delete-video-{id} buttons on own grid, video-menu-{id} + delete-video-btn-{id} in Feed.
- Frontend (iter25): CommentsSheet z-[60] verified via computed style — comment-input fillable + submit-comment clickable WITHOUT force=True, POST 200, comment renders in sheet. ServicesSheet also z-[60] — service-item clickable without intercept.


## Iteration 22-23 — Video Thumbnails + Filters + Media in DMs + Disputes (2026-02)

### Delivered
- **Video Thumbnails + 8 Camera Filters** (`Upload.jsx` REWRITTEN):
  - 8 CSS-based filter presets applied live to `<video>` preview: أصلي، دافئ، بارد، زاهي، أبيض/أسود، قديم، خافت، درامي.
  - Auto-generated JPEG thumbnail via canvas at t=1s (or 10% of duration), rendered with the same filter.
  - Hardened extraction: no crossOrigin on blob URLs, preload='auto', explicit video.load(), canplay fallback, 12s timeout, graceful toast on failure.
  - Backend `POST /api/videos/upload` accepts optional `thumbnail` + `filter_name` multipart fields; stores `thumbnail_url` and `filter_name` on the video doc.
- **Media in DMs**:
  - Backend `POST /api/messages/media` — multipart image/video/file upload → object storage → returns `{media_url, media_type, filename}` (auto-detected).
  - Backend `POST /api/messages/with/{u}` now accepts `{text, media_url, media_type}` (text optional if media present).
  - Blocked dangerous extensions (.exe/.sh/.bat/.js/.php); size caps per type (image 10MB / video 50MB / file 20MB).
  - WebSocket live delivery — receiver gets 'message' event instantly.
  - Frontend `Chat.jsx` REWRITTEN: attach button, pending-media preview card with icon+filename+cancel, inline `<img>` / `<video>` / file-link rendering, z-[60] to sit above bottom nav.
- **Disputes System** (`disputes_engine.py` NEW):
  - `POST /api/disputes` (buyer-only, 409 on dup) with reasons (not_delivered/not_as_described/poor_quality/other).
  - `GET /api/disputes` (my disputes with role + counterparty).
  - `GET /api/disputes/{id}` (full detail with buyer/seller/order enriched).
  - `POST /api/disputes/{id}/messages` — threaded chat, auto-flips open → under_review; notifies counterparty.
  - `POST /api/disputes/{id}/resolve` (admin-only): refund_buyer / release_to_seller / partial_refund → also updates order status.
  - `POST /api/disputes/{id}/close` — buyer withdraws.
  - `GET /api/admin/disputes` — moderator/admin dashboard.
  - **Cross-engine schema fix**: reads both `buyer_id`/`seller_id` and `client_id`/`creator_id` fallbacks (marketplace legacy alias).
  - Frontend: `DisputesList`, `DisputeDetail`, and reusable `<OpenDisputeButton>` on Orders page for paid/delivered orders. Buyer-close + admin-resolve controls in place.

### Verification (iteration_22.json + iteration_23.json)
- Backend: **22/22 pytest** on disputes + media flows + video thumbnail submission + **26/26 iteration-21 regression** — all green.
- Frontend: **100%** — Chat z-index fix verified via computed styles + real click (no more force=True), Upload thumbnail hardening + graceful fallback verified end-to-end.
- Regression sweep: 15 pages checked (workspace/booking/booking/my-spaces/my-bookings/crm/invoices/pricing/billing/disputes/communities/teams/events/onboarding/feed/messages/upload) all clean, no console errors.
- Post-report fixes applied: (1) Chat form + pending-media wrapper z-[60] (was UNDER bottom-nav z-50), (2) extractThumbnail hardened (drop crossOrigin on blob URLs, preload/load/canplay fallback, 12s timeout, toast on failure).


## Iteration 21 — Phase 3: Booking Engine + WebSockets Realtime (2026-02)

### Delivered
- **Booking Engine (`booking_engine.py` REWRITTEN)** — Digital Twin for physical spaces:
  - Full CRUD: `POST/GET/PUT/DELETE /api/booking/spaces` + `GET /booking/my-spaces`.
  - Meta (categories + amenities): `GET /booking/meta`.
  - Availability: `GET /booking/spaces/{id}/availability?start=&end=` with overlap detection on `{status:{$in:[confirmed,pending]}}`.
  - Book flow: `POST /booking/spaces/{id}/book` → creates Stripe checkout session + pre-inserts pending record + logs payment_transaction; validates future-only, end>start, no self-booking, no overlap (double-checked right before Stripe call — race prevention).
  - Status poll: `GET /booking/status/{sid}` → flips pending→confirmed on paid, increments `bookings_count`, notifies owner.
  - QR entry pass: `GET /booking/bookings/{id}/qr` (PNG, only for confirmed).
  - Attendance scan: `POST /booking/bookings/{id}/scan` (owner-only).
  - Cancel: `POST /booking/bookings/{id}/cancel` (guest or owner; decrements bookings_count if was confirmed).
- **Realtime Engine (`realtime_engine.py` NEW)** — WebSocket manager:
  - `WS /api/ws?token=<jwt>` — JWT-authenticated, supports multiple concurrent connections per user_id.
  - `GET /api/realtime/status` → `{online_users}`.
  - `ConnectionManager` with asyncio.Lock, dead-socket cleanup, per-user send + broadcast.
  - `create_notification()` in `core/deps.py` now pushes to WS via `manager.send_to_user()` (best-effort, inline import to avoid circular).
- **Frontend Booking pages (NEW)**:
  - `/booking` — browse with category chips + search + owner enrichment.
  - `/booking/spaces/:id` — space detail + inline booking form + live availability check + total calc + Stripe redirect.
  - `/booking/my-spaces` — owner dashboard with create/edit/delete modal + booking count.
  - `/booking/my-bookings` — guest dashboard with status badges + QR download for confirmed bookings.
  - `/booking/success` — post-payment polling page.
  - Explore now has `link-booking` tile.
- **Frontend `RealtimeContext` (NEW)** — auto-connects on login, exponential backoff reconnect (max 30s), subscribe/send API, default toast on `notification` events, cleans up timers on logout.

### Verification (iteration_21.json)
- Backend: **26/26 pytest PASS** (booking CRUD + full booking flow + QR/cancel/scan + WebSocket connect+auth+ping+notification push) + **21/21 regression PASS** across iteration_19 (onboarding) + iteration_20 (recos).
- Frontend: **9/9 acceptance points PASS** — booking browse renders, my-spaces create + edit + delete, guest booking flow redirects to real `checkout.stripe.com` URL, WS connects in ~141ms and does ping/pong roundtrip in-browser, all regression pages green (workspace/crm/invoices/pricing/billing/communities/teams/events/explore).
- Post-report polish applied: (1) reconnect timer cleared on user logout (security), (2) `bookings_count` decrement on cancel (data integrity), (3) 2nd-pass overlap check right before Stripe call (race prevention), (4) dead-click empty-state route fix.


## Iteration 20 — Smart Personalized Recommendations (2026-02)

### Delivered
- **Backend `POST /api/workspace/recommendations`**: Claude Sonnet 4.5 generates 3 weekly personalized growth tips per user.
  - Inputs: `primary_goal` + `interests` + `experience_level` (from onboarding) + actual usage stats (clients/deals/invoices/content/tasks/communities/services counts).
  - Cache key: `{user_id, week=%Y-W%V}` in `db.workspace_recos`; `?force=true` bypasses.
  - Deterministic fallback with 6 branches based on goal + interests + stats gap.
  - Each reco: `{title, why, action_label, engine, priority: high|medium|low}` where engine ∈ {crm, content, tasks, marketplace, community, academy, social}.
- **New AI prompt** `recommendations` in `AI_PROMPTS` — Arabic, JSON-only, personalization-focused.
- **Frontend Workspace card** `recos-card`:
  - Renders below Morning Brief.
  - Skeleton loader (`recos-skeleton`) during cold AI call (~4-8s) so UI doesn't stay empty.
  - 3 reco items with engine icon + colored priority dot + action-label chip; click routes to correct engine.
  - Refresh button + sonner success/error toasts.

### Verification (iteration_20.json)
- Backend: **9/9 pytest PASS** (`test_iteration20_recommendations.py`) — auth, schema, cache miss/hit, force regenerate, personalization diff, fallback, regression.
- Frontend: **8/8 E2E acceptance points PASS** — card render, skeleton, priority dots, click-through per engine, refresh toast, no regression.
- Post-report polish applied: skeleton loading state + error toast on refresh failure + safer `services` collection guard.


## Iteration 19 — Onboarding Wizard (شاشة ترحيب أول-دخول 4-خطوات) (2026-02)

### Delivered
- **Backend `POST /api/auth/onboarding`**: accepts `{primary_goal, interests[], experience_level}`, updates user (adds `onboarding_completed=true`, `primary_goal`, `interests`, `experience_level`, `onboarded_at`), returns `{next_route}` per goal (crm→/crm, content→/content/kanban, tasks→/tasks/boards, all→/workspace). Validates goal in {crm, content, tasks, all}; 400 on invalid; 401/403 unauth.
- **Signup schema updated**: new users get `onboarding_completed:false`, `primary_goal:null`, `interests:[]` fields.
- **Frontend `/onboarding` (NEW)**: 4-step wizard with animated gradient progress bar.
  - Step 0: Welcome (logo + greeting with name + start button).
  - Step 1: Primary Goal (4 tiles: CRM/Content/Tasks/All).
  - Step 2: Secondary Interests (4 optional tiles: Social/Marketplace/Community/Academy).
  - Step 3: Experience Level (3 options: Beginner/Intermediate/Pro) + "onboarding-finish" CTA.
  - Skip button available at any step (routes to /workspace with default 'all' goal).
- **Auto-redirect after signup**: `Auth.jsx` now routes new users to `/onboarding`; legacy users (no `onboarding_completed` field) route to `/feed` as before.
- **Full-screen layout**: onboarding is outside the mobile `<Layout />` wrapper, no bottom nav, no back button (own step-back).
- **Validation**: primary_goal required (step 1), level required (step 3 finish button); interests optional.

### Verification (iteration_19.json)
- Backend: **12/12 pytest PASS** (`/app/backend/tests/test_iteration19_onboarding.py`).
- Frontend: **9/9 E2E acceptance points PASS** — 4-step flow, validation, skip, back nav, progress bar 25→50→75→100%, sonner toast, per-goal routing.
- Post-report polish applied: `finish()` now validates level client-side too (belt-and-suspenders).


## Iteration 17-18 — Rebrand Amora + UX Fixes (2026-02)

### Delivered
- **Rebrand Ru'ya → Amora / أمورا** across full codebase (Landing, Auth, Workspace, PDFs, morning-brief prompt, HTML title, favicon, backend server title, APP_NAME env).
- **New brand logo**: `/frontend/public/amora-logo.png` used in Landing header/footer + Auth page + favicon.
- **Universal BackButton** (`components/BackButton.jsx`) rendered fixed top-right on every non-root page via Layout; hidden on `/`, `/feed`, `/workspace`, `/explore`, `/upload`, `/auth`.
- **Avatar upload**:
  - Backend `POST /api/users/me/avatar` (multipart, max 5MB, jpg/png/webp) using `put_object` → stores under `amora/avatars/<user_id>/<uuid>.<ext>`.
  - `ProfileUpdate` schema now supports `avatar_url`.
  - Frontend EditProfile page: avatar-picker with live preview, camera icon overlay, sonner success toast.
- **Communities create + search**:
  - Backend `POST /api/communities` with Arabic slugify + auto-join owner + members_count enrichment.
  - Backend `GET /api/communities?q=` case-insensitive search across name/slug/description.
  - Frontend REWRITTEN Communities page with search input (300ms debounced), new-community-btn + modal (icon picker + name/desc), joined badge, member counts.
- **Removed "Made with Emergent" watermark** from `public/index.html`.
- **Bottom nav overlap fix**: Layout `<main>` now has `pb-24` universally. Modal z-[60] > bottom nav z-50.
- **Root-cause fix for Teams/Events "خلل"**: 7 pages used `useEffect(load, [])` which returns a Promise as cleanup → React crashed with "destroy is not a function". All 7 files patched to `useEffect(() => { load(); }, [...])` (Teams, Events, Incubator, TeamDetail, CommunityDetail, Marketplace, MarketplaceDetail, Feed).

### Verification
- **iteration_17.json**: Identified the useEffect Promise bug (root cause of Teams/Events crash) + z-index click-hijack on comm-save.
- **iteration_18.json**: All 4 follow-up fixes verified — Backend 8/8 pytest (regression baseline at `/app/backend/tests/test_iteration18_regression.py`), Frontend 100% E2E — no more crashes, no residual brand strings, community create works end-to-end, avatar uploads use amora/ path.

### Non-blocking notes (deferred)
- Avatar upload validates MIME by filename extension only; could add magic-bytes check for defense-in-depth.
- Z-index scale (nav 50 / back-btn 40 / modal 60) should be documented as a project scale.


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

