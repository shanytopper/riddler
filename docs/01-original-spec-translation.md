# Original Specification — English Translation

> Faithful translation of `אפיון_מוצר_משחקי_ניווט.docx` (v1.0, August 2026). Structure, claims, and tone are preserved as-is; nothing has been corrected or improved. See `02-original-spec-review.md` for the critique.
>
> **Terminology choices:** מזמין → *organizer* (the person who commissions and sets up the activity) · משחק ניווט → *navigation game* · חידה → *riddle* · משימה → *mission* · שאלות מנחות → *guiding questions* · גזרה → *sector* · מפעיל → *operator* · "דוקר" נקודות → *"pins" points* · קבוצה → *group* (used in the original for what the rework will call a *team*).

---

**Product Specification Document**
**Custom Navigation and Mission Game Platform**
*"Escape Room in Nature" — Anywhere in the World*
Version 1.0 · August 2026
Business-Technical Specification Document

*(Table of contents — auto-generated field in the original.)*

## 1. Executive Summary

The product is a platform for building location-based navigation and mission games, in which the organizer of the activity builds the game content themselves. Unlike existing navigation games, where the content is fixed and operated only by the company, here every organizer — a teacher, a team manager, or a family — can enter their own riddles and missions, place them on points on a map anywhere in the world, and run the game independently.

The central principle: a correct answer to a pre-entered riddle is what opens the passage to the next point. Thus the navigation game effectively becomes an "escape room in nature", with content customized to the audience — math riddles for a school group, internal company trivia for a company outing, or simple fun missions for a couple on a trip. Every mission requires a photo, which serves both as proof of completion and as raw material for a summary experience video for sharing.

Key differentiation: the organizer builds the game themselves via guiding questions, and can set up a route anywhere in the world — a public park in Bangkok or a national park in Vietnam — without depending on a local operations team.

Launch target: an international product from day one, built on a multi-layered control and permissions hierarchy that enables expansion to operators and franchisees in different countries while maintaining central control.

Build model: product development is carried out with the help of artificial intelligence (Claude), which writes the code itself — screens, logic, database, and permissions system. This dramatically lowers the traditional development cost (developer salaries), leaving mainly low service costs and a few developer hours for deployment and field testing. Full details in Chapter 8.

## 2. The Idea and What Makes It Unique

### 2.1 What problem the product solves

Navigation games currently on the market are a "pre-made" experience: the content is fixed, built by the operating company, and requires a guide team in the field. This limits flexibility (content cannot be tailored to a specific group), availability (dependent on staff and on defined sites), and geographic scalability.

### 2.2 The solution

A self-service platform in which the organizer is the one who builds the game:

- **Custom content** — the organizer enters their own riddles and missions via a bank of guiding questions.
- **"Escape room" mechanism** — a correct answer opens the next point; there is a help button that reduces the score.
- **Photo missions** — every station requires a photo, which at the end becomes a summary experience video for sharing.
- **Geographic independence** — a route can be set up anywhere in the world, including new sites that the organizer "pins" themselves on GPS.

### 2.3 Three use cases

**School group:** math, logic, and numerical-thinking riddles that open the passage between points — an activity that is both educational and experiential.

**Company outing:** internal company trivia (who the founder is, the origin of the company name, the core values) alongside group photo missions.

**Couple or family on a trip:** simple fun missions ("take a photo with 10 pinecones", "selfie next to a bench") for a light trip experience.

## 3. Target Audiences

| Audience | Who the organizer is | Content type |
|---|---|---|
| Education | Teachers, guides, schools | Educational riddles: math, logic, general knowledge |
| Organizations | Team managers, HR | Team-building: company trivia and team missions |
| Families and couples | Parents, private travelers | Light fun and photo missions |
| Tourism and leisure | Tourism operators, local franchisees | Routes at sites all over the world |

## 4. User Experience — Flows and Screens

Below are the main screens in the product, as specified and validated in an interactive prototype.

### 4.1 A group joining a game

In the field, the organizer gives the groups a game code (or QR code). Players download the app, enter the code, choose a group name, and enter a waiting room that shows all the groups that have joined — until the organizer starts the game.

- Input: QR scan or entry of a 6-character code.
- Choosing a group name (with quick suggestions).
- Waiting room with a list of the connected groups.

### 4.2 Building a game (organizer screen)

Game building opens only after payment. The flow has four steps:

- **Step 1 — Payment:** a "Create game" screen with a price; access to building is locked until payment.
- **Step 2 — Game name:** the organizer gives a name that will be shown to players (e.g., "Intel — Development Team").
- **Step 3 — Guiding questions:** a bank of 10–30 guiding questions divided into categories. The organizer selects questions and enters answers — and the answers become riddles in the game. It is also possible to enter a free-form question of one's own.
- **Step 4 — Game ready:** a preview of all the riddles as they will be shown to players.

### 4.3 Location and timing planning

The organizer chooses where to play, in one of two ways:

- **An existing site from the repository** — the trail is documented; the organizer only assigns a riddle to each existing point.
- **Create a new location** — the organizer walks the site with the app and "pins" GPS points at every interesting place (suitable for anywhere in the world).

In addition, the route shape is set — circular (returning to the starting point) or linear (different start and end) — and the system calculates in real time the total distance and the estimated game duration, based on the number of stations, the distance between points, and the time to solve a riddle and take a photo at each station. The system recommends an ideal distance (about 200–400 m between points) to maintain group cohesion without losing interest or tiring people out.

### 4.4 The game in the field (player screen)

- A map with the points; the next point is locked until a correct answer.
- At each station a riddle is shown; only a correct answer opens the continuation of the route.
- Help/hint button — always available, but reduces the score.
- A photo mission at each station — proof of completion and raw material for the video.
- Progress meter and live score; at the end — a summary experience video for sharing.

### 4.5 Live control room (organizer's field screen)

During the game the organizer sees a live map with the location of all groups and their progress, alongside a continuously updating leaderboard. If a group gets stuck, it can call the organizer — who sees exactly where it is and at which station. The organizer has control tools: start, stop, and reset a station.

### 4.6 Results page

At the end, a ranking of all the groups in the same game by score is shown. The score is calculated from correct answers (20 points per riddle) minus hints used, so that independence and speed also count. The winning group is crowned, and the ranking can be sorted by score or by time.

## 5. Control and Permissions Hierarchy

One of the critical components of the architecture is a multi-layered control structure, in which each tier sees and controls everything beneath it. Permissions are delegated from the top down. This structure is what enables international expansion to operators and franchisees while maintaining central control.

| Tier | Scope of visibility | Main permissions |
|---|---|---|
| Game operator (in the field) | Their own game and the groups in it | Join code, live tracking, assisting a group, start/stop |
| Sector manager (e.g., Bangkok) | All games in the sector, concurrently | Intervening in any game, assigning operators, field backup |
| National center (e.g., Thailand) | All sectors in the country | Managing sectors, approving content and pricing, national reports |
| Supreme control center (Israel) | All countries in real time | Global remote control, permissions management, meta-data (orders, downloads, usage) |

Technical implication: this structure requires a role-based access control (RBAC) system and a multi-tenant architecture that are built into the foundation of the system from day one — they are very hard to add retroactively.

## 6. Technical Architecture

The system is built in four layers:

### 6.1 Client layer

- Player app and operator app — React Native or Flutter recommended (one codebase for iOS and Android; fast and economical development).
- Web dashboards for the upper control tiers (sector, national, supreme) — React recommended.

### 6.2 Server and real-time layer

- API server and business logic (game, riddle, and scoring management) — Node.js/NestJS.
- Real-time tracking of group locations — WebSocket.
- Permissions and hierarchy mechanism — RBAC and multi-tenancy.

### 6.3 Data layer

- PostgreSQL database with a tenant and hierarchy structure.
- Cloud media storage (photos and videos) — e.g., S3.
- A summary-video generation engine that assembles a clip from the photos.

### 6.4 External services

- Maps and GPS — Mapbox, with offline support (critical for parks and sites without reception).
- International multi-currency payment processing — Stripe.
- Push notifications — Firebase.
- Multilingual support — an i18n mechanism for every language.

### 6.5 Two critical requirements for international operation

**Offline operation:** parks, forests, and national parks abroad are usually without reception. The app must download the map, points, and riddles in advance, and sync photos and score when reception returns.

**Hierarchy and permissions:** built into the foundation of the system from day one, to support the four control tiers and cross-country expansion.

## 7. Milestones and MVP

It is recommended to build the architecture as multi-tenant from day one (so that the hierarchy works), but to launch content gradually. Proposed phases:

- **Phase A (MVP):** player and operator app, game building, location planning, live control, results page. Launch in one sector/country, on an international technical foundation.
- **Phase B:** summary video engine, expanded site repository, upper control tiers (sector and national).
- **Phase C:** global supreme control center, franchisee dashboard, meta-analytics, expansion to additional countries.

## 8. Costs

The code itself — all screens, logic, database, permissions system, and service integrations — is written with the help of artificial intelligence (Claude). Therefore the main expense in software development, developer salaries, is almost nonexistent in this project. What remains is low service costs and a few developer hours for deployment and field testing.

### 8.1 One-time cost to reach a working MVP

| Item | Estimated cost |
|---|---|
| Writing the code (with AI) | Included — no developer salaries |
| Setting up service accounts (Supabase, Mapbox, Stripe) | Mostly free to start |
| Domain | ~₪50 per year |
| Developer hours for deployment and field testing | Just a few hours (one-time) |
| Security hardening before launch | Developer support recommended |
| **Total to reach a working MVP** | **Hundreds to thousands of ILS (not hundreds of thousands)** |

What still requires a human: final deployment to production, testing GPS accuracy and offline operation in the real field, and ongoing operations and maintenance over time. For all of these, a developer's support for a number of hours is recommended.

### 8.2 Monthly operating costs (early stage, up to ~25K users)

| Service | Estimated monthly cost |
|---|---|
| Cloud (servers + database) | ₪700–3,000 |
| Maps (Mapbox, up to 25K active users) | ~Free to start |
| Media storage + traffic (photos/videos) | ₪200–1,500 |
| Compute for video generation | ₪300–1,500 |
| Push notifications (Firebase) | ~Free |
| Payment processing (Stripe) | ~2.9% + per-transaction fee |
| App store accounts | $99/year Apple · $25 one-time Google |
| **Total early operations** | **~₪1,500–7,000 per month** |

Note on maps: Mapbox has a free tier of 25,000 monthly active users for mobile maps, and Google's basic map display in the mobile SDK is free — so at an early stage the cost of maps is negligible.

## 9. Business Model and Revenue

The product is based on a "pay per game created" model: an organizer pays for building and running a game. The hierarchy structure also enables an international franchise model, in which local operators purchase operating rights in a sector or country, and the center in Israel collects royalties and maintains central control. Possible revenue channels:

- One-time payment per game built (B2C and individual organizers).
- Subscription for organizations and educational institutions (unlimited games).
- Franchising to operators in sectors and countries, plus royalties.
- Selling ready-made content and site packs as an add-on.

## 10. Summary and Next Steps

This document defines a product with clear differentiation (self-built content and operation anywhere in the world), a user experience validated in an interactive prototype, a control structure that supports international expansion, and a realistic technical architecture. Recommended next steps:

- Finalizing the exact MVP scope and choosing the first launch sector.
- Obtaining 2–3 price quotes from software houses based on this document.
- Building a full high-fidelity design prototype before development.
- Market validation with potential organizers (schools, team-building managers, tourism operators).
