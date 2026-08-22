# Review of the Original Specification

A critical read of `01-original-spec-translation.md`. The purpose is to separate what is worth carrying into the new design from what must be discarded, and to surface every question the original left unanswered.

## Verdict

The core idea is real and worth building: an organizer authors a set of riddles, places them on a route, and teams walk the route with progress gated by correct answers, while the organizer watches a live leaderboard. Everything around that core — the franchise hierarchy, the cost model, the international-from-day-one framing, the tech stack, the "validated prototype" — is filler that either contradicts itself or describes a product nobody has defined yet. The document reads as a business pitch wearing a spec's clothes, and it is weak as both.

## 1. Internal contradictions

| Claim A | Claim B | Why it matters |
|---|---|---|
| The differentiator is self-service: "without depending on a local operations team" (§1, §2.1) | A four-tier operations hierarchy of field operators, sector managers, and national centers (§5) | If the game is self-service, there are no field operators to manage. The hierarchy exists for a franchise business, not for this product. |
| Offline is a "critical requirement": download everything, sync later (§6.5) | Live control room with real-time team positions, and "call the organizer" when stuck (§4.5) | Offline and live tracking cannot both be v1 requirements. One must be chosen. |
| All code is written by AI; developer cost is "almost nonexistent" (§1, §8) | Next step: "obtain 2–3 price quotes from software houses" (§10) | The document does not know who is building the product. |
| Stack: PostgreSQL, Node.js/NestJS, S3 (§6) | Cost table: Supabase (§8.1) | Two different architectures, neither justified by a requirement. |
| Score = 20 points per riddle minus hints, "so that independence and speed also count" (§4.6) | No time component in the formula | Speed is not scored. Sorting "by time" is mentioned but undefined (total time? finish order?). |
| "International product from day one" (§1) | All costs in ILS; control center "in Israel"; examples in Bangkok/Vietnam/Thailand with no rationale | No market has been chosen. |
| "Validated in an interactive prototype" (§4, §10) | No prototype is referenced, attached, or described beyond one-line screen summaries | The claim cannot be checked and should not appear in a spec. |

## 2. The core is undefined

These are not details; each one changes what gets built.

- **What "unlocks the next point" means.** Is the next location hidden until the riddle is solved (treasure hunt), or are all stations visible and merely locked in sequence (station walk)? Must a team be physically at the station (GPS-verified) to receive its riddle, or can they answer from anywhere? The original implies a map with visible points *and* gating, which is the weakest of the options: a quiz with walking between questions.
- **Whether riddles relate to the place.** The corporate-trivia example ("who is the founder") has nothing to do with location. If the content is unrelated to the place, nothing makes this a location-based game rather than a quiz app. The family example ("photo with 10 pinecones") *is* place-related but is not a riddle. The design needs to say which it is, or how both coexist.
- **The content model.** "The organizer selects guiding questions and enters answers — and the answers become riddles" is incoherent as written. The most charitable reading: the guiding question *is* the riddle text and the organizer supplies the expected answer. That works for "who founded the company" and fails completely for "math riddles for a school group," which is the first use case listed.
- **Answer format.** Free text, multiple choice, number? How are typos, case, Hebrew/English, and numeric formats handled? Free-text matching is the single biggest source of frustration in this category of product and is not mentioned.
- **Team model.** One shared device per team or one per player? Team size? Can someone join mid-game?
- **The stuck state.** A hint costs points; after the hint, a team that still cannot answer has no path except "call the organizer." There is no skip, no attempt limit, no escalating hints, no reveal-for-zero-points. Stuck teams are the normal case, not the edge case.
- **Photo "proof."** A mandatory photo at every station is described as proof of completion, but nobody reviews it and nothing verifies it. It is friction with no function unless the design gives it one.
- **Ordering and crowding.** If every team follows the same sequence from the same start, all teams arrive at station 1 together and queue. Staggered starts or per-team orderings are standard and absent.

## 3. Premature scale

Listed as "from day one" or as MVP scope: native apps on iOS and Android, web dashboards for three management tiers, multi-tenancy, RBAC, multi-currency payments, full i18n, offline maps, a real-time tracking backend, a video-rendering engine, push notifications, and a curated global site repository. The estimated one-time cost for this is "hundreds to thousands of ILS." Phase A (MVP) contains nearly the entire product; Phase B and C add only the franchise apparatus.

The hierarchy in §5 designs an international franchise empire before a single game has been played by a paying customer. It should not be in a product design document at all. If it ever matters, it is a business-plan topic, and the only technical groundwork it needs in v1 is an `organization` entity that owns games and can have more than one organizer.

## 4. Missing entirely

- **Competitive landscape.** Actionbound, Goosechase, Loquiz, Locatify, Scavify, Eventzee, Questo, CluedUpp, and Geocaching Adventure Lab are all self-service or semi-self-service location-game builders. The claimed differentiator — "existing games have fixed content built by the operating company" — is false. Real differentiation has to be found and stated.
- **Pricing.** Not a single price appears in a document whose §4.2 puts a paywall in front of the builder.
- **Goals and success metrics.** Nothing says what success looks like after 3 or 12 months.
- **Privacy, safety, and legal.** The first listed audience is schools. Continuous location tracking of minors, photos of minors uploaded to cloud storage and compiled into a shareable video, data retention, parental consent, GDPR/COPPA/Israeli Privacy Protection Law — none are mentioned. This is disqualifying for the education segment as written.
- **Field safety.** Roads, heat, getting lost, supervision ratios, emergency contact. A product that sends teams walking through unfamiliar terrain needs a paragraph on this.
- **Risks, assumptions, non-goals, glossary.**
- **Failure modes.** GPS drift, dead battery, lost device, late teams, ties, organizer's phone dying mid-game, team that never finishes.
- **Player onboarding friction.** Players "download the app." For a one-time event, an app-store install is the largest drop-off point in the funnel, and a browser-based player experience is not considered.
- **Who builds the "existing site repository."** It appears as a given.
- **The author must be physically present to pin points.** "Anywhere in the world" is true only for places the organizer can walk in advance. Remote pin placement on a map is not mentioned.

## 5. Markers of generated text

Noted so they are not reproduced: "from day one" (×4), "critical" (×3), technology names offered as recommendations without a requirement behind them, a cost table that is wishful rather than estimated, superlatives in place of decisions, a closing chapter that asserts the document did things it did not do ("validated," "realistic architecture").

## 6. What to keep

- The organizer-authored, location-gated riddle game with team play and a live leaderboard. This is the product.
- The "escape room in nature" framing as a hook (not as a mechanic description).
- The join flow: code or QR → team name → lobby → organizer starts.
- Route planning with a distance/time estimate and recommended spacing between stations.
- Hint-with-penalty.
- Circular vs. linear route shape.
- A live organizer view when the organizer is on site: team positions, progress, leaderboard, basic interventions.
- Staged delivery — but with a v1 that is genuinely small.
