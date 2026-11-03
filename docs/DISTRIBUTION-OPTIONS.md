# Distribution, access control and commercialisation: options and decisions

Status: discussion record of 2026-11-03 (owner and assistant). Nothing in this document is implemented. It is a base for later planning (a possible phase "Distribution"), for conversations with stakeholders and for the legal questions that come first. It is not legal or tax advice.

## 1. Two separate questions

1. **Who can read the source in the repository?** Easy: make the repository private. GitHub Pages from a private repository needs a paid GitHub plan, and the published site stays reachable by anyone with the link. Pages therefore protects nothing.
2. **Who can read the code that runs in the browser?** Everyone who may load the app receives the built JavaScript, including the scenario data, the checklists and the grading rules. A web app cannot hide this. Minification, no source maps and obfuscation only raise the effort.

Real protection has three levers:

- **Control who can load the app** (invitation, login).
- **Deliver the valuable content from a server after an entitlement check.** The architecture already has the seam (`EntitlementProvider`, `PackRepository`, "paid pack plaintext never goes into the public repo"). The app code without the packs is worth little.
- **Legal terms:** licence or NDA for stakeholders. For software this usually protects more than technology.

The offline app (Phase 8) stores the packs on the device, where a user can read them. There is no DRM. Usual measures: licence terms, a short validity of the entitlement with a periodic online check, watermarks.

## 2. Stages

| Stage | Audience | Suggested setup |
| --- | --- | --- |
| 0 now | the owner, internal | public repository and GitHub Pages (free, fine for now) |
| 1 demos | first stakeholders (about 5 to 30 people), the manufacturer is one of them | private repository, hosting with an access gate (below), no payment system |
| 2 pilot customers | individual pilots and aircraft owners | small backend: entitlements, pack delivery, payment by a Merchant of Record |
| 3 organisations | the manufacturer, flight schools | invoices instead of checkout, seats per organisation, SSO, learning-platform links, data-processing agreements |

### Stage 1 options

- **Cloudflare Pages with Cloudflare Access** (login by e-mail code, allowlist, free up to 50 users). Favourite for demos: almost no code change (the base path comes from `BASE_PATH`), the offline app keeps working. A pitfall: when the session expires, the service worker's install fetch is redirected to the login page; the worker rejects redirected answers, so it keeps the old cache instead of taking a broken one.
- **Netlify or Vercel with password protection:** simple, but a paid plan.
- **Firebase Hosting:** fast, with preview links, but the files are public. A login inside the app does not protect the files; protection needs the content to be delivered through a function or storage rules.

### Stage 2 building blocks

- **Sign-in:** Firebase Auth, Supabase Auth, Clerk, Auth0, Stytch or Kinde; magic link means no passwords.
- **Entitlements:** who may use which pack, per person (later per organisation).
- **Pack delivery:** after the check, from storage with time-limited links.
- **Data:** a database only when progress or instructor views are wanted.
- **Firebase** fits well (hosting, auth, Firestore, storage in one place; Functions need the Blaze plan; keep data in an EU region); the price is dependence on one vendor. **Supabase** (Postgres, row rules, EU region, open standard) or a build on Cloudflare (Workers, D1, R2) are the alternatives.

## 3. Payments and customer management with little stored data

Owner decision: store as little as possible about customers.

- **Merchant of Record (Paddle, Lemon Squeezy, FastSpring, Polar):** sells in its own name, handles payment, subscriptions, invoices, VAT and sales tax worldwide, refunds and a customer portal. The owner holds no card data and does not register for tax in each country. Fees are roughly 5 percent plus a few cents per payment (check the current figures).
- **Stripe directly (Stripe Billing, customer portal):** cheaper, but the owner is the seller: VAT, invoices and registrations are the owner's duty. Sensible later for company customers with invoices.
- **Licence keys instead of accounts (the most data-sparing):** the customer buys, receives a key by mail, enters it once in the app, a small function checks it and delivers the pack. Services: Keygen, or the licence-key feature of Lemon Squeezy. What is stored: a mail address and the licence status. Open points: several devices and passing keys on (a device limit).
- **Sign-in as a service** only if accounts are wanted; for later SSO with organisations: WorkOS or Auth0.
- **All-in-one products** (Outseta, Memberstack, Teachable) fit websites and courses better than a stand-alone app.
- **Progress of the user** can stay local in the browser; that keeps stored data minimal, but progress does not move between devices.

## 4. Decisions so far (owner, 2026-11-03)

- There are no talks with the manufacturer yet. The manufacturer is one of the first stakeholders to show the app to.
- Store as little as possible about customers.
- A paid variant or subscription is expected later.
- **Start with individual customers** (pilots, aircraft owners), because that is simpler, and use them to convince the manufacturer and flight schools. There are no flight schools with this type at present; a sister model would be the extension (see section 6).

## 5. Suggested order (not decided)

1. Make the repository private (the owner's decision and plan).
2. Cloudflare Pages with Access for stakeholder demos, an allowlist of mail addresses, no payment.
3. Split the product: a free starter pack (for example ENG OIL TEMP) against paid packs. The app shell may be public because without packs it has little value; the packs come after an entitlement check through the existing seam.
4. When there is an offer and a price: a Merchant of Record plus licence key or magic link; a small Cloudflare Worker checks the key and serves the pack.
5. Later: invoices, seats per organisation and SSO for flight schools and the manufacturer.
6. In parallel: talk to the manufacturer, with a polished demo and first real users.

## 6. The sister model

The engine is generic and the aircraft is data (`src/aircraft/da50rg`). A second type would be a new aircraft folder (panel, quantities, physics, CAS rules, scenarios) and its own pack entry. The G1000 parts (PFD, MFD, CAS column, the message catalog) can be largely reused; layout and behaviour are model-specific. Entitlements and prices would then be per aircraft type.

## 7. Open points to settle before any commercial step

- **Rights to the booklet content.** The checklists are reproduced verbatim from the manufacturer's booklet. That was a deliberate owner decision for the current stage. For a commercial product the copyright of the manufacturer or its training organisation matters; a licence or release from the manufacturer would solve it. Ask a lawyer.
- **Tax and company form:** where the business is registered and how it is taxed; a Merchant of Record removes most of the burden, but does not replace advice.
- **Liability:** keep the "training aid, not the AFM" notices; check them with a lawyer before selling.
- **GDPR:** minimal data, a data-processing agreement with each provider, EU region, a deletion routine.
- **Security with accounts:** no secrets in the client, narrow access rules, rate limits, App Check or equivalent, backups, logs.
- **Who is the first audience for demos** and how many people.
