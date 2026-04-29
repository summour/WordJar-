# WordJar Code Documentation

Last updated: 2026-04-28

This document explains how the current WordJar web app is structured, where the main logic lives, how data flows through the app, and how to safely add or edit features without breaking the UI.

---

## 1. Product overview

WordJar is a mobile-first, local-first flashcard web app for language learners. The app currently focuses on:

- Deck management
- Dictionary / vocabulary list
- Flashcard review
- Spaced repetition
- Study mode
- Text-to-speech
- CSV import/export
- JSON backup/restore
- Optional Firebase cloud backup sync
- Reader tools
- Mushy AI chat / tutor features

The current app is a static HTML, CSS, and JavaScript web app. It does not currently require a build step like React/Vite.

---

## 2. High-level architecture

```text
Browser
  |
  |-- index.html
  |     |-- main app markup
  |     |-- page containers
  |     |-- modals
  |     |-- external SDK scripts
  |
  |-- css/style.css
  |     |-- imports all CSS layers in order
  |
  |-- js/app.js
  |     |-- main state
  |     |-- deck / word / flashcard logic
  |     |-- localStorage save/load
  |     |-- import/export
  |     |-- TTS helpers
  |
  |-- js/wordjar-mushy-router.js
  |     |-- Gemini model router
  |     |-- Mushy prompt builder
  |     |-- AI error handling
  |     |-- app-level custom dialogs
  |
  |-- js/wordjar-mushy-chat.js
  |     |-- ChatGPT-style Mushy UI
  |     |-- chat history
  |     |-- Reader / deck context bridge
  |
  |-- other reader / UI patch modules
  |
  |-- assets/
        |-- brand images
        |-- avatar gifs
```

WordJar currently uses a global-function architecture. HTML elements call JavaScript functions through `onclick`, `oninput`, `onchange`, and similar attributes. This means load order matters.

---

## 3. Important files

### `README.md`

Purpose:

- Explains the product direction.
- Defines current status as prototype / early development.
- Documents the local-first data policy.
- Lists the main app features and development rule.

Keep this file product-focused. Use it for contributors and project direction, not deep implementation notes.

---

### `index.html`

Purpose:

- Main app entry file.
- Contains the app shell and page markup.
- Loads Firebase compat SDKs for optional cloud backup.
- Loads `css/style.css`.
- Loads `html2canvas` for share-card export.
- Defines page containers such as:
  - `pg-home`
  - `pg-decks`
  - `pg-deck-overview`
  - `pg-deck-cards`
  - `pg-words`
  - `pg-fc`
  - `pg-learn`
  - `pg-account`
- Defines many app modals.

Important pattern:

```html
<button onclick="nav('home')">...</button>
```

The app relies on global functions such as `nav`, `startFC`, `openWordModal`, `renderWords`, `saveDeck`, and `saveWord` being available on `window`.

Safety notes:

- Do not rename element IDs unless you update every JavaScript reference.
- Do not remove inline event handlers unless you replace them with equivalent event listeners.
- Avoid adding more inline styles when possible. Prefer scoped CSS files.
- Private AI API keys should not be hardcoded in this file. Store user-provided AI keys through Settings / LocalStorage.

---

### `css/style.css`

Purpose:

- Main CSS entry file.
- Imports all CSS modules in a strict order.

Current load order:

```css
@import url('base.css');
@import url('components.css');
@import url('layout.css');
@import url('pages.css');
@import url('deck-cards.css');
@import url('flashcard.css');
@import url('modals.css');
@import url('share.css');
@import url('reader-notes-overlap-fix.css');
@import url('app-icon-background-reset.css');
@import url('wordjar-chatgpt-theme.css');
@import url('wordjar-popup-width.css');
@import url('wordjar-black-accent.css');
@import url('wordjar-background-tuning.css');
@import url('wordjar-app-center-fix.css');
@import url('wordjar-mushy-chat.css');
@import url('wordjar-ios-font-system.css');
@import url('wordjar-responsive-web.css');
@import url('wordjar-top-nav-compact.css');
@import url('wordjar-mushy-unified-header.css');
@import url('wordjar-mushy-chat-bg.css');
```

CSS rule:

- Do not edit global base styles unless the change should affect the whole app.
- New feature styles should use the `wordjar-` prefix.
- Prefer scoped classes such as `.wordjar-feature-name-*`.
- Do not use `!important` unless there is no safe alternative.
- Before changing UI layers, check `z-index`, `position`, and `pointer-events`.

---

### `js/app.js`

Purpose:

- Main app state and core logic.
- Handles deck, word, flashcard, study, profile, import/export, and many UI rendering flows.

Important state:

```js
const SK = 'wordjar_v4';

let D = {
  words: [],
  decks: [],
  profile: {
    name: 'User',
    id: 'wj-' + Math.random().toString(36).slice(2,8),
    avatar: 'idle',
    voice: 'en-US',
    voiceSpeed: 0.95,
    autoPlay: true,
    ipaAccent: 'us'
  },
  todayDone: 0,
  lastDate: '',
  studyDays: {}
};
```

Main responsibilities:

- Page navigation
- Word filtering
- Deck card management
- Multi-select cards
- Word modal save/delete
- Flashcard queue
- Spaced repetition update
- Study mode
- Share text fallback
- CSV import/export
- JSON backup/restore
- Profile avatar data
- Text-to-speech integration

Important functions / areas:

| Area | Main functions / variables | Notes |
|---|---|---|
| Storage | `SK`, `D`, `save()` | Local-first data model. |
| Navigation | `curPage`, `nav()` | Page IDs map to `pg-*` containers. |
| Word filters | `wordFilters`, `setWordTypeFilter`, `setWordLangFilter`, `toggleWordStarFilter` | Controls Dictionary filtering. |
| Spaced repetition | `sm2(w, q)`, `isDue(w)` | Updates interval, reps, EF, and next review date. |
| Deck cards | `viewDeckCards`, `renderDeckCards`, `toggleSelectMode` | Handles deck card list and multi-select. |
| Word CRUD | `openWordModal`, `saveWord`, `deleteWord`, `showDetail` | Main vocabulary editing flow. |
| Flashcards | `startFC`, `renderFC`, `revealFC`, `rateFC` | Review queue and rating buttons. |
| Study mode | `startLearn`, `renderLearn`, `nextLearn` | Example-based learning mode. |
| Sharing | `shareWordById`, `shareWord` | Uses Web Share API or clipboard fallback. |

Safety notes:

- `D` is global. Any module can read or write it.
- Always call `save()` after changing persistent data.
- After data changes, re-render affected UI areas:
  - `renderWords()`
  - `renderDecks()`
  - `renderDeckCards()`
  - `updateHome()`
  - `updateAccount()`
- Escape user-provided text before using `innerHTML`.
- Prefer `textContent` when rendering plain user text.

---

## 4. Data model

### Main data object

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

This object is saved in `localStorage` under:

```text
wordjar_v4
```

### Word object

Recommended current shape:

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

Planned / recommended WordJar vocabulary fields for future database work:

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

### Deck object

Recommended current shape:

```json
{
  "id": "d1",
  "name": "My Deck",
  "description": "Optional details",
  "color": "#09090b",
  "newPerDay": 25,
  "reviewPerDay": 999,
  "ignoreReviewLimit": false
}
```

### Profile object

Recommended current shape:

```json
{
  "name": "User",
  "id": "wj-abc123",
  "avatar": "idle",
  "voice": "en-US",
  "voiceSpeed": 0.95,
  "autoPlay": true,
  "ipaAccent": "us",
  "readerVoiceAccent": "en-GB",
  "readerVoiceSpeed": 0.8,
  "userLevel": "A2"
}
```

---

## 5. Storage keys

| Key | Storage | Owner | Purpose |
|---|---|---|---|
| `wordjar_v4` | `localStorage` | Core app | Main WordJar data object. |
| `wordjar_mushy_ai_cache_v1` | `localStorage` | Mushy router | Cached AI results for non-chat tasks. |
| `wordjar_mushy_chat_history_v1` | `localStorage` | Mushy chat | Last Mushy chat messages. |
| `wordjar_mushy_pending_context_v1` | `sessionStorage` | Mushy chat | Temporary Reader/deck context. |

Rules:

- Use `localStorage` for durable user data.
- Use `sessionStorage` for temporary context that should disappear after the session.
- Never store private API keys in source code.
- User-provided API keys should be saved through Settings / LocalStorage only.

---

## 6. Navigation system

The app uses page containers with IDs in this format:

```text
pg-home
pg-decks
pg-words
pg-account
pg-fc
pg-learn
pg-deck-overview
pg-deck-cards
pg-mushy-chat
```

The navigation function activates a page by adding/removing `.active`.

When adding a new page:

1. Add a page container in `index.html` or inject it safely from a module.
2. Use an ID with the `pg-` prefix.
3. Add a nav button only if it is a main destination.
4. Make sure `nav('your-page')` can activate it.
5. Check top nav active state.
6. Test back/close behavior.

---

## 7. Flashcard and spaced repetition flow

### Review queue

`startFC(deckIdOverride)` builds the flashcard queue.

Flow:

```text
User taps Study / Quick
  -> startFC()
  -> filter due cards with isDue(w)
  -> fallback to random cards if no due cards
  -> nav('fc')
  -> renderFC()
```

### Card reveal

```text
User taps card
  -> revealFC()
  -> card flips
  -> optionally plays word + example audio
```

### Rating

```text
User taps Again / Hard / Good / Easy
  -> rateFC(q)
  -> sm2(w, q)
  -> update todayDone and studyDays
  -> save()
  -> render next card
```

### SM-2 style logic

`sm2(w, q)` updates:

- `interval`
- `reps`
- `ef`
- `nextReview`

Rating values:

| Button | q | Meaning |
|---|---:|---|
| Again | 0 | Reset / short repeat. |
| Hard | 3 | Small interval increase, ease decreases. |
| Good | 4 | Normal interval progression. |
| Easy | 5 | Larger interval progression, ease increases. |

---

## 8. Dictionary / word management flow

### Add word

```text
openWordModal(null)
  -> user fills fields
  -> saveWord()
  -> duplicate check
  -> push new word into D.words
  -> save()
  -> close modal
  -> renderWords(), renderDecks(), updateHome()
```

### Edit word

```text
showDetail(id)
  -> editFromDetail()
  -> openWordModal(id)
  -> saveWord()
  -> Object.assign(existingWord, data)
  -> save and re-render
```

### Delete word

```text
deleteWord()
  -> confirm
  -> remove from D.words
  -> save
  -> close modal
  -> re-render
```

### Multi-select deck cards

```text
toggleSelectMode()
  -> selectedCards Set becomes active
  -> user selects cards
  -> deleteSelectedCards() / moveSelectedCards() / autoFillSelectedCards()
```

Safety notes:

- Always convert IDs to string when comparing selected cards.
- Reset `selectedCards` when leaving select mode.
- Keep action bar above content and test bottom padding.

---

## 9. Import / export

### CSV import

Expected visible format:

```text
Word, Type, Pronunciation, Meaning, Example, Notes
```

When importing:

- Parse each row.
- Normalize deck target.
- Validate required fields.
- Check duplicates in the same deck.
- Ask before importing duplicates.
- Save and re-render after import.

### CSV export

Exports vocabulary data for either all words or a target deck.

### JSON backup

JSON backup should include the full WordJar object:

- words
- decks
- profile
- study history
- settings
- reader data, if available

Restore replaces current local data, so always show a clear confirm dialog before applying JSON import.

---

## 10. Cloud backup sync

WordJar has optional Firebase-based cloud backup sync.

Current policy:

- Local browser data is the primary working copy.
- Save to Cloud uploads current local data.
- Load from Cloud replaces current local data with cloud backup.
- Sync is manual to avoid accidental overwrites.

Safety notes:

- Do not make auto-sync default until conflict handling exists.
- Always confirm before replacing local data.
- Always normalize restored data before saving it to `D`.
- Keep Firestore rules aligned with the backup path.

---

## 11. Mushy AI system

Mushy is split into two main responsibilities:

1. AI router
2. Chat UI

### `js/wordjar-mushy-router.js`

Purpose:

- Centralizes AI model choice.
- Builds Mushy prompt.
- Chooses fast or smart models.
- Calls Gemini API.
- Caches non-chat AI results.
- Converts API errors into user-friendly messages.
- Provides custom WordJar alert / confirm / prompt dialogs.

Model groups:

```js
const FAST_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
const SMART_MODELS = ['gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.5-flash'];
```

Task detection:

- Simple chat / short fill tasks use fast models.
- Complex grammar, nuance, comparison, long context, or long history use smart models.

Important global export:

```js
window.WordJarMushyAI = {
  fastModels,
  smartModels,
  lastModel,
  isComplexTask,
  ask,
  userFacingError,
  safeToast
};
```

API key rule:

- Mushy should read user-provided API keys from app settings / memory / LocalStorage.
- Do not hardcode private Gemini API keys in source files.

---

### `js/wordjar-mushy-chat.js`

Purpose:

- Adds a ChatGPT-style Mushy page dynamically.
- Adds a top nav button for Mushy.
- Stores chat history.
- Accepts Reader or deck context.
- Sends user messages to `WordJarMushyAI.ask()`.

Important keys:

```js
const HISTORY_KEY = 'wordjar_mushy_chat_history_v1';
const CONTEXT_KEY = 'wordjar_mushy_pending_context_v1';
const MAX_HISTORY = 40;
```

Important global export:

```js
window.WordJarMushyChat = {
  open,
  goBack,
  clear,
  clearContext,
  submit,
  send,
  quick,
  autosizeInput,
  copyMessage,
  saveToNote,
  askFromReader,
  askAboutWord,
  render
};
```

Flow:

```text
User opens Mushy
  -> WordJarMushyChat.open()
  -> ensurePage()
  -> ensureNavButton()
  -> render()

User sends message
  -> submit()
  -> send()
  -> append user message
  -> WordJarMushyAI.ask()
  -> append assistant message
  -> save chat history
```

Safety notes:

- Escape all message text before rendering.
- Keep chat history limited with `MAX_HISTORY`.
- Do not let Mushy pretend it has changed app data unless an actual data mutation happened.
- For deck fill actions, write the result into `D.words`, call `save()`, and re-render affected UI.

---

## 12. Reader and voice settings

Reader-related modules patch existing app behavior instead of replacing the full app.

The reader voice settings module:

- Adds cleaner voice settings UI.
- Adds general / flashcard voice controls.
- Adds reader-specific accent and speed controls.
- Uses `speechSynthesis` voices where available.
- Patches `openVoiceModal()` after the original function exists.

Voice-related profile fields:

```json
{
  "voice": "en-US",
  "voiceSpeed": 1,
  "readerVoiceAccent": "en-GB",
  "readerVoiceSpeed": 0.8,
  "autoPlay": true,
  "ipaAccent": "us"
}
```

Safety notes:

- Browser voices vary by device and OS.
- Always provide fallback voices.
- Do not assume every accent exists on every device.
- Test on iOS Safari and desktop Safari/Chrome.

---

## 13. Styling conventions

### Class naming

Use `wordjar-` prefix for all new scoped classes.

Good:

```css
.wordjar-reader-toolbar {}
.wordjar-mushy-message {}
.wordjar-deck-fill-panel {}
```

Avoid:

```css
.card {}
.button {}
.container {}
```

Generic names can accidentally affect old screens.

### Scoped CSS rule

New feature CSS should target its own wrapper.

Good:

```css
.wordjar-mushy-page .wordjar-mushy-header {}
```

Risky:

```css
.page .header {}
```

### z-index / pointer-events checklist

Before editing overlays, modals, popups, floating bars, or chat input:

- Check whether the element uses `position: fixed`, `absolute`, or `sticky`.
- Check current `z-index` relative to modals and top nav.
- Check whether hidden layers still have `pointer-events: auto`.
- If an invisible element blocks taps, set `pointer-events: none` while hidden.
- If a visible popup cannot be clicked, make sure parent layers do not block pointer events.

### Avoid

- `!important`
- hardcoded private API keys
- broad global selectors
- unnecessary inline styles
- duplicate modal IDs
- duplicate function names unless intentionally patching old behavior

---

## 14. Adding a new feature safely

Use this checklist.

### 1. Choose location

| Feature type | Recommended place |
|---|---|
| Core data logic | `js/app.js` now, future `js/core/*.js` |
| AI logic | `js/wordjar-mushy-router.js` or new `js/wordjar-ai-*.js` |
| New dynamic UI | New scoped `js/wordjar-feature-name.js` |
| Styling | New `css/wordjar-feature-name.css` imported by `css/style.css` |
| Static page markup | `index.html`, only if it is core app UI |

### 2. Use scoped names

- JS global: `window.WordJarFeatureName`
- CSS: `.wordjar-feature-name-*`
- Storage key: `wordjar_feature_name_v1`

### 3. Protect against double install

Use an install guard for patch modules:

```js
(function installWordJarFeatureName() {
  if (window.__wordjarFeatureNameInstalled) return;
  window.__wordjarFeatureNameInstalled = true;

  // feature code
})();
```

### 4. Save and re-render correctly

When changing data:

```text
mutate D
  -> save()
  -> render affected UI
  -> toast success/error
```

### 5. Test pages that might be affected

Always test:

- Home
- Decks
- Deck overview
- Deck cards
- Dictionary
- Flashcard mode
- Study mode
- Account / Settings
- Reader
- Mushy chat
- Import/export
- Mobile viewport
- Desktop viewport

---

## 15. Recommended future cleanup

The app works, but the next cleanup should reduce risk from a large global app file.

Recommended direction:

```text
js/
  core/
    state.js
    storage.js
    dates.js
    escape.js
  features/
    decks.js
    words.js
    flashcards.js
    import-export.js
    tts.js
    cloud-sync.js
  ai/
    mushy-router.js
    mushy-chat.js
    deck-fill.js
  reader/
    reader-core.js
    reader-voice-settings.js
  ui/
    dialogs.js
    toast.js
    navigation.js
```

Do this gradually. Do not rewrite everything at once.

Suggested order:

1. Extract pure helpers first: dates, escape, CSV parser.
2. Extract storage helpers.
3. Extract dialogs / toast.
4. Extract TTS.
5. Extract import/export.
6. Extract deck and word rendering.
7. Keep public `window.*` compatibility during migration.

---

## 16. Common bug checklist

### Button disappeared

Check:

- Is the button hidden by select mode?
- Is CSS `display: none` still applied?
- Is an overlay covering it?
- Is `z-index` lower than a fixed layer?
- Is parent `overflow: hidden` clipping it?
- Is another module replacing `innerHTML` and removing the button?

### UI overlapping

Check:

- Fixed bottom bars need bottom padding on scroll content.
- Top bars need safe-area padding on iOS.
- Modals need max-height and internal scroll.
- Chat input needs room above mobile keyboard.
- Reader popups need pointer-event control.

### Data not saving

Check:

- Did the code mutate `D`?
- Did it call `save()`?
- Did it re-render the screen?
- Is the user restoring old JSON data?
- Is the app using the expected `SK = wordjar_v4` key?

### AI not working

Check:

- Is the Gemini API key present in Settings / LocalStorage?
- Does the API key have permission for Gemini?
- Is the model name supported?
- Is the browser blocking the request?
- Is the error mapped by `userFacingError()`?

### Import duplicates

Check:

- Compare lowercase trimmed word values.
- Compare within the target deck.
- Ask user before importing duplicate words.
- Keep duplicate behavior consistent for manual add and CSV import.

---

## 17. Current technical risks

| Risk | Why it matters | Safer approach |
|---|---|---|
| Large `index.html` | Hard to maintain and easy to break IDs. | Gradually move dynamic feature UI into modules. |
| Large `js/app.js` | Many global functions and repeated logic. | Extract helpers and feature modules slowly. |
| Global patch modules | Load order can break patches. | Use install guards and delayed boot checks. |
| Inline event handlers | Renaming functions breaks UI silently. | Keep compatibility or migrate carefully. |
| `innerHTML` rendering | XSS risk if user text is not escaped. | Prefer `textContent` or escape first. |
| CSS override layers | Later imports can accidentally override earlier UI. | Use scoped `wordjar-` CSS and document load order. |
| Manual cloud restore | Can overwrite local data. | Always confirm and show clear status. |

---

## 18. Developer rules for this project

1. Do not remove existing features unless the task explicitly says so.
2. Keep files simple and readable.
3. Prefer small scoped fixes over large rewrites.
4. New CSS must use `wordjar-` prefixed classes.
5. Avoid global class modification unless the whole app should change.
6. Do not use `!important`.
7. Do not hardcode private API keys.
8. Always check `z-index` and `pointer-events` when fixing UI overlays.
9. After data mutation, call `save()` and re-render affected UI.
10. When adding AI features, keep the app useful even if AI fails.

---

## 19. Quick mental model

```text
index.html gives the app structure.
css/style.css controls visual layers.
js/app.js owns core data and study behavior.
Mushy modules add AI and chat on top.
Reader modules patch reader/voice behavior on top.
localStorage is the source of truth.
Firebase is optional backup, not the primary working copy.
```
