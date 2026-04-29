# Business Logic Refactoring Guide

This guide explains how to connect `js/wordjar-business-logic.js` to the current WordJar app safely.

The goal is to separate data/business rules from DOM/UI rendering.

---

## 1. Add the script before `js/app.js`

In `index.html`, load the business logic file before the main app file.

```html
<script src="js/wordjar-business-logic.js"></script>
<script src="js/app.js"></script>
```

If `app.js` is already loaded near the bottom of `index.html`, insert the business logic script immediately above it.

---

## 2. Replace SM-2 / spaced repetition logic

### Current code in `js/app.js`

```js
function sm2(w, q) {
  let { interval: iv=1, reps=0, ef=2.5 } = w;
  if (q === 0) { iv = 1; reps = 0; }
  else if (q === 3) { iv = Math.max(1, Math.round(iv * 1.2)); ef = Math.max(1.3, ef - 0.15); }
  else if (q === 4) { iv = reps===0?1:reps===1?6:Math.round(iv*ef); reps++; }
  else if (q === 5) { iv = reps===0?1:reps===1?6:Math.round(iv*ef*1.3); reps++; ef = Math.min(3, ef+0.1); }
  const nx = new Date(); nx.setDate(nx.getDate() + iv);
  w.interval = iv; w.reps = reps; w.ef = parseFloat(ef.toFixed(2));
  w.nextReview = nx.toISOString().split('T')[0];
}
function isDue(w) { return !w.nextReview || w.nextReview <= today(); }
function streak() { let s=0; const td=new Date(); for (let i=0; i<365; i++) { const d=new Date(td); d.setDate(td.getDate()-i); if (D.studyDays[d.toDateString()]) s++; else break; } return s; }
```

### Replace with

```js
function sm2(w, q) {
  return WordJarBusinessLogic.mutateSm2Review(w, q);
}

function isDue(w) {
  return WordJarBusinessLogic.isWordDue(w, today());
}

function streak() {
  return WordJarBusinessLogic.calculateStreak(D.studyDays || {});
}
```

Why:

- `app.js` keeps old function names for compatibility.
- The actual business rule moves to `WordJarBusinessLogic`.
- UI functions can still call `sm2`, `isDue`, and `streak` as before.

---

## 3. Replace flashcard queue building

### Current code

```js
function startFC(deckIdOverride) {
  const dId = deckIdOverride !== undefined ? deckIdOverride : currentStudyDeckId;
  if (dId) {
    fcQ = D.words.filter(w => w.deckId === dId && isDue(w));
    if (!fcQ.length) fcQ = D.words.filter(w=>w.deckId===dId).sort(()=>Math.random()-.5).slice(0,12);
  } else {
    fcQ = D.words.filter(isDue); 
    if (!fcQ.length) fcQ = [...D.words].sort(() => Math.random()-.5).slice(0, 12);
  }
  if (!fcQ.length) { toast('No cards available!'); return; }
  fcI = 0; nav('fc'); renderFC();
}
```

### Replace with

```js
function startFC(deckIdOverride) {
  const deckId = deckIdOverride !== undefined ? deckIdOverride : currentStudyDeckId;
  fcQ = WordJarBusinessLogic.getFlashcardQueue(D.words, deckId, {
    currentDate: today(),
    fallbackLimit: 12
  });

  if (!fcQ.length) {
    toast('No cards available!');
    return;
  }

  fcI = 0;
  nav('fc');
  renderFC();
}
```

Why:

- Queue rules are now testable without DOM.
- UI function only controls navigation and rendering.

---

## 4. Replace flashcard stats calculation

### Current code inside `renderFC()`

```js
let remN = 0, remL = 0, remR = 0;
for(let i=fcI; i<fcQ.length; i++){
  let cw = fcQ[i];
  if (cw.reps === 0) remN++;
  else if (cw.interval < 21) remL++;
  else remR++;
}
document.getElementById('fcStatsTop').innerHTML = `<span class="fc-s-n">${remN}</span><span class="fc-s-plus">+</span><span class="fc-s-l">${remL}</span><span class="fc-s-plus">+</span><span class="fc-s-r">${remR}</span>`;
```

### Replace with

```js
const fcStats = WordJarBusinessLogic.getFlashcardStats(fcQ, fcI);
document.getElementById('fcStatsTop').innerHTML = `<span class="fc-s-n">${fcStats.new}</span><span class="fc-s-plus">+</span><span class="fc-s-l">${fcStats.learning}</span><span class="fc-s-plus">+</span><span class="fc-s-r">${fcStats.review}</span>`;
```

Why:

- The rule for New / Learning / Review is no longer mixed into rendering.

---

## 5. Replace learn list building

### Current code

```js
function startLearn() {
  lList = [...D.words].filter(w => w.example).sort(() => Math.random()-.5).slice(0, 15);
  if (!lList.length) lList = [...D.words].sort(() => Math.random()-.5).slice(0, 15);
  if (!lList.length) { toast('Add some words first!'); return; }
  lI = 0; nav('learn'); renderLearn();
}
```

### Replace with

```js
function startLearn() {
  lList = WordJarBusinessLogic.buildLearnList(D.words, { limit: 15 });

  if (!lList.length) {
    toast('Add some words first!');
    return;
  }

  lI = 0;
  nav('learn');
  renderLearn();
}
```

---

## 6. Replace selected card deletion logic

### Current data mutation inside `deleteSelectedCards()`

```js
D.words = D.words.filter(w => !selectedCards.has(String(w.id)));
```

### Replace with

```js
D.words = WordJarBusinessLogic.deleteWordsByIds(D.words, selectedCards);
```

Why:

- The UI function still handles confirm, toast, and render.
- The data mutation is reusable and testable.

---

## 7. Replace selected card move logic

### Current data mutation inside `moveSelectedCards()`

```js
let count = 0;

D.words.forEach(w => {
  if (selectedCards.has(String(w.id))) {
    w.deckId = targetId;
    count++;
  }
});
```

### Replace with

```js
const moveResult = WordJarBusinessLogic.moveWordsToDeck(D.words, selectedCards, targetId);
D.words = moveResult.words;
const count = moveResult.count;
```

Why:

- Moving cards becomes business logic.
- UI only decides where to send the cards and what to show after.

---

## 8. Replace word save data-building logic

### Current logic inside `saveWord()`

The current `saveWord()` mixes:

- DOM reads
- validation
- duplicate checking
- data building
- mutation
- save
- close modal
- render

Keep DOM reads in `saveWord()`, but move validation/data rules to business logic.

### Replace the beginning of `saveWord()` with

```js
function saveWord() {
  const input = {
    word: document.getElementById('fWord').value,
    meaning: document.getElementById('fMeaning').value,
    deckId: document.getElementById('fDeck').value,
    types: selectedTypes,
    pronunciation: document.getElementById('fPron').value,
    example: document.getElementById('fEx').value,
    notes: document.getElementById('fNotes').value
  };

  const validation = WordJarBusinessLogic.validateWordInput(input);
  if (!validation.ok) {
    toast(validation.message);
    return;
  }

  const duplicateWords = WordJarBusinessLogic.findDuplicateWords(D.words, input.word, editWordId);

  if (duplicateWords.length > 0) {
    const sameDeck = duplicateWords.some(w => String(w.deckId) === String(input.deckId));

    const ok = window.confirm(
      sameDeck
        ? 'This word already exists in this deck. Add it again?'
        : 'This word already exists in another deck. Add it again?'
    );

    if (!ok) {
      toast('Cancelled');
      return;
    }
  }

  const data = WordJarBusinessLogic.buildWordData(input);

  if (editWordId) {
    Object.assign(D.words.find(x => x.id === editWordId), data);
    toast('Updated');
  } else {
    D.words.push(WordJarBusinessLogic.createWordRecord(input));
    toast('Added!');
  }

  save();
  document.getElementById('wordModal').classList.remove('open');
  document.getElementById('detailModal').classList.remove('open');

  setTimeout(() => {
    renderWords();
    updateHome();
    renderDecks();

    if (prevPage === 'deck-cards') {
      renderDeckCards();
      nav('deck-cards');
    } else if (prevPage === 'deck-overview') {
      showDeckOverview(currentStudyDeckId);
    } else if (prevPage === 'words') {
      nav('words');
    } else if (prevPage === 'decks') {
      nav('decks');
    } else if (prevPage === 'home') {
      nav('home');
    }
  }, 50);
}
```

Why:

- UI reads form values.
- Business logic validates, detects duplicates, and builds word data.
- UI still handles toast, modal close, navigation, and render.

---

## 9. Replace study progress mutation

### Current code in `rateFC(q)`

```js
function rateFC(q) {
  const w = fcQ[fcI]; sm2(w, q); if (q >= 3) { D.todayDone++; markStudied(); }
  save(); fcI++; renderFC();
}
```

### Safer partial replacement

```js
function rateFC(q) {
  const word = fcQ[fcI];
  sm2(word, q);

  if (q >= 3) {
    D.todayDone++;
    markStudied();
  }

  save();
  fcI++;
  renderFC();
}
```

Later, after `markStudied()` is moved out of `app.js`, this can become:

```js
function rateFC(q) {
  const word = fcQ[fcI];
  sm2(word, q);

  if (q >= 3) {
    D = WordJarBusinessLogic.markStudied(D);
  }

  save();
  fcI++;
  renderFC();
}
```

Do the later version only after checking if other parts of the app depend on the old `markStudied()` side effect.

---

## 10. What stays in UI files

Keep these in UI / app layer:

- `document.getElementById(...)`
- `innerHTML`
- `textContent`
- `classList`
- `style.display`
- `toast(...)`
- `confirm(...)`
- `openO(...)`
- `closeO(...)`
- `nav(...)`
- `renderWords()`
- `renderDecks()`
- `renderFC()`

Move these to business logic:

- SM-2 interval calculation
- due-card detection
- flashcard queue selection
- streak calculation
- duplicate word detection
- word data building
- delete/move selected word records
- JSON/data normalization

---

## 11. Testing checklist after applying replacements

Test these flows after each replacement, not only at the end:

1. Add new word.
2. Add duplicate word in the same deck.
3. Add duplicate word in another deck.
4. Edit word.
5. Delete word.
6. Open deck cards.
7. Select multiple cards.
8. Delete selected cards.
9. Move selected cards.
10. Start Quick flashcards.
11. Start deck flashcards.
12. Rate Again / Hard / Good / Easy.
13. Check next review date.
14. Start Study Mode.
15. Check dashboard streak and reviewed count.

---

## 12. Recommended final structure after this step

```text
js/
  app.js
  wordjar-business-logic.js
  wordjar-mushy-router.js
  wordjar-mushy-chat.js
```

This is still not fully modular, but it is much cleaner because business rules are no longer trapped inside UI rendering code.

Next step after this guide:

```text
Split UI rendering into:
- js/features/words/word-render.js
- js/features/decks/deck-render.js
- js/features/flashcards/flashcard-render.js
```
