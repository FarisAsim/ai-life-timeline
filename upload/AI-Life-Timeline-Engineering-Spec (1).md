# AI Life Timeline — Engineering Build Specification

This is the companion document to the PRD. The PRD says *what* and *why*. This says *exactly how* — schema, contracts, algorithms, folder structure — detailed enough that an AI coding agent (or a human) can build each phase with minimal open questions.

**Stack:** React Native (Expo) + TypeScript · NestJS + TypeScript · PostgreSQL + pgvector · Prisma ORM · Redis + BullMQ · S3-compatible object storage · self-hosted open-source speech recognition (Python + faster-whisper) · i18next for English/Egyptian Arabic localization.

---

## 1. Monorepo Structure

```
ai-life-timeline/
├── apps/
│   ├── mobile/                 # React Native (Expo) app
│   ├── backend/                 # NestJS API
│   └── asr-service/             # Python FastAPI microservice — open-source speech recognition
├── packages/
│   └── shared-types/             # TypeScript types shared between mobile & backend
├── package.json                  # workspace root (npm/pnpm workspaces or turborepo)
└── turbo.json
```

Sharing types between frontend and backend (via `packages/shared-types`) is what makes "no placeholder logic" and "clean, modular, scalable" actually hold up in practice — the mobile app's API client and the backend's DTOs are typed from the same source, so a schema change breaks the build instead of failing silently at runtime.

**Why a separate `asr-service` instead of doing speech recognition inside the NestJS backend:** the open-source models that actually handle Egyptian Arabic well (Section 13) run through Python's ML ecosystem (PyTorch/CTranslate2), not Node. The backend calls this service internally over HTTP — it's still one system, just the right language for each job. This also means the ASR model can be swapped, upgraded, or GPU-accelerated independently of the rest of the API.

---

## 2. Database Schema (PostgreSQL)

Enable extensions first:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- for overlap-prevention constraint
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector, for semantic search
```

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en','ar-EG')),  -- UI language; ar-EG = Egyptian Arabic
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system default
  name TEXT NOT NULL,          -- English name; for system categories, canonical key
  name_ar TEXT,                 -- Egyptian Arabic name; only meaningful for is_system=true (user-created categories stay in whatever language the user typed)
  color TEXT NOT NULL,
  icon TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location_text TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  notes TEXT,
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence_score BETWEEN 0 AND 1),
  source TEXT NOT NULL CHECK (source IN ('user_manual','ai_guess','ai_confirmed','integration')),
  detected_language TEXT,  -- 'en' | 'ar' | 'mixed' — set by the ASR/NLP pipeline when created via voice; informational, never force-translated
  embedding VECTOR(1536),  -- populated async after create/update
  edit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  -- prevents two events for the same user from overlapping in time
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE INDEX idx_events_user_time ON timeline_events (user_id, start_time, end_time);
CREATE INDEX idx_events_embedding ON timeline_events USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo','voice_note','file')),
  storage_key TEXT NOT NULL,   -- S3 object key
  transcript TEXT,              -- populated for voice_note after STT
  transcript_language TEXT,     -- 'en' | 'ar' | 'mixed', reported by the ASR service (Section 13)
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unknown_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','unknown_confirmed')),
  resolution_source TEXT CHECK (resolution_source IN ('voice','text','ai_guess')),
  resolved_event_id UUID REFERENCES timeline_events(id),
  prompt_count INT NOT NULL DEFAULT 0,   -- how many times we've asked; used to back off
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_unknown_blocks_user_status ON unknown_blocks (user_id, status, start_time);

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE habit_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  time_bucket_start TIME NOT NULL,   -- e.g. 30-min buckets
  time_bucket_end TIME NOT NULL,
  category_id UUID REFERENCES categories(id),
  location_text TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  sample_count INT NOT NULL DEFAULT 1,
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_week, time_bucket_start, category_id)
);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '08:00',
  frequency TEXT NOT NULL DEFAULT 'normal' CHECK (frequency IN ('low','normal','high')),
  push_enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'gap_prompt' | 'pre_event' | 'state_change' | 'weekly_summary' ...
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','read','actioned')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_scheduled ON notifications (scheduled_for) WHERE status = 'pending';

CREATE TABLE completion_scores (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  score NUMERIC(4,3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green','yellow','red')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('day','week','month')),
  period_start DATE NOT NULL,
  data JSONB NOT NULL,   -- {category_minutes: {...}, most_productive_hours: [...], ...}
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_start)
);
```

**Scale note:** `timeline_events` and `attachments` are the tables that will actually hit millions of rows. Partition `timeline_events` by `RANGE (start_time)` (monthly) once volume justifies it — the schema above is partition-ready since every query already filters on `user_id` + a time range, which is exactly the partition-pruning pattern you want. Don't add partitioning on day one; add it when a single user's row count starts affecting query plans (get an EXPLAIN ANALYZE baseline first).

---

## 3. Backend Structure (NestJS)

```
apps/backend/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/jwt-auth.guard.ts
│   ├── interceptors/logging.interceptor.ts
│   └── decorators/current-user.decorator.ts
├── prisma/
│   ├── schema.prisma
│   └── prisma.service.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   └── dto/{register.dto.ts, login.dto.ts}
│   ├── users/
│   ├── categories/
│   ├── timeline/
│   │   ├── timeline.module.ts
│   │   ├── timeline.controller.ts
│   │   ├── timeline.service.ts        # business logic — the piece the UI never touches directly
│   │   ├── overlap-validator.service.ts
│   │   └── dto/{create-event.dto.ts, update-event.dto.ts, query-events.dto.ts}
│   ├── attachments/
│   │   ├── attachments.controller.ts
│   │   └── storage.service.ts          # S3 wrapper, signed URL generation
│   ├── unknown-blocks/
│   │   ├── unknown-blocks.controller.ts
│   │   ├── unknown-blocks.service.ts
│   │   └── gap-detection.service.ts     # core algorithm, Section 6.1
│   ├── calendar/
│   │   ├── calendar.controller.ts
│   │   └── completion-score.service.ts  # Section 6.2
│   ├── ai-companion/
│   │   ├── companion.controller.ts
│   │   ├── companion.service.ts
│   │   ├── prompts/system-prompt.ts
│   │   └── tools/
│   │       ├── move-event.tool.ts
│   │       ├── create-reminder.tool.ts
│   │       ├── query-timeline.tool.ts
│   │       └── resolve-gap.tool.ts
│   ├── voice/
│   │   ├── voice.controller.ts
│   │   ├── asr-client.service.ts        # calls apps/asr-service internally, Section 13
│   │   └── narration-segmenter.service.ts # splits a long narration transcript into events, Section 6.6
│   ├── search/
│   │   ├── search.controller.ts
│   │   └── embedding.service.ts
│   ├── habit-model/
│   │   └── habit-model.service.ts        # Section 6.4
│   ├── notifications/
│   │   ├── notifications.controller.ts
│   │   ├── notification-engine.service.ts # decision rules, Section 9
│   │   └── templates/                     # each template has en.ts + ar-EG.ts, Section 14
│   ├── i18n/
│   │   └── locale.service.ts              # resolves a user's locale for system-generated copy (notifications, Companion)
│   └── analytics/
│       ├── analytics.controller.ts
│       └── snapshot-aggregator.service.ts
└── jobs/                                  # BullMQ processors
    ├── gap-detection.processor.ts
    ├── notification-dispatch.processor.ts
    ├── embedding.processor.ts
    └── snapshot-aggregation.processor.ts
```

**Why this mapping matters:** each `modules/<feature>` folder is self-contained — controller (HTTP layer) → service (business logic, testable without HTTP) → DTOs (validated shapes). This is the literal implementation of "separate business logic from UI" and "feature-based architecture" from your original brief, not just a folder-naming convention.

---

## 4. Mobile App Structure (React Native / Expo)

```
apps/mobile/src/
├── App.tsx
├── navigation/
│   ├── RootNavigator.tsx
│   └── TabNavigator.tsx        # Timeline | Calendar | Insights | Companion
├── features/
│   ├── timeline/
│   │   ├── screens/{TimelineScreen.tsx, EventDetailScreen.tsx}
│   │   ├── components/{EventCard.tsx, EventForm.tsx}
│   │   ├── services/timelineApi.ts   # calls backend, typed via shared-types
│   │   └── hooks/useTimelineEvents.ts # wraps React Query
│   ├── unknown-blocks/
│   │   ├── components/{GapPromptModal.tsx, AIGuessCard.tsx}
│   │   └── services/unknownBlocksApi.ts
│   ├── calendar/
│   │   ├── screens/CalendarScreen.tsx
│   │   └── components/CompletionScoreBadge.tsx
│   ├── ai-companion/
│   │   ├── screens/CompanionChatScreen.tsx
│   │   └── services/companionApi.ts
│   ├── voice-assistant/
│   │   ├── components/{QuickCaptureButton.tsx, NarrationRecorder.tsx}  # PRD 5.9's two entry modes
│   │   └── services/voiceRecorder.ts
│   ├── insights/
│   │   └── screens/InsightsScreen.tsx
│   ├── search/
│   │   └── screens/SearchScreen.tsx
│   └── auth/
├── shared/
│   ├── components/            # reused across features — this is the "never redesign, reuse" layer
│   ├── services/
│   │   ├── apiClient.ts        # axios/fetch wrapper, auth token injection
│   │   └── secureStorage.ts    # expo-secure-store for tokens
│   ├── state/                  # Zustand stores (auth, user prefs)
│   ├── theme/
│   └── locales/                 # Section 14
│       ├── en.json
│       └── ar-EG.json
├── i18n.ts                      # i18next + react-i18next setup, language detection
```

**State management:** Zustand for small global state (auth session, user prefs) + **TanStack Query (React Query)** for all server data (events, blocks, insights) — Query gives you caching, refetch-on-focus, and optimistic updates for free, which matters a lot for a timeline UI where the user is constantly confirming/editing.

---

## 5. API Contract

All endpoints under `/api/v1`, JWT bearer auth except `/auth/*`.

**Auth**
```
POST /auth/register        { email, password, display_name } → { user, access_token, refresh_token }
POST /auth/login           { email, password } → { access_token, refresh_token }
POST /auth/refresh         { refresh_token } → { access_token }
POST /auth/logout
```

**Timeline**
```
GET    /timeline/events?start=&end=&category_id=&cursor=&limit=
POST   /timeline/events              { title, description?, start_time, end_time, category_id, location?, notes?, source }
GET    /timeline/events/:id
PATCH  /timeline/events/:id
DELETE /timeline/events/:id
POST   /timeline/events/:id/attachments   (multipart)
POST   /timeline/events/merge             { event_ids: [] }
```

**Unknown Blocks**
```
GET  /unknown-blocks?status=open
POST /unknown-blocks/:id/resolve   { source: 'text'|'voice'|'ai_guess', text?, audio_upload_id?, accept_guess?: boolean }
POST /unknown-blocks/:id/confirm-unknown
```

**Calendar**
```
GET /calendar/month?year=&month=   → { days: [{ date, score, status }] }
GET /calendar/day?date=            → { events: [], unknown_blocks: [] }
```

**AI Companion**
```
POST /ai/companion/message   { conversation_id?, message } → { conversation_id, reply, actions_taken: [] }
GET  /ai/companion/conversations
GET  /ai/companion/conversations/:id/messages
```

**Voice**
```
POST /voice/transcribe   (multipart audio) → { transcript, detected_language: 'en'|'ar'|'mixed' }
POST /voice/intent       { transcript } → { intent, entities, action_result }        # quick capture, PRD 5.9 mode 1
POST /voice/narrate      { transcript } → { drafted_events: [...] }                    # narration, PRD 5.9 mode 2 — segments a free-form transcript into multiple event drafts for the user to confirm
```
`/voice/transcribe` proxies internally to `apps/asr-service` (Section 13); `/voice/intent` and `/voice/narrate` never receive raw audio — they operate on the transcript, which keeps the intent-parsing logic identical whether the text came from voice or was typed.

**Search**
```
GET /search?q=&category_id=&start=&end=&limit=   → { results: [{ event, relevance_score }] }
```

**Analytics**
```
GET /analytics/insights?period=week|month&date=
GET /analytics/completion-score?start=&end=
```

**Notifications**
```
GET   /notifications?status=
PATCH /notifications/:id/read
PUT   /notifications/preferences   { quiet_hours_start, quiet_hours_end, frequency, push_enabled }
```

---

## 6. Core Algorithms

### 6.1 Gap Detection

Runs (a) on a recurring schedule per active user, and (b) triggered synchronously on any event create/update/delete for the affected time range.

```
function detectGaps(userId, rangeStart, rangeEnd):
  events = fetchEvents(userId, rangeStart, rangeEnd) sorted by start_time
  cursor = rangeStart
  gaps = []

  for event in events:
    if event.start_time - cursor >= MIN_GAP_MINUTES:
      gaps.append({ start: cursor, end: event.start_time })
    cursor = max(cursor, event.end_time)

  if rangeEnd - cursor >= MIN_GAP_MINUTES:
    gaps.append({ start: cursor, end: rangeEnd })

  for gap in gaps:
    upsertUnknownBlock(userId, gap)   # idempotent: matches on overlapping existing open blocks
```

`MIN_GAP_MINUTES` defaults to 15, stored as a per-user setting (open question from the PRD — resolve by making it configurable from day one rather than hardcoding, since it's cheap to do now and expensive to retrofit).

### 6.2 Completion Score

```
coveredMinutes = Σ (event.duration, clipped to day bounds) for all events overlapping the day
confidenceWeightedMinutes = Σ (event.duration × event.confidence_score, clipped to day bounds)
elapsedMinutes = min(now, endOfDay) − startOfDay   # only count time that has actually passed for "today"

score = confidenceWeightedMinutes / elapsedMinutes

status = 'green'  if score >= 0.90
       = 'yellow' if score >= 0.60
       = 'red'    otherwise
```

Recomputed and upserted into `completion_scores` whenever an event or unknown block changes for that day — not on every read.

### 6.3 Confidence Score

```
sourceWeight = { user_manual: 1.00, ai_confirmed: 0.95, integration: 0.85, ai_guess: 0.50 }

confidence = sourceWeight[event.source]
           × habitMatchMultiplier(event)     // 1.0 if it matches a high-confidence habit pattern, lower if novel
           × recencyDecay(event.updated_at)   // very old, never-revisited ai_guess events decay slightly
           − (0.05 × event.edit_count capped at 0.2)  // frequent correction signals lower reliability

confidence = clamp(confidence, 0, 1)
```

### 6.4 Habit Model Update (the learning loop)

This is the piece that makes "AI becomes smarter over time" concrete rather than aspirational — every confirmation must flow through here.

```
function onEventConfirmedOrEdited(event):
  bucket = timeBucket(event.start_time)          # e.g. 30-min buckets
  pattern = findOrCreate(HabitPattern, {
    user_id: event.user_id,
    day_of_week: dayOfWeek(event.start_time),
    time_bucket_start: bucket,
    category_id: event.category_id
  })
  pattern.sample_count += 1
  pattern.confidence = movingAverage(pattern.confidence, weight=1/pattern.sample_count, newSignal=1.0)
  pattern.last_confirmed_at = now()
  save(pattern)

function onAIGuessRejected(guess):
  pattern = find(HabitPattern, matching guess's day/time/category)
  if pattern:
    pattern.confidence = movingAverage(pattern.confidence, weight=0.3, newSignal=0.0)  # penalize, don't zero out
    save(pattern)
```

### 6.5 AI Guess Generation

```
function generateGuess(unknownBlock):
  candidates = queryHabitPatterns(userId, dayOfWeek(block), timeRangeOverlap(block))
  best = candidates sorted by (confidence × recency) descending, first()

  if best and best.confidence >= GUESS_THRESHOLD:   # default 0.65
    return draftEvent(category=best.category, title=inferTitle(best), confidence_score=best.confidence, source='ai_guess')
  else:
    return null   # below threshold: ask directly, don't guess wrong just to fill the gap
```

### 6.6 Narration Segmentation (long voice notes → multiple events)

Backs the `/voice/narrate` endpoint and PRD 5.9's narration mode — the primary way a user resolves a multi-hour Unknown Block in one breath.

```
function segmentNarration(transcript, unknownBlock):
  # 1. Send the transcript to the AI Companion's model with a structured-output prompt:
  #    "Given this narration and the time window [start, end], split it into
  #     discrete events with estimated start/end times, titles, and categories.
  #     Respond only in the JSON schema: [{ title, category, start_time, end_time }]"
  #    The prompt is language-agnostic — works the same whether the transcript
  #    is English, Egyptian Arabic, or code-switched.
  draftEvents = callLLM(structuredSegmentationPrompt(transcript, unknownBlock))

  # 2. Validate: drafted events must fall within the block's time range and not overlap each other
  draftEvents = clampAndDeoverlap(draftEvents, unknownBlock)

  # 3. Each draft gets source='ai_guess', confidence_score based on how much of the
  #    block duration is actually accounted for (full coverage = higher confidence)
  return draftEvents  # shown to the user as an editable list before saving
```

This deliberately reuses the AI Companion's model rather than a separate NLP pipeline — segmentation is a language-understanding task, and maintaining two separate "understand what the user meant" systems (one for narration, one for chat) is exactly the kind of duplication Section 7's grounding rule exists to avoid.

---

## 7. AI Companion Design

**Grounding rule (non-negotiable):** every Companion response about the user's timeline must be backed by an actual `query_timeline` tool call — never answered from the model's general reasoning about what "probably" happened. This is what keeps "What did I do last Friday?" honest.

**Tool schema (function-calling), representative example:**

```json
{
  "name": "move_event",
  "description": "Reschedules an existing timeline event to a new start/end time.",
  "input_schema": {
    "type": "object",
    "properties": {
      "event_id": { "type": "string" },
      "new_start_time": { "type": "string", "format": "date-time" },
      "new_end_time": { "type": "string", "format": "date-time" }
    },
    "required": ["event_id", "new_start_time", "new_end_time"]
  }
}
```

Define equivalent schemas for `create_event`, `create_reminder`, `query_timeline` (params: date range, category, free-text query — routes to Search), and `resolve_unknown_block`. Every tool implementation calls the **same service** the REST API and mobile UI call (`TimelineService`, `UnknownBlocksService`, etc.) — there must be exactly one code path per action, not a chat-specific shadow implementation.

**System prompt — key constraints to encode, not full text:**
- Only reference events/data returned by tool calls in this conversation; never fabricate a timeline entry.
- Confirm before any destructive or ambiguous action (deleting an event, moving something when multiple matches exist).
- Match the conversational, non-robotic tone used in Smart Notifications (Section 9) — same voice, two surfaces.
- When the user references something ambiguous ("move my meeting" with two meetings that day), ask which one rather than guessing.
- Reply in whichever language (or mix) the user just used — this needs no special detection logic beyond what the underlying LLM already does with the transcript/message it's given; just instruct it explicitly not to default to English when the user wrote or spoke Egyptian Arabic, and not to switch to formal Modern Standard Arabic when the user used colloquial Egyptian phrasing.

**Conversation memory:** `ai_conversations` + `ai_messages` tables persist full history. On each new message, load recent messages (e.g. last 20) plus a summarized long-term memory derived from `habit_patterns` and prior confirmed facts, rather than replaying the entire history every time — keeps latency and token cost bounded as conversations grow.

---

## 8. Semantic Search Design

1. **Indexing:** on every event create/update, an async job (`embedding.processor.ts`) concatenates `title + description + notes + attachment transcripts`, generates an embedding, and writes it to `timeline_events.embedding`.
2. **Query:** the search query is embedded the same way, then combined:
   ```sql
   SELECT *, 1 - (embedding <=> :query_embedding) AS relevance
   FROM timeline_events
   WHERE user_id = :user_id
     AND (:category_id IS NULL OR category_id = :category_id)
     AND (:start IS NULL OR start_time >= :start)
   ORDER BY embedding <=> :query_embedding
   LIMIT 20;
   ```
3. Re-rank the top results by a blend of `relevance` and `confidence_score` — a low-confidence AI guess shouldn't outrank a high-confidence manual entry that's semantically slightly less similar.

Named entities like "Ahmed" work through this because the embedding captures the description text, not because of separate NER — cheaper to build, good enough for personal-scale data.

---

## 9. Notification Engine

Decision table (extend, don't hardcode as if-else sprawl — model as rules the engine evaluates):

| Trigger | Condition | Template family | Channel |
|---|---|---|---|
| Pre-event | scheduled event starts in 60 min | "Your {title} starts in one hour. Are you still going?" | push |
| State change | inferred "work" category event just ended, next habitual block is unscheduled | "Looks like you finished work. Should I start Study Mode?" | push |
| Gap detected | new open UnknownBlock created | "I noticed a gap between {start} and {end}. Help me complete your timeline." | push, throttled |
| Re-prompt backoff | UnknownBlock still open after N hours | escalate once, then stop (respect `prompt_count`, Section 2 schema) | push |
| Weekly summary | Sunday evening, if insights exist | "Here's how your week went." | push |

All copy lives in `notifications/templates/`, separate from `notification-engine.service.ts` — the engine decides *whether/when*, templates decide *what it says*. Delivery is scheduled via BullMQ delayed jobs (`notification-dispatch.processor.ts`) reading from the `notifications` table, respecting `notification_preferences` (quiet hours, frequency) at dispatch time, not at creation time — preferences can change between when a notification is queued and when it would fire.

Every template exists in both `en` and `ar-EG` (colloquial Egyptian phrasing, written by a native speaker or reviewed by one — machine-translating notification copy tends to read stiff and undermines the conversational tone that's the whole point of this feature). `notification-dispatch.processor.ts` picks the template using the recipient's `users.locale`, not the language of the event that triggered it.

---

## 10. Auth & Security

- **Access token:** JWT, 15-minute expiry.
- **Refresh token:** rotating, stored hashed (bcrypt) in DB, revoked on logout/reuse-detection.
- **Attachments:** stored in S3-compatible storage with server-side encryption; API returns short-lived signed URLs, never public URLs.
- **Data export:** `GET /users/me/export` → async job compiling all tables scoped to `user_id` into a downloadable archive.
- **Account deletion:** `DELETE /users/me` → cascades via FK `ON DELETE CASCADE` already defined in the schema, plus a job to purge S3 objects referenced by that user's attachments.
- **Per-user isolation:** every query in every service is scoped by `user_id` from the authenticated JWT — never trust a client-supplied `user_id`.

---

## 11. DevOps

- **Backend hosting:** Railway, Fly.io, or Render — any support long-running Node processes + managed Postgres.
- **Database:** Neon or Supabase (both support the `pgvector` extension) or self-managed Postgres if you want full control.
- **Redis:** Upstash (serverless-friendly) for BullMQ.
- **Object storage:** Cloudflare R2 (S3-compatible, no egress fees) or AWS S3.
- **ASR service:** self-hosted, so it needs its own deployment target — see Section 13 for sizing (CPU is workable for the small model, GPU recommended for large-v3). A single small VPS or GPU instance (Fly.io GPU, RunPod, or a dedicated box) running the FastAPI container is enough at personal scale; this is not something to put on a shared serverless platform given the model load time.
- **Mobile builds:** Expo + EAS Build for iOS/Android binaries; EAS Update for OTA JS updates without app-store review cycles.
- **CI:** GitHub Actions — lint + typecheck + unit tests on every PR; a separate workflow for EAS builds on release tags.

Environment variables to define from day one: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `S3_*` (endpoint/bucket/keys), `AI_PROVIDER_API_KEY`, `ASR_SERVICE_URL` (internal, points at `apps/asr-service`), `EMBEDDING_API_KEY`. There is deliberately no `SPEECH_TO_TEXT_API_KEY` — transcription has no third-party dependency.

---

## 12. Testing Strategy

- **Unit tests (Jest):** gap detection, completion score, confidence score, and habit-model update logic — these are pure-ish functions and are the highest-value tests in the whole app, since they're the mission-critical math.
- **Integration tests:** each controller's endpoints against a test database (Prisma + a disposable test schema).
- **Mobile E2E (Maestro or Detox):** the core loop — create event → gap detected → resolve via text → completion score updates — is the one flow worth automating end-to-end first.
- **ASR evaluation:** maintain a small held-out set of real Egyptian Arabic, English, and code-switched voice samples (recorded, not synthetic) with known-correct transcripts, and track Word Error Rate on it whenever the model or checkpoint changes (Section 13). This is the only reliable way to know a model swap didn't regress the exact dialect this app depends on.
- **i18n coverage:** a lint rule or test that fails the build if a screen references a hardcoded string instead of a translation key — cheap to add early (Phase 0), painful to retrofit once screens exist.

---

## 13. Speech Recognition Service (Open-Source, Self-Hosted)

**Requirement recap:** transcription must handle Egyptian Arabic, English, and mid-sentence code-switching between the two, running entirely on open-source models the team controls — no OpenAI/Google/Azure speech API in the core path.

**Model choice — practical default:** [`IbrahimAmin/code-switched-egyptian-arabic-whisper-small`](https://huggingface.co/IbrahimAmin/code-switched-egyptian-arabic-whisper-small), a Whisper Small fine-tune trained specifically on code-switched Egyptian Arabic–English audio (including the `ar_eg` subset of Google's FLEURS dataset). This is the right starting point for three reasons: it's tuned for exactly this app's real-world input pattern (not generic MSA), Whisper Small is light enough to self-host cheaply on CPU, and it inherits Whisper's strong baseline English performance rather than trading it away.

**Higher-accuracy option (more compute):** [`AbdelrahmanHassan/whisper-large-v3-egyptian-arabic`](https://huggingface.co/AbdelrahmanHassan/whisper-large-v3-egyptian-arabic), a LoRA fine-tune of Whisper large-v3 for the Egyptian dialect. LoRA (as opposed to a full fine-tune) generally preserves more of the base model's original multilingual/English strength, at the cost of needing a GPU for acceptable latency. Worth switching to once usage justifies the infra cost.

**Worth evaluating, flagged as unverified:** GitHub topic listings currently point to a project called `QwenCleo-ASR` — a fine-tune of Alibaba's [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) (itself a genuinely open-source, actively maintained multilingual ASR model supporting Arabic and English with built-in language ID and streaming) — claiming state-of-the-art results specifically for Egyptian Arabic and code-switching. I could only confirm this from topic-page metadata, not a full repo read, so treat it as a lead to evaluate directly (check the actual repo, license, and benchmark claims yourself) rather than a settled recommendation. If it holds up, Qwen3-ASR's streaming support would be a meaningful upgrade for the "quick capture" mode (Section 6.6's counterpart) where low latency matters more than for narration.

**License note:** Whisper itself (OpenAI) is MIT-licensed. The community fine-tuned checkpoints above are separate model weights hosted on Hugging Face — check each specific model card before shipping, since community uploads don't always state licensing as clearly as the base model does.

**Inference engine:** [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper) (CTranslate2-based) rather than raw Hugging Face `transformers` — several times faster and lighter on memory, and the Whisper Small checkpoint runs at acceptable latency on CPU, so a GPU isn't required to ship the practical-default option.

**Service contract** (`apps/asr-service`, internal only — never exposed to the public internet, only reachable from `apps/backend`):
```
POST /transcribe
  body: audio file (webm/m4a/wav)
  → { transcript: string, detected_language: 'en' | 'ar' | 'mixed', duration_seconds: number }
```

**"mixed" detection:** don't trust a single language tag from the model for the whole clip — Whisper reports one dominant language per run, which understates how often Egyptian speech actually code-switches mid-sentence. Instead, post-process the transcript with a simple script-ratio heuristic (proportion of Arabic-script vs. Latin-script characters/words) to decide `en` / `ar` / `mixed`. Cheap, deterministic, and good enough — this doesn't need its own ML model.

**Resilience:** the mobile app must never block the core "add data" flow if `asr-service` is down or slow — text input is always available as a fallback, and a failed transcription should surface as "couldn't transcribe, type it instead" rather than a dead end. Given how central voice entry is to the product's whole premise (Section 5.9 of the PRD), this fallback path needs its own test coverage, not just a try/catch.

---

## 14. Localization & RTL (English + Egyptian Arabic)

**Framework:** `i18next` + `react-i18next` + `expo-localization` (detects device language on first launch, defaults to it, user can override in settings — written to `users.locale`).

**File structure:** flat key-value JSON per locale, as shown in Section 4's mobile folder tree:
```
shared/locales/en.json      { "timeline.addEvent": "Add Event", ... }
shared/locales/ar-EG.json   { "timeline.addEvent": "ضيف حدث", ... }
```
`ar-EG` (Arabic, Egypt) is the correct locale tag to use — it's what device settings, app stores, and i18n libraries expect — but the actual copy inside it should be written in **colloquial Egyptian Arabic**, not Modern Standard Arabic. Have a native Egyptian speaker write or review every string; machine-translated MSA reads stiff and undercuts the whole "conversational" premise of Smart Notifications and the Companion.

**RTL:** Arabic is right-to-left. React Native's `I18nManager.forceRTL()` / `allowRTL()` flips layout direction, but the change only takes full effect after an app reload — so switching language in settings should prompt "restart to apply" rather than trying to live-flip every screen. This is new UI *behavior*, not a redesign — it doesn't conflict with "never redesign the UI" (Section 3, PRD) since it's the existing screens mirroring, not new screens.

**Typography:** confirm the existing design system's font actually renders Arabic glyphs well — if not, add a font *fallback* for the `ar-EG` locale (e.g. Cairo or IBM Plex Sans Arabic, both open-source and popular for Egyptian-market apps) rather than changing the type system wholesale. Additive, not a redesign.

**Dates/times:** use a locale-aware formatting library (`Intl.DateTimeFormat` with `ar-EG`, or `date-fns` with its `ar` locale) for anything shown to the user — day names, relative times ("2 hours ago"), month names — rather than hardcoding English formatting and only translating labels around it.

**Backend-generated copy:** notification templates (Section 9) and system category names (`categories.name_ar`, Section 2) are the two other places system-generated text reaches the user — both need the same "written for Egyptian Arabic, not translated MSA" treatment as the UI strings.

---

## 15. Build Roadmap — Concrete Deliverables per Phase

Mirrors the PRD's Section 12 phasing, now mapped to actual modules/files so each phase has an unambiguous "done" checklist.

| Phase | Backend modules | Mobile features | Exit criteria |
|---|---|---|---|
| 0 | `auth`, `users`, `categories`, `timeline` (CRUD only), Prisma schema for all tables, `i18n/locale.service` | `auth`, `timeline` (list/create/edit), `i18n.ts` + `en.json`/`ar-EG.json` wired into every screen, RTL toggle | Can register, log in, create/edit/delete an event, no overlaps allowed; entire flow works in both languages with correct RTL layout |
| 1 | `unknown-blocks`, `gap-detection.service` + scheduled job; `apps/asr-service` stood up with the Whisper Small code-switching checkpoint (Section 13); `voice/asr-client.service`, `voice/narration-segmenter.service` | `unknown-blocks` (gap prompt modal, text/voice resolve), `voice-assistant` narration recorder | Gaps ≥15min reliably produce UnknownBlocks; resolving one via text **or** voice (English, Egyptian Arabic, or mixed) creates matching event(s); ASR service down → app falls back to text without breaking the flow |
| 2 | `calendar`, `completion-score.service` | `calendar` (month/day view, score badges) | Score matches Section 6.2 formula exactly; recomputes on relevant writes |
| 3 | `notifications`, `notification-engine.service`, BullMQ dispatch job, bilingual templates | push notification handling | All 5 trigger types in Section 9 fire correctly, in the recipient's `locale`, in a staging scenario |
| 4 | `ai-companion`, tool implementations | `ai-companion` chat screen | Companion answers are grounded (verified via tool-call logs, not hallucinated); replies match whichever language/mix the user used |
| 5 | `voice` quick-capture intent parsing (reuses `asr-client.service` from Phase 1) | `voice-assistant` quick capture | All 5 example voice commands from the PRD resolve to real actions, in either language |
| 6 | `search`, `embedding.service`, embedding job | `search` screen | The 3 example queries from the PRD return correct results on seeded data |
| 7 | `habit-model` wired into confirm/reject flows everywhere | — | AI Guess acceptance rate is measurable and trending up on test data |
| 8 | `analytics`, `snapshot-aggregator` job | `insights` screen | All named metrics compute correctly and show completeness caveats when data is partial |

Each phase should be merged and verified against its exit criteria before the next phase's branch starts — this is the literal implementation of the brief's "plan → build → verify → next feature" instruction.
