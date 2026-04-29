// WordJar Select Smart All Batch V1
// Replaces one-word-at-a-time Smart All with cancellable batch requests.

(function installWordJarSelectSmartAllBatch() {
  if (window.__wordjarSelectSmartAllBatchInstalled) return;
  window.__wordjarSelectSmartAllBatchInstalled = true;

  const STYLE_ID = 'wordjarSelectSmartAllBatchStyle';
  const BATCH_SIZE = 16;
  const REQUEST_GAP_MS = 13000;
  let activeRun = null;

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #cardSelectActions .select-action-buttons {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
      }
      #cardSelectActions .select-action-buttons > .btn {
        width: 100%;
        min-width: 0;
        min-height: 50px;
        margin: 0;
      }
      #btnAutoFillSelectedCards { grid-column: 1 / 3; grid-row: 1; }
      #btnCleanSelectedCards { grid-column: 3 / 5; grid-row: 1; }
      #btnSmartFillSelectedCards { grid-column: 5 / 7; grid-row: 1; }
      #btnDeleteSelectedCards { grid-column: 1 / 4; grid-row: 2; }
      #btnMoveSelectedCards { grid-column: 4 / 7; grid-row: 2; }
      #btnSmartFillSelectedCards.wordjar-smart-all-running {
        background: #111;
        border-color: #111;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function selectActive() {
    try { return !!isSelectMode; } catch (err) { return false; }
  }

  function currentDeckCards() {
    try {
      return (D.words || []).filter(card => String(card.deckId) === String(currentStudyDeckId));
    } catch (err) {
      return [];
    }
  }

  function targetIds() {
    if (!selectActive()) return [];
    try {
      if (selectedCards && selectedCards.size) return Array.from(selectedCards).map(String);
    } catch (err) {}
    return currentDeckCards().map(card => String(card.id));
  }

  function needsFill(card) {
    return !String(card.meaning || '').trim() ||
      !String(card.synonyms || '').trim() ||
      !String(card.type || '').trim() ||
      !String(card.pronunciation || '').trim() ||
      !String(card.example || '').trim() ||
      !String(card.notes || '').trim();
  }

  function chunks(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }

  function parseJSON(text) {
    const raw = String(text || '').trim();
    try { return JSON.parse(raw); } catch (err) {}
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) return JSON.parse(fenced[1].trim());
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Invalid AI JSON');
  }

  function level() {
    return String(D?.profile?.userLevel || D?.profile?.englishLevel || D?.profile?.cefrLevel || 'A2').toUpperCase();
  }

  function promptFor(cards) {
    const input = cards.map(card => ({ id: String(card.id), word: String(card.word || '').trim() }));
    return `Fill vocabulary cards for Thai learners. Level: ${level()}\nInput: ${JSON.stringify(input)}\nReturn ONLY JSON: {"items":[{"id":"same id","word":"word","type":"N|V|ADJ|ADV|ART|PRON|PHR|IDM","pronunciation":"/IPA/","meaning":"concise Thai meaning","synonyms":["English synonym"],"example":"short simple English sentence","notes":"short Thai usage note"}]}\nRules: one item per input word, do not skip, synonyms English only.`;
  }

  async function callBatch(cards) {
    if (!window.WordJarAIConfig || typeof window.WordJarAIConfig.callGemini !== 'function') {
      throw new Error('Smart Fill AI is not ready');
    }
    const output = await window.WordJarAIConfig.callGemini(promptFor(cards), {
      maxTokens: 4096,
      forceJson: true,
      models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
    });
    const data = parseJSON(output);
    return Array.isArray(data.items) ? data.items : [];
  }

  function cleanList(value) {
    if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).join(', ');
    return String(value || '').trim();
  }

  function fillIfEmpty(card, key, value) {
    const clean = cleanList(value);
    if (!clean || String(card[key] || '').trim()) return false;
    card[key] = clean;
    return true;
  }

  function applyResult(card, result) {
    if (!card || !result) return false;
    let changed = false;
    if (fillIfEmpty(card, 'type', result.type)) changed = true;
    if (fillIfEmpty(card, 'pronunciation', result.pronunciation)) changed = true;
    if (fillIfEmpty(card, 'meaning', result.meaning)) changed = true;
    if (fillIfEmpty(card, 'synonyms', result.synonyms)) changed = true;
    if (fillIfEmpty(card, 'example', result.example)) changed = true;
    if (fillIfEmpty(card, 'notes', result.notes)) changed = true;
    return changed;
  }

  function findResult(card, results) {
    const id = String(card.id);
    const word = String(card.word || '').trim().toLowerCase();
    return results.find(item => String(item.id || '') === id) ||
      results.find(item => String(item.word || '').trim().toLowerCase() === word);
  }

  function setButton(running, label) {
    const btn = document.getElementById('btnSmartFillSelectedCards');
    if (!btn) return;
    btn.classList.toggle('wordjar-smart-all-running', !!running);
    btn.disabled = false;
    btn.textContent = label || (running ? 'Cancel' : 'Smart All');
  }

  function setBadge(text) {
    const badge = document.getElementById('selectCountBadge');
    if (badge) badge.textContent = text;
  }

  function cancelSmartAll(reason) {
    if (!activeRun) return;
    activeRun.cancelled = true;
    activeRun.reason = reason || 'cancelled';
    setButton(false, 'Smart All');
  }

  async function smartAllBatch() {
    if (activeRun && !activeRun.cancelled) {
      cancelSmartAll('cancelled');
      toastSafe('Smart All cancelled');
      return;
    }

    const ids = new Set(targetIds());
    const cards = (D.words || []).filter(card => ids.has(String(card.id)) && String(card.word || '').trim() && needsFill(card));
    if (!cards.length) {
      toastSafe('All cards already filled');
      return;
    }

    const run = { cancelled: false, reason: '' };
    activeRun = run;
    const batches = chunks(cards, BATCH_SIZE);
    let done = 0;
    let filled = 0;
    let failed = 0;
    let skipped = 0;

    setButton(true, 'Cancel');
    setBadge(`Smart batch 0/${cards.length}`);

    try {
      for (let i = 0; i < batches.length; i++) {
        if (run.cancelled || !selectActive()) break;
        const batch = batches[i];

        try {
          const results = await callBatch(batch);
          batch.forEach(card => {
            const result = findResult(card, results);
            if (!result) {
              failed++;
              return;
            }
            if (applyResult(card, result)) filled++;
            else skipped++;
          });
        } catch (err) {
          failed += batch.length;
          console.warn('Smart All batch failed', err);
          const message = String(err?.message || err?.apiMessage || '');
          if (message.includes('429') || /quota|rate|limit/i.test(message)) {
            toastSafe('Gemini limit reached. Smart All stopped. Try again later.');
            break;
          }
        }

        done += batch.length;
        setBadge(`Smart batch ${done}/${cards.length}`);
        if (typeof save === 'function') save();

        if (i < batches.length - 1) {
          for (let ms = 0; ms < REQUEST_GAP_MS; ms += 500) {
            if (run.cancelled || !selectActive()) break;
            await sleep(500);
          }
        }
      }

      if (typeof save === 'function') save();
      if (typeof renderDeckCards === 'function') renderDeckCards();
      if (typeof renderWords === 'function') renderWords();
      if (typeof renderDecks === 'function') renderDecks();
      if (typeof updateHome === 'function') updateHome();

      if (run.cancelled || !selectActive()) toastSafe('Smart All stopped');
      else toastSafe(`Smart All done: ${filled} filled, ${skipped} skipped${failed ? `, ${failed} failed` : ''}`);
    } finally {
      if (activeRun === run) activeRun = null;
      setButton(false, 'Smart All');
      if (typeof updateSelectActions === 'function') updateSelectActions();
      bind();
    }
  }

  function bind() {
    injectStyle();
    window.smartFillSelectedCards = smartAllBatch;
    window.cancelWordJarSmartAll = cancelSmartAll;
    const btn = document.getElementById('btnSmartFillSelectedCards');
    if (btn) btn.onclick = smartAllBatch;
  }

  function patchUpdateSelectActions() {
    if (window.__wordjarSmartAllBatchUpdatePatched) return;
    if (typeof window.updateSelectActions !== 'function') return;
    const original = window.updateSelectActions;
    window.__wordjarSmartAllBatchUpdatePatched = true;
    window.updateSelectActions = function updateSelectActionsSmartAllBatch() {
      const result = original.apply(this, arguments);
      if (!selectActive()) cancelSmartAll('left-select');
      setTimeout(bind, 0);
      return result;
    };
  }

  function boot() {
    injectStyle();
    patchUpdateSelectActions();
    bind();
  }

  window.WordJarSmartAllBatch = { run: smartAllBatch, cancel: cancelSmartAll, isRunning: () => !!activeRun && !activeRun.cancelled };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 600);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();

// WordJar Select Action Doctor V2
// Final safety layer for deck card select-mode buttons.
// Uses app-styled dialogs instead of native browser alerts/confirms.

(function installWordJarSelectActionDoctor() {
  if (window.__wordjarSelectActionDoctorInstalled) return;
  window.__wordjarSelectActionDoctorInstalled = true;

  const STYLE_ID = 'wordjarSelectActionDoctorStyle';
  let fillRunning = false;

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  async function confirmSafe(options) {
    if (window.WordJarDialog?.confirm) return WordJarDialog.confirm(options);
    return window.confirm(options.message || String(options || ''));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #toast {
        pointer-events: none;
      }

      #cardSelectActions.select-action-bar {
        z-index: 2200;
      }

      #cardSelectActions .select-action-panel,
      #cardSelectActions .select-action-buttons,
      #cardSelectActions .select-action-buttons .btn {
        pointer-events: auto;
      }
    `;
    document.head.appendChild(style);
  }

  function selectActive() {
    try { return !!isSelectMode; } catch (err) { return false; }
  }

  function deckCards() {
    try {
      if (!Array.isArray(D?.words)) return [];
      return D.words.filter(card => String(card.deckId) === String(currentStudyDeckId));
    } catch (err) {
      return [];
    }
  }

  function deckCardIds() {
    return deckCards().map(card => String(card.id));
  }

  function selectedIds() {
    try {
      if (selectedCards && selectedCards.size > 0) return Array.from(selectedCards).map(String);
    } catch (err) {}
    return [];
  }

  function isAllMode() {
    return selectActive() && selectedIds().length === 0;
  }

  function targetIds() {
    if (!selectActive()) return [];
    const selected = selectedIds();
    return selected.length ? selected : deckCardIds();
  }

  function targetCards() {
    const ids = new Set(targetIds());
    return (D?.words || []).filter(card => ids.has(String(card.id)));
  }

  function setSelectButtonText() {
    const btn = document.getElementById('btnSelectCards');
    if (btn) btn.textContent = selectActive() ? 'Cancel' : 'Select';
  }

  function refreshAfterChange() {
    if (typeof save === 'function') save();
    if (typeof renderDeckCards === 'function') renderDeckCards();
    if (typeof renderWords === 'function') renderWords();
    if (typeof renderDecks === 'function') renderDecks();
    if (typeof updateHome === 'function') updateHome();
    if (typeof updateSelectActions === 'function') setTimeout(updateSelectActions, 0);
    setTimeout(normalizeActionButtons, 0);
  }

  function leaveSelectMode() {
    try { selectedCards.clear(); } catch (err) {}
    try { isSelectMode = false; } catch (err) {}
    setSelectButtonText();
  }

  function normalizeActionButtons() {
    injectStyle();

    const wrap = document.querySelector('#cardSelectActions .select-action-buttons');
    if (!wrap) return;

    const buttons = Array.from(wrap.querySelectorAll('button'));
    const roleMap = new Map();

    buttons.forEach(button => {
      const text = String(button.textContent || '').trim().toLowerCase();
      const id = button.id || '';

      if (id === 'btnAutoFillSelectedCards' || text.startsWith('fill')) roleMap.set('fill', button);
      else if (id === 'btnCleanSelectedCards' || text.startsWith('clean')) roleMap.set('clean', button);
      else if (id === 'btnSmartFillSelectedCards' || text.startsWith('smart') || text === 'cancel') roleMap.set('smart', button);
      else if (id === 'btnDeleteSelectedCards' || text.startsWith('delete')) roleMap.set('delete', button);
      else if (id === 'btnMoveSelectedCards' || text.startsWith('move')) roleMap.set('move', button);
    });

    const total = deckCardIds().length;
    const selectedCount = selectedIds().length;
    const allMode = isAllMode();
    const labelCount = allMode ? total : selectedCount;
    const badge = document.getElementById('selectCountBadge');

    if (badge && selectActive()) {
      badge.textContent = allMode
        ? (total === 1 ? 'All 1 card' : `All ${total} cards`)
        : (selectedCount === 1 ? '1 selected' : `${selectedCount} selected`);
    }

    const labels = {
      fill: allMode ? 'Fill All' : 'Fill',
      clean: allMode ? 'Clean All' : 'Clean',
      smart: allMode ? 'Smart All' : 'Smart',
      delete: allMode ? 'Delete All' : 'Delete',
      move: allMode ? 'Move All' : 'Move'
    };

    Object.entries(roleMap).forEach(([role, button]) => {
      button.id = {
        fill: 'btnAutoFillSelectedCards',
        clean: 'btnCleanSelectedCards',
        smart: 'btnSmartFillSelectedCards',
        delete: 'btnDeleteSelectedCards',
        move: 'btnMoveSelectedCards'
      }[role];

      button.dataset.wordjarActionRole = role;
      if (!button.classList.contains('btn')) button.classList.add('btn');

      const busySmart = role === 'smart' && window.WordJarSmartAllBatch?.isRunning?.();
      const busyFill = role === 'fill' && fillRunning;
      const progressText = /^\d+\/\d+$/.test(String(button.textContent || '').trim());

      if (!busySmart && !busyFill && !progressText) button.textContent = labels[role];

      button.disabled = fillRunning || (!selectActive() || labelCount === 0);
      if (role === 'smart' && window.WordJarSmartAllBatch?.isRunning?.()) button.disabled = false;
    });
  }

  async function deleteTargets() {
    const ids = targetIds();
    if (!ids.length) {
      toastSafe('No cards available');
      return;
    }

    const count = ids.length;
    const confirmed = await confirmSafe({
      title: isAllMode() ? 'Delete All Cards' : 'Delete Cards',
      message: isAllMode()
        ? `Delete all ${count} cards in this deck?\nThis cannot be undone.`
        : `Delete ${count} selected cards?\nThis cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });

    if (!confirmed) return;

    const idSet = new Set(ids.map(String));
    D.words = (D.words || []).filter(card => !idSet.has(String(card.id)));

    leaveSelectMode();
    refreshAfterChange();
    toastSafe(`${count} cards deleted`);
  }

  function openMoveModal() {
    const ids = targetIds();
    if (!ids.length) {
      toastSafe('No cards available');
      return;
    }

    const decks = (D?.decks || []).filter(deck => String(deck.id) !== String(currentStudyDeckId));
    if (!decks.length) {
      toastSafe('No other deck available');
      return;
    }

    const select = document.getElementById('moveDestDeck');
    if (!select) {
      toastSafe('Move modal not found');
      return;
    }

    window.wordjarDeckActionPendingMoveIds = ids.map(String);
    select.innerHTML = decks
      .map(deck => `<option value="${escapeOptionValue(deck.id)}">${escapeOptionText(deck.name)}</option>`)
      .join('');

    if (typeof openO === 'function') openO('moveCardsModal');
  }

  function moveTargets() {
    const ids = Array.isArray(window.wordjarDeckActionPendingMoveIds) && window.wordjarDeckActionPendingMoveIds.length
      ? window.wordjarDeckActionPendingMoveIds.map(String)
      : targetIds();

    if (!ids.length) {
      toastSafe('No cards available');
      return;
    }

    const targetDeckId = document.getElementById('moveDestDeck')?.value;
    if (!targetDeckId) {
      toastSafe('No destination deck');
      return;
    }

    const idSet = new Set(ids.map(String));
    let moved = 0;

    (D.words || []).forEach(card => {
      if (idSet.has(String(card.id))) {
        card.deckId = targetDeckId;
        moved++;
      }
    });

    window.wordjarDeckActionPendingMoveIds = [];
    leaveSelectMode();
    if (typeof closeO === 'function') closeO('moveCardsModal');
    refreshAfterChange();
    toastSafe(`${moved} cards moved`);
  }

  async function fillTargets() {
    if (fillRunning) return;

    const cards = targetCards();
    if (!cards.length) {
      toastSafe('No cards available');
      return;
    }

    if (typeof getDictionaryAutoFillWithRetry !== 'function' || typeof applyAutoFillToWordObject !== 'function') {
      toastSafe('Fill is not ready');
      return;
    }

    const button = document.getElementById('btnAutoFillSelectedCards');
    const badge = document.getElementById('selectCountBadge');
    const previousText = button?.textContent || 'Fill';
    let filled = 0;
    let skipped = 0;
    let unavailable = 0;

    fillRunning = true;
    normalizeActionButtons();

    try {
      for (let index = 0; index < cards.length; index++) {
        const card = cards[index];
        if (button) button.textContent = `${index + 1}/${cards.length}`;
        if (badge) badge.textContent = `Filling ${index + 1}/${cards.length}`;

        if (!card || !String(card.word || '').trim() || (typeof isJapaneseWord === 'function' && isJapaneseWord(card.word))) {
          unavailable++;
          continue;
        }

        try {
          const result = await getDictionaryAutoFillWithRetry(card.word);
          if (!result) {
            unavailable++;
            continue;
          }

          if (applyAutoFillToWordObject(card, result)) filled++;
          else skipped++;

          if ((index + 1) % 25 === 0 && typeof save === 'function') save();
        } catch (err) {
          unavailable++;
        }
      }

      refreshAfterChange();
      toastSafe(`Fill done: ${filled} filled, ${skipped} skipped${unavailable ? `, ${unavailable} unavailable` : ''}`);
    } finally {
      fillRunning = false;
      if (button) button.textContent = previousText;
      normalizeActionButtons();
    }
  }

  function runClean() {
    if (window.WordJarDeckCleanSmartActions?.cleanSelectedCards) {
      WordJarDeckCleanSmartActions.cleanSelectedCards();
      return;
    }

    if (typeof window.cleanSelectedCards === 'function') {
      window.cleanSelectedCards();
      return;
    }

    toastSafe('Clean is not ready');
  }

  function runSmart() {
    if (window.WordJarSmartAllBatch?.run) {
      WordJarSmartAllBatch.run();
      return;
    }

    if (typeof window.smartFillSelectedCards === 'function') {
      window.smartFillSelectedCards();
      return;
    }

    toastSafe('Smart Fill is not ready');
  }

  function escapeOptionText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeOptionValue(value) {
    return escapeOptionText(value);
  }

  function roleFromButton(button) {
    const role = button?.dataset?.wordjarActionRole;
    if (role) return role;

    const id = button?.id || '';
    const text = String(button?.textContent || '').trim().toLowerCase();

    if (id === 'btnDeleteSelectedCards' || text.startsWith('delete')) return 'delete';
    if (id === 'btnMoveSelectedCards' || text.startsWith('move')) return 'move';
    if (id === 'btnAutoFillSelectedCards' || text.startsWith('fill')) return 'fill';
    if (id === 'btnCleanSelectedCards' || text.startsWith('clean')) return 'clean';
    if (id === 'btnSmartFillSelectedCards' || text.startsWith('smart') || text === 'cancel') return 'smart';
    return '';
  }

  function handleActionClick(event) {
    const button = event.target.closest?.('#cardSelectActions button');
    if (!button) return;

    const role = roleFromButton(button);
    if (!role) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (button.disabled && role !== 'smart') return;

    if (role === 'delete') deleteTargets();
    else if (role === 'move') openMoveModal();
    else if (role === 'fill') fillTargets();
    else if (role === 'clean') runClean();
    else if (role === 'smart') runSmart();
  }

  function patchMoveFunction() {
    window.moveSelectedCards = moveTargets;
  }

  function boot() {
    injectStyle();
    patchMoveFunction();
    normalizeActionButtons();
  }

  document.addEventListener('click', handleActionClick, true);
  document.addEventListener('click', () => setTimeout(boot, 0), true);

  const timer = setInterval(boot, 500);
  setTimeout(() => clearInterval(timer), 8000);

  window.WordJarSelectActionDoctor = {
    normalizeActionButtons,
    deleteTargets,
    openMoveModal,
    moveTargets,
    fillTargets,
    runClean,
    runSmart
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 600);
})();
