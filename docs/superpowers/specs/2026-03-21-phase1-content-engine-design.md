# Phase 1: Content Engine + Study Experience Overhaul

**Date**: 2026-03-21
**Status**: Approved
**Goal**: Transform EXAM-MASTER from an "empty shell" MVP into a content-rich, algorithm-driven study platform.

---

## Problem Statement

Users open the app and face an empty question bank. All content depends on manual upload or AI generation. In the competitive postgrad exam prep market, this is a critical gap -- competitors offer hundreds of thousands of real exam questions out of the box.

## Solution: 4 Modules

### Module 1: Anki .apkg Import Engine

**Value**: Unlock the entire Anki postgrad exam ecosystem (tens of thousands of existing flashcard decks) with zero content creation cost.

**Technical Design**:

```
.apkg (ZIP file)
  ├── collection.anki2 (SQLite DB)
  │   ├── notes table → question content
  │   ├── cards table → card states, scheduling
  │   └── revlog table → review history → FSRS migration
  └── media (JSON map) → referenced images/audio
```

**Backend**: New cloud function `anki-import.ts`

- Dependencies: `jszip` (decompress), `sql.js` (SQLite in WASM)
- Parse notes.flds (fields separated by `\x1f`) → map to Question model
- Create question_bank entry + bulk insert questions
- Optional: migrate revlog → FSRS scheduling parameters

**Frontend**: Extend existing `import-data.vue`

- Add `.apkg` to accepted file types
- Show import progress (deck name, card count, preview)
- Post-import: navigate to the new question bank

**Data Mapping**:

| Anki Field         | Our Model Field          | Notes                                           |
| ------------------ | ------------------------ | ----------------------------------------------- |
| `note.flds[0]`     | `question.content`       | Front of card = question stem                   |
| `note.flds[1]`     | `question.answer`        | Back of card = answer/explanation               |
| `note.tags`        | `question.tags[]`        | Space-separated → array                         |
| `model.name`       | `question_bank.name`     | Note type name as bank name                     |
| `deck.name`        | `question_bank.category` | Deck hierarchy                                  |
| `card.ivl`         | FSRS `stability` seed    | Days interval → stability init                  |
| `card.factor/2500` | FSRS `difficulty` seed   | Ease factor → difficulty [0,1]                  |
| `revlog` rows      | FSRS review history      | Rating mapping: 1→Again, 2→Hard, 3→Good, 4→Easy |

### Module 2: FSRS-5 Deep Scheduling Optimization

**Current State**: `ts-fsrs` v5.3.1 is installed but scheduling results don't drive the core UX (home page, practice ordering).

**Changes**:

1. **Upgrade FSRS parameters**: Apply latest FSRS-5 default weights from `open-spaced-repetition/fsrs4anki` research
2. **Smart Review mode**: New practice mode that orders questions by retrievability (lowest first = most urgent to review)
3. **Home page integration**: Review banner shows exact count of due cards + estimated review time
4. **Post-answer FSRS update**: Each answer immediately updates the card's FSRS state and persists to storage/cloud
5. **Personal parameter optimization**: After 100+ reviews, fit personalized FSRS weights from user's own review history

### Module 3: Remove Off-Course Features

Remove navigation entries (not code) for features that dilute the core product:

| Feature                                    | Action                 | Reason                                |
| ------------------------------------------ | ---------------------- | ------------------------------------- |
| ID Photo (`tools/id-photo`)                | Remove from pages.json | Zero relevance to exam prep           |
| Doc Convert (`tools/doc-convert`)          | Remove from pages.json | Commodity tool, widely available free |
| Knowledge Bubbles (`KnowledgeBubbleField`) | Remove from home page  | Visual noise, no learning value       |
| Daily Quote (`DailyQuoteCard`)             | Remove from home page  | Replace with learning data            |

### Module 4: Activate Unreachable Pages

| Page                            | Action                                                          |
| ------------------------------- | --------------------------------------------------------------- |
| `pages/onboarding/index`        | Register in pages.json, set as launch page for first-time users |
| `pages/ai-classroom/*`          | Register in pages.json, add navigation entry                    |
| `practice-sub/smart-review`     | Ensure home review banner links here                            |
| `practice-sub/diagnosis-report` | Ensure post-quiz flow navigates here                            |

---

## Implementation Order

1. Anki import backend (cloud function)
2. Anki import frontend (UI integration)
3. FSRS-5 scheduling upgrade
4. pages.json cleanup (remove/add entries)
5. Build verification

## Dependencies

- `jszip`: ^3.10.1 (decompress .apkg)
- `sql.js`: ^1.11.0 (parse SQLite in cloud function)
- `ts-fsrs`: upgrade to latest if not already

## Success Criteria

- User can import an Anki .apkg file and immediately start practicing
- FSRS scheduling drives the "Smart Review" practice mode
- Home page shows personalized review urgency instead of generic cards
- Build compiles without errors on mp-weixin platform
