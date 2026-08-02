# Product Requirements Document
## AI Life Timeline

| | |
|---|---|
| **Document status** | Draft v1.0 |
| **Owner** | Product / Engineering |
| **Last updated** | August 2, 2026 |
| **Audience** | Engineering, Design, QA, future contributors |

---

## 1. Vision & Mission

**Mission statement:** *"Never lose a moment."*

AI Life Timeline is **not a task manager**. A task manager tracks what you plan to do. This product tracks what actually *happened* — a continuous, AI-assisted, hour-by-hour record of a person's life, starting the moment they install the app.

The product's central belief: most life-logging tools fail because they require constant manual entry, so gaps form and users abandon them. This product treats gaps as the enemy. It actively detects unexplained time, asks about it, and gets smarter every time the user answers — so the timeline approaches 100% completeness over time instead of decaying.

**One-line pitch:** *An AI that notices when it doesn't know what you were doing, and asks — until your life is fully accounted for.*

---

## 2. Goals & Success Metrics

The **Timeline Completeness Score** is the single most important product metric. Every other feature exists to serve it — either by generating events, filling gaps, or making it effortless for the user to confirm what the AI guesses.

| Goal | Metric (KPI) | Target (post-MVP) |
|---|---|---|
| Complete timelines | % of each day's 24h accounted for | ≥ 90% of days ≥ 85% complete by week 4 of use |
| Low-friction logging | Avg. user effort per confirmed event | < 5 seconds (tap/voice, not typing) |
| Gap resolution speed | Median time from gap detected → resolved | < 2 hours |
| AI accuracy | % of AI Guess suggestions accepted without edit | ≥ 60% by month 2 (rises as habit model matures) |
| Retention | D30 retention | Product-defined target, tracked cohort-over-cohort |
| Insight value | % of users who view weekly/monthly insights | ≥ 50% weekly active |
| Trust/accuracy | User-reported "AI got it wrong" rate | Downward trend month-over-month |

**Non-goals (explicitly out of scope for this PRD):** this is not a calendar-invite scheduling tool, not a social/sharing platform, not a project-management tool for teams. Multi-user collaboration is out of scope unless stated otherwise later.

---

## 3. Guiding Principles (Constraints on Implementation)

These apply to every feature below and should be treated as acceptance criteria, not suggestions:

1. **Never redesign the existing UI.** New features slot into existing visual language and navigation.
2. **Never delete existing components.** Extend or wrap; don't remove.
3. **Reuse components** wherever a feature's needs overlap with something that already exists.
4. **TypeScript everywhere** — strict mode, no `any` escape hatches in new code.
5. **Separate business logic from UI.** Screens/components call services; they don't contain domain logic.
6. **Feature-based architecture** — code is organized by feature/domain folder, not by technical layer alone (e.g. `/features/timeline`, `/features/unknown-blocks`, `/features/ai-companion`, each with its own `components/`, `services/`, `hooks/`, `types/`).
7. **Reusable, testable services** — anything that talks to the database, AI provider, or notification system lives behind a service interface, so it can be mocked and swapped.
8. **No placeholder logic** where a real implementation is feasible — features ship functional, not stubbed with `TODO` and mock data, unless a genuine external dependency (e.g. a not-yet-available API key) blocks it, in which case that blocker is called out explicitly.
9. **Incremental delivery.** Each feature below is planned, built, verified, and only then is the next one started. This PRD's Section 12 (Roadmap) defines that order.

---

## 4. Primary User & Use Case

**Primary persona:** an individual who wants an effortless, always-on record of their day — student, knowledge worker, or anyone tracking productivity, habits, health, or simply wants a searchable memory of their life. They are not willing to manually log every activity; the product must do most of the work and only ask them to confirm or correct.

**Core loop:**
1. Events populate the timeline automatically where possible (integrations, patterns, prior confirmations) or are logged manually.
2. The system continuously scans for gaps.
3. When a gap exceeds a threshold, an **Unknown Block** is created and the user is asked what happened (voice, text, or AI Guess).
4. The user's answer both fills the timeline **and** trains the AI's model of their habits.
5. Calendar and Insights reflect the growing completeness and surface patterns back to the user.

---

## 5. Functional Requirements

### 5.1 Timeline (Core)

The timeline is the system of record. Every event is an entity with:

| Field | Notes |
|---|---|
| `title` | Short label |
| `description` | Free text |
| `start_time` / `end_time` | Drives duration and gap detection |
| `duration` | Derived, stored denormalized for query performance |
| `category` | FK to category taxonomy (work, study, exercise, sleep, prayer, social, screen time, etc.) |
| `location` | Optional geo/text |
| `notes` | Free text, separate from description |
| `photos[]` | Attachment references |
| `voice_notes[]` | Attachment references, with transcript |
| `attachments[]` | General files |
| `confidence_score` | 0–1, how sure the system is this event is accurate |
| `source` | `user_manual`, `ai_guess`, `ai_confirmed`, `integration` (e.g. calendar import) |
| `created_at` / `updated_at` | Audit fields |

Requirements:
- Full CRUD via API and UI.
- Every event is expandable to show all fields, attachments, and edit history.
- Events must support **overlap-free reconstruction**: editing one event's boundaries triggers validation/adjustment of adjacent events rather than silently creating a new gap or overlap.
- Full-text and semantic search across `title`, `description`, `notes`, and voice transcript (see Section 5.8).
- Bulk operations: multi-select, re-categorize, merge adjacent events.

**Acceptance criteria:** a user can create, view, edit, delete, and search any event; every event correctly contributes to that day's completeness calculation; edits recompute confidence/gaps in real time.

### 5.2 Unknown Time Detection

The engine that protects the mission statement.

- A background **Gap Detection Service** continuously scans each user's timeline for time ranges not covered by any event above a minimum-duration threshold (configurable, e.g. 15 minutes default).
- On detection, an **Unknown Block** entity is created: `start_time`, `end_time`, `status` (`open`, `resolved`, `ai_guessed_pending_confirmation`), linked to the surrounding events.
- The user is prompted: *"What happened during this time?"* via notification and inline on the Timeline/Calendar.
- Three resolution paths:
  1. **Voice answer** → transcribed → parsed into one or more events.
  2. **Text answer** → parsed into one or more events.
  3. **AI Guess** → the system proposes an event based on the habit model (Section 7) and the user confirms or edits.
- Unresolved blocks above a severity threshold (e.g. > 2 hours, or > N unresolved blocks in a day) escalate — they're what turns a day's Completion Score red (Section 5.5) and drive proactive notifications (Section 5.4).
- Unknown Blocks are never silently discarded; a block can be marked `unknown_confirmed` (user genuinely doesn't recall) as a distinct terminal state so the system stops re-prompting for it while still recording it as a known-unknown rather than pretending it's complete.

**Acceptance criteria:** no gap over the configured threshold exists on the timeline without a corresponding Unknown Block; every block is resolvable through all three paths; resolution updates the Completion Score immediately.

### 5.3 AI Companion

A conversational assistant scoped to the user's own timeline data.

Capabilities:
- Answer natural-language questions about timeline history ("What did I do last Friday afternoon?").
- Move/reschedule events on request.
- Create reminders.
- Proactively suggest timeline reconstruction when it notices unresolved Unknown Blocks or low-confidence stretches.
- Maintain conversation memory (Section 7) so context carries across sessions — it should recall prior corrections and preferences without the user re-explaining them.

Architecture note: the Companion is a thin conversational layer over the same services the UI uses (Timeline Service, Unknown Block Service, Reminder Service) — it does not have a separate, divergent data path. Every action it takes (move an event, create a reminder) goes through the same validated service calls a UI action would.

**Acceptance criteria:** companion answers are grounded in actual stored timeline data (no fabrication), actions taken via chat are reflected identically in the Timeline UI, and multi-turn context is preserved within and across sessions.

### 5.4 Smart Notifications

Notifications are written and triggered as conversation, not alerts.

Examples of tone/intent already specified:
- Pre-event nudge: *"Your meeting starts in one hour. Are you still going?"*
- State-change detection: *"Looks like you finished work. Should I start Study Mode?"*
- Gap prompt: *"I noticed a gap between 2 PM and 4 PM. Help me complete your timeline."*

Requirements:
- A **Notification Decision Engine** decides *what* to send and *when*, based on: upcoming scheduled events, detected Unknown Blocks, inferred state transitions (from habit model / integrations), and user-configured quiet hours.
- Every notification maps to a concrete action the user can take inline (confirm, reschedule, answer a gap prompt) — not just "open the app."
- Notification frequency/aggressiveness must be user-tunable to avoid fatigue; over-notifying works directly against retention.
- All conversational copy lives in one place (a copy/prompt-template service) so tone stays consistent and is easy to iterate on without touching business logic.

**Acceptance criteria:** notification triggers are testable independent of the copy; every notification type from the spec has a corresponding, working trigger condition.

### 5.5 Calendar

- Month/week/day views (reuse existing calendar component where present).
- Every day displays a **Timeline Completion Score**, computed from covered-time-with-confidence vs. total elapsed time:
  - 🟢 **Green** — complete (covered time ≥ threshold, e.g. ≥ 90%, with resolved/high-confidence events)
  - 🟡 **Yellow** — missing information (partial coverage or unresolved-but-not-severe gaps)
  - 🔴 **Red** — incomplete (significant open Unknown Blocks or low coverage)
- Score thresholds are configuration, not hardcoded, so they can be tuned post-launch.
- Tapping a day drills into that day's timeline with Unknown Blocks surfaced first.

**Acceptance criteria:** score updates in real time as events/blocks change; color thresholds are centrally configurable; past days remain queryable/recomputable (e.g. if categories change retroactively).

### 5.6 AI Insights

Analytics generated from timeline data:
- Most productive hours
- Time spent studying / working / exercising / sleeping / on screen / in prayer / "wasted" (per the category taxonomy)
- Monthly summaries
- Habit detection (recurring patterns by day-of-week, time-of-day)
- Behavior prediction (feeds back into AI Guess quality)

Requirements:
- Insights are computed by an **Analytics Service** that reads from the same normalized event data — no separate, drifting copy of timeline data.
- Aggregations should be precomputable/cacheable (see Section 9) since recomputing from millions of raw events on every view is not viable.
- Insights should degrade gracefully with low completeness — e.g. flag "based on 62% of this month's time" rather than presenting incomplete data as if it were whole.

**Acceptance criteria:** each named metric (productive hours, category time totals, monthly summary, habit detection, prediction) has a working computation path and a visible confidence/completeness caveat when relevant.

### 5.7 Voice Assistant

Natural-language voice interaction, e.g.:
- "I just arrived home." → creates/updates an event, potentially closes an Unknown Block.
- "Remind me tomorrow." → creates a reminder via the same Reminder Service the Companion uses.
- "Move my meeting." → disambiguates which meeting (asks if ambiguous), then updates the event.
- "Add gym." → creates an event, inferring duration/category from habit model if not stated.
- "What did I do last Friday?" → routes to the same query path as Companion chat.

Architecture note: voice input is a transport layer (speech-to-text) in front of the **same intent-parsing and service layer** used by the Companion — voice and chat should not be two separate implementations of "understand what the user wants."

**Acceptance criteria:** each example above resolves to a real service call, not a canned response; ambiguous input triggers a clarifying question rather than a wrong guess.

### 5.8 Search (Semantic)

- "When did I meet Ahmed?" / "Show every study session." / "When was the last gym visit?"
- Requires semantic (embedding-based) search over event text fields and voice transcripts, not just keyword matching — category and named-entity queries ("Ahmed", "gym") must work even when phrased differently than stored.
- Combine semantic ranking with structured filters (category, date range) for precision.

**Acceptance criteria:** the three example queries above return correct results against seeded test data; search performance stays acceptable as event count scales (see Section 9).

---

## 6. Data Model (High Level)

Core entities and relationships:

```
User 1---* TimelineEvent
User 1---* UnknownBlock
User 1---* Category (user-customizable, seeded with defaults)
User 1---1 HabitModel (AI memory of the user)
User 1---* AICompanionConversation 1---* Message
User 1---* Notification
User 1---* AnalyticsSnapshot (precomputed, time-bucketed)

TimelineEvent *---1 Category
TimelineEvent 1---* Attachment (photo | voice_note | file)
TimelineEvent 0..1---0..1 UnknownBlock (an event can resolve a block)

UnknownBlock: start_time, end_time, status, resolution_source, resolved_event_id (nullable)
```

Design notes:
- **Normalization:** Category, Attachment, and User are separate tables from TimelineEvent; TimelineEvent stores foreign keys, not duplicated data.
- **Time-range indexing:** TimelineEvent and UnknownBlock need composite indexes on `(user_id, start_time, end_time)` — this is the query pattern for gap detection, calendar rendering, and completeness scoring, and it must stay fast at scale.
- **Partitioning strategy** for scale: partition TimelineEvent (and its attachments) by `user_id` and/or time range (e.g. monthly partitions) so millions of records per user don't degrade single-day/week reads.
- **AnalyticsSnapshot** exists specifically so Insights (5.6) and the Completion Score (5.5) don't require full re-aggregation on every read — snapshots are recomputed incrementally as events change, not from scratch.
- **HabitModel** is a structured representation (not just raw conversation logs) of learned patterns: typical categories by time-of-day/day-of-week, typical locations, confirmed vs. rejected AI Guesses — this is what powers AI Guess quality and behavior prediction.

---

## 7. AI Requirements

The spec's requirement that "the AI should become smarter over time" and "build a memory model of the user" has two distinct implications that should be built as **separate services**, not one monolith:

1. **Conversational memory** (AICompanionConversation) — recall of what was discussed, for coherent multi-turn chat/voice interaction.
2. **Habit model** (HabitModel) — a structured, queryable model of the user's patterns, updated every time the user confirms, edits, or rejects an AI Guess or gap resolution. This is the actual engine behind:
   - AI Guess quality for Unknown Blocks
   - Behavior prediction in Insights
   - Smart Notification triggers ("looks like you finished work")

**Feedback loop (critical requirement):** every user confirmation/correction must write back into the HabitModel. This is what makes AI Guess acceptance rate (Section 2 KPI) improve over time instead of staying flat. Treat this as a first-class pipeline, not an afterthought: `user action → HabitModel update → next AI Guess uses updated model`.

**Confidence scoring:** the `confidence_score` on TimelineEvent should be systematically derived (e.g. from source type, HabitModel match strength, recency, user edit history) — not an arbitrary number — since it directly feeds the Completion Score and search ranking.

---

## 8. Backend & API Requirements

APIs required per the spec:

| Domain | Representative endpoints |
|---|---|
| Auth | register, login, token refresh, session management |
| Authorization | role/ownership checks — a user can only ever read/write their own timeline data |
| Timeline CRUD | create/read/update/delete events, bulk operations, attachment upload |
| Unknown Blocks | list open blocks, resolve (voice/text/ai_guess), mark unknown_confirmed |
| Calendar | day/week/month completeness data |
| Notifications | list, mark read, user preferences (quiet hours, frequency) |
| AI endpoints | companion chat, voice intent parsing, AI Guess generation |
| Search | semantic + filtered query |
| Analytics | insights by range, monthly summary, habit detection results |

Cross-cutting requirements:
- All endpoints authenticated and scoped to the requesting user.
- Attachment upload/storage separated from the main API (object storage + signed URLs), not inline blobs in the primary database.
- Rate limiting on AI endpoints given cost/latency of model calls.

---

## 9. Non-Functional Requirements

**Scalability**
- Must be designed for millions of TimelineEvent rows per active user base — time-range partitioning and composite indexing (Section 6) are required, not optional.
- Analytics and Completion Score must rely on precomputed/incremental aggregation (AnalyticsSnapshot), not full scans.
- Pagination and cursor-based queries for all list endpoints (timeline, search, notifications).

**Performance**
- Calendar month view and day-view load should be near-instant (cached completeness scores, not computed on request).
- Gap detection runs as a background/async process, not inline on every write, to keep write latency low.

**Privacy & Security** (worth flagging explicitly given the sensitivity of this data — location history, voice recordings, photos, and an hour-by-hour behavioral record is about as sensitive as personal data gets)
- Encryption at rest and in transit for all attachments, especially voice notes and photos.
- Per-user data isolation enforced at the query layer, not just the API layer.
- User-facing data export and full-account deletion (right to be forgotten) should be treated as a launch requirement, not a "later" item, given the data category.
- Granular privacy controls: ability to exclude categories (e.g. location, certain notes) from AI Companion context or from analytics.
- Clear consent flow for any always-on data collection (location, activity inference) — this is a trust-dependent product; a privacy misstep is more damaging here than in a typical app.

**Reliability**
- Unknown Block detection and notification delivery are core to the mission statement — these paths need monitoring/alerting on failure, since a silent failure here directly undermines "never lose a moment."

---

## 10. UX Requirements

- No new design system introduced; new screens/components inherit existing tokens, navigation patterns, and component library.
- Existing components are extended (props, variants) rather than forked, wherever a new feature's UI needs overlap with something that exists (e.g. Unknown Block resolution likely reuses the event-creation UI rather than inventing a new one).
- Every new interactive element (gap prompts, AI Guess confirmation, completion score) should be reachable within the existing navigation — no parallel/hidden surface only accessible via deep link.

---

## 11. Risks & Open Questions

| Risk | Notes |
|---|---|
| Notification fatigue | Conversational tone still means interruptions; needs tunable frequency and smart batching or engagement will drop. |
| AI Guess trust | Wrong guesses accepted uncorrected pollute the HabitModel and compound. Consider surfacing confidence and making low-confidence guesses harder to accidentally auto-accept. |
| Privacy perception | An app that asks "what happened during this gap" can feel surveillance-like if framing/control isn't right. Onboarding needs to set expectations and give real control. |
| Data volume cost | Millions of events, plus photos/voice/attachments, is a real storage and inference cost driver — needs a cost model before scaling notification/AI call volume. |
| "Unknown, and that's OK" states | Users will sometimes genuinely not remember. The product needs a graceful terminal state (Section 5.2) so the system doesn't nag forever — open question: how many re-prompts before backing off, and is that user-configurable? |

**Open questions for stakeholder input before build:**
1. What third-party integrations (device calendar, location services, screen-time APIs) are in scope for auto-populating events, vs. everything being manual/voice/AI-guessed?
2. What's the actual minimum-gap threshold for triggering an Unknown Block — is 15 minutes right, or should it be user-configurable from day one?
3. Is multi-device sync in scope for MVP?

---

## 12. Implementation Roadmap (Incremental)

Per the project's own principle — plan, build, verify, then move on — features are sequenced so each phase is independently shippable and the next phase builds on stable ground:

| Phase | Deliverable | Why this order |
|---|---|---|
| 0 | Data model, auth, base Timeline CRUD (5.1) | Everything else reads/writes this |
| 1 | Gap Detection Service + Unknown Blocks (5.2), text/voice resolution | Core mission-statement feature; needs only Phase 0 |
| 2 | Calendar + Completion Score (5.5) | Needs Phase 0+1 data to compute against |
| 3 | Notification Decision Engine + Smart Notifications (5.4) | Needs Unknown Blocks + Calendar signals to trigger on |
| 4 | AI Companion — chat, grounded Q&A, actions (5.3) | Needs a stable service layer (Phases 0–3) to call into |
| 5 | Voice Assistant (5.7) | Reuses Companion's intent layer — cheap once Phase 4 exists |
| 6 | Semantic Search (5.8) | Needs enough event volume/text to be worth indexing |
| 7 | HabitModel + AI Guess quality loop (Section 7) | Needs real confirmed/rejected data from Phases 1–6 to train against |
| 8 | AI Insights & Analytics (5.6) | Most valuable once HabitModel + volume exist to analyze |

Each phase should close with: a written plan (already implicit in this PRD's per-feature Acceptance Criteria), working production code with no placeholder logic, and verification against that phase's acceptance criteria before Phase N+1 begins.

---

## 13. Definition of Done (Product-Level)

The product is "production ready" per the original brief when:
- All 8 features in Section 5 meet their individual acceptance criteria.
- The Completion Score is computed consistently across Calendar, Insights, and any AI-facing summary (single source of truth, not three implementations).
- No feature ships with mocked/placeholder data where a real implementation was feasible.
- Privacy, export, and deletion flows (Section 9) are live, not deferred.
- The system is monitored such that a failure in gap detection or notification delivery — the two paths most tied to the mission statement — is visible to the team, not just to a frustrated user.
