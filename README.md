# WordJar

WordJar is a mobile-first, local-first flashcard web app for language learners. It is inspired by Anki, but designed to make adding vocabulary faster, cleaner, and easier for self-learners.

The app currently focuses on vocabulary collection, deck-based review, study flow, Reader support, and Mushy AI assistance while keeping the core learning data usable offline through browser storage.

---

## Current Status

WordJar is in prototype / early development.

The project is currently a static web app built with:

- HTML
- CSS
- Vanilla JavaScript
- Browser `localStorage`
- Optional Firebase Auth + Firestore for manual cloud backup
- Optional Gemini API integration for Mushy AI features

The app started as a mostly single-file web app, but it is now being gradually refactored into a cleaner modular structure. The current approach is incremental: keep existing features working while moving business logic, AI logic, Reader tools, and UI styling into clearer files.

---

## Core Features

- Deck management
- Dictionary / vocabulary list
- Flashcard review
- SM-2-style spaced repetition logic
- Study Mode
- Text-to-speech
- Voice accent / speed settings
- CSV import/export
- JSON backup/import
- Optional Google sign-in with Firebase Auth
- Manual cloud backup sync with Firestore
- Reader tools and Reader notes
- Mushy AI chat / tutor page
- Mushy Reader/deck context support
- Share card / share word tools
- Mobile-first UI with responsive desktop support

---

## Firebase Setup (Optional)

WordJar supports optional cloud backup and AI features through Firebase. To enable these features:

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Authentication with Google sign-in
3. Enable Firestore database
4. Copy `firebase-config-template.js` to `firebase-config.js`
5. Fill in your Firebase config values in `firebase-config.js`

**Security Note:** Never commit `firebase-config.js` to version control. It contains sensitive API keys.

The app works fully offline without Firebase configuration.

---

## Current Architecture

```text
WordJar-/
├─ index.html
├─ css/
│  ├─ style.css
│  ├─ base.css
│  ├─ components.css
│  ├─ layout.css
│  ├─ pages.css
│  ├─ deck-cards.css
│  ├─ flashcard.css
│  ├─ modals.css
│  ├─ share.css
│  └─ wordjar-*.css
│
├─ js/
│  ├─ app.js
│  ├─ wordjar-business-logic.js
│  ├─ wordjar-mushy-router.js
│  ├─ wordjar-mushy-chat.js
│  ├─ firebase-sync.js
│  └─ reader / UI patch modules
│
├─ assets/
│  ├─ brand/
│  └─ avatars/
│
└─ docs/
   ├─ CODE_DOCUMENTATION.md
   └─ BUSINESS_LOGIC_REFACTORING.md
```

### Important files

| File | Purpose |
|---|---|
| `index.html` | Main app shell, page containers, modals, and script/style loading. |
| `css/style.css` | Main CSS entry file that imports the CSS layers in order. |
| `js/app.js` | Legacy core app file containing state, rendering, and many UI handlers. |
| `js/wordjar-business-logic.js` | Pure business/data helpers for words, decks, study progress, flashcard scheduling, and data normalization. Includes JSDoc comments. |
| `js/wordjar-mushy-router.js` | Mushy AI router, Gemini model selection, prompt creation, AI error handling, and custom system dialogs. |
| `js/wordjar-mushy-chat.js` | ChatGPT-style Mushy chat page, chat history, Reader/deck context bridge, and chat UI helpers. |
| `docs/CODE_DOCUMENTATION.md` | Full code documentation and architecture notes. |
| `docs/BUSINESS_LOGIC_REFACTORING.md` | Guide for separating business logic from UI logic. |

---

## Local-First Data Model

WordJar currently uses a local-first data model.

- Local browser data is the primary working copy.
- Main app data is stored in `localStorage` under `wordjar_v4`.
- Export JSON creates a full offline backup of WordJar data.
- Import JSON restores a backup and replaces the current local data.
- Save to Cloud uploads the current device data to Firebase.
- Load from Cloud downloads the cloud backup and replaces the current local data.
- Sync is manual for now to avoid accidental overwrites.

Cloud-first automatic sync is a future option, but it should only be considered after conflict handling, account UX, privacy, and cost are reviewed.

---

## Main Data Shape

The main app state is stored as one WordJar data object.

```json
{
  "words": [],
  "decks": [],
  "profile": {},
  "todayDone": 0,
  "lastDate": "",
  "studyDays": {}
}
```

A typical word/card record looks like this:

```json
{
  "id": "w1710000000000",
  "word": "example",
  "meaning": "ตัวอย่าง",
  "type": "N",
  "deckId": "d1",
  "lang": "en",
  "pronunciation": "/ɪɡˈzɑːmpəl/",
  "example": "This is an example sentence.",
  "notes": "Usage notes here",
  "starred": false,
  "addedDate": "2026-04-28",
  "interval": 1,
  "reps": 0,
  "ef": 2.5,
  "nextReview": null
}
```

Recommended future vocabulary database fields:

```json
{
  "word": "example",
  "meaning_th": "ตัวอย่าง",
  "part_of_speech": "noun",
  "level": "A1",
  "ipa": "/ɪɡˈzɑːmpəl/",
  "definition_en": "something that shows what a thing is like",
  "synonym_en": ["sample", "instance"],
  "example_en": "This is an example.",
  "example_th": "นี่คือตัวอย่าง",
  "tags": ["basic", "academic"],
  "source": "custom",
  "license": "user-provided"
}
```

---

## Business Logic Refactoring

WordJar now includes a separated business logic layer:

```text
js/wordjar-business-logic.js
```

This file contains pure/data-focused functions such as:

- `validateWordInput()`
- `findDuplicateWords()`
- `buildWordData()`
- `createWordRecord()`
- `deleteWordsByIds()`
- `moveWordsToDeck()`
- `applySm2Review()`
- `mutateSm2Review()`
- `isWordDue()`
- `getFlashcardQueue()`
- `getFlashcardStats()`
- `buildLearnList()`
- `calculateStreak()`
- `normalizeWordJarData()`

The file also includes a bridge that keeps old `app.js` global function names working while gradually moving business rules out of UI-heavy code.

Target direction:

```text
Business logic = data rules, scheduling, validation, normalization
UI logic       = DOM updates, rendering, toast, modal, navigation
```

---

## Mushy AI

Mushy is WordJar's AI vocabulary tutor.

Current Mushy responsibilities:

- ChatGPT-style chat page
- Vocabulary explanation
- Reader context explanation
- Deck/word context support
- Fast vs smart model routing
- Gemini API request handling
- Friendly Thai-first learner explanations

Mushy AI files:

```text
js/wordjar-mushy-router.js
js/wordjar-mushy-chat.js
```

API key policy:

- Do not hardcode private API keys in source code.
- User-provided AI keys should be handled through app settings / local browser storage.
- The app should remain useful even when AI is unavailable.

---

## Reader Direction

Reader features are being developed as an app-level reading and note-taking layer.

Current Reader-related direction:

- Keep Reader notes compatible with saved note formatting.
- Support text-to-speech playback.
- Support Reader-specific voice settings.
- Allow selected Reader content to be sent to Mushy as context.
- Avoid overlap bugs between Reader UI, notes, popups, and bottom controls.

---

## Profile and Pixel Character Direction

WordJar is planned to have a stronger profile system using original pixel characters.

Profile goals:

- Display signed-in account status clearly.
- Let users choose a pixel character avatar.
- Keep avatar choices separate from vocabulary data.
- Prepare the design for future unlockable or optional character packs.

---

## Development Rules

Do not remove existing features unless the task explicitly says so.

Every meaningful change should explain:

1. What changed
2. Why it changed
3. What could break
4. How to test it

Project coding rules:

- Keep files simple and readable.
- Prefer small scoped fixes over large rewrites.
- Keep it DRY: do not repeat the same logic in many places.
- Use meaningful names.
- Keep functions focused on one responsibility.
- New CSS classes should use the `wordjar-` prefix.
- Prefer scoped CSS over global overrides.
- Avoid `!important`.
- Do not hardcode private API keys.
- Always check `z-index` and `pointer-events` before changing overlays, modals, popups, floating bars, or chat UI.
- After mutating persistent data, call `save()` and re-render affected UI.

---

## Manual Testing Checklist

After changes, test these flows:

- Open Home / Dashboard
- Open Decks
- Add deck
- Edit deck
- Open deck overview
- Open deck cards
- Select multiple cards
- Move selected cards
- Delete selected cards
- Add word
- Edit word
- Add duplicate word in same deck
- Add duplicate word in another deck
- Delete word
- Search/filter Dictionary
- Start Quick flashcards
- Start deck flashcards
- Rate Again / Hard / Good / Easy
- Check next review date
- Start Study Mode
- Test TTS Listen button
- Import CSV
- Export CSV
- Export JSON backup
- Import JSON backup
- Save to Cloud
- Load from Cloud
- Open Reader
- Open Mushy Chat
- Send Reader/deck context to Mushy
- Test on mobile viewport
- Test on desktop viewport

---

## Documentation

Read these docs before making larger changes:

```text
docs/CODE_DOCUMENTATION.md
docs/BUSINESS_LOGIC_REFACTORING.md
```

---

## Project Owner

Sum is the founder and product owner of WordJar. Sum defines the learning experience, product direction, visual identity, and feature priorities.

---

## Team Roles

- Product Owner: Sum
- AI Project Manager: ChatGPT
- Frontend Developer: AI / future teammate
- Learning Logic Developer: AI / future teammate
- UX Tester: Sum / future tester
- Language Content Specialist: Sum / future helper

---

## Current Goal

Make WordJar safer, easier to edit, and clearer for users.

Current engineering focus:

- Continue separating business logic from UI logic.
- Reduce risk in `js/app.js` by moving reusable rules into smaller files.
- Keep the app local-first and data-safe.
- Improve Reader stability.
- Improve Mushy UX without making the app depend entirely on AI.
- Keep mobile-first UI clean while supporting desktop layouts.
