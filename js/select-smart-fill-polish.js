// WordJar Select Smart Fill Polish V1
// Fixes select-mode Smart Fill to match Edit Card behavior and normalizes action button layout.

(function installWordJarSelectSmartFillPolish() {
  if (window.__wordjarSelectSmartFillPolishInstalled) return;
  window.__wordjarSelectSmartFillPolishInstalled = true;

  const STYLE_ID = 'wordjarSelectSmartFillPolishStyle';
  const BULK_CONCURRENCY = 1;
  let smartBulkRunning = false;

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html body #cardSelectActions.select-action-bar .select-action-buttons {
        grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
        grid-auto-rows: minmax(50px, auto) !important;
        gap: 8px !important;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons > .btn {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        min-height: 50px !important;
        margin: 0 !important;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnAutoFillSelectedCards {
        grid-column: 1 / 3 !important;
        grid-row: 1 !important;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnCleanSelectedCards {
        grid-column: 3 / 5 !important;
        grid-row: 1 !important;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnSmartFillSelectedCards {
        grid-column: 5 / 7 !important;
        grid-row: 1 !important;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnDeleteSelectedCards {
        grid-column: 1 / 4 !important;
        grid-row: 2 !important;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnMoveSelectedCards {
        grid-column: 4 / 7 !important;
        grid-row: 2 !important;
      }
    `;

    document.head.appendChild(style);
  }

  function isSelectModeActive() {
    try { return !!isSelectMode; } catch (err) { return false; }
  }

  function getDeckCards() {
    try {
      if (!Array.isArray(D?.words)) return [];
      return D.words.filter(w => String(w.deckId) === String(currentStudyDeckId));
    } catch (err) {
      return [];
    }
  }

  function getTargetCardIds() {
    if (!isSelectModeActive()) return [];
    try {
      if (selectedCards && selectedCards.size > 0) return Array.from(selectedCards).map(String);
    } catch (err) {}
    return getDeckCards().map(w => String(w.id));
  }

  function normalizeValue(value) {
    if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).join(', ');
    return String(value || '').trim();
  }

  function fillCardIfEmpty(card, key, value) {
    const clean = normalizeValue(value);
    if (!card || !clean || String(card[key] || '').trim()) return false;
    card[key] = clean;
    return true;
  }

  function applySmartFillToCardIfEmpty(card, result) {
    if (!card || !result) return false;
    let changed = false;

    if (fillCardIfEmpty(card, 'pronunciation', result.pronunciation)) changed = true;
    if (fillCardIfEmpty(card, 'meaning', result.meaning)) changed = true;
    if (fillCardIfEmpty(card, 'synonyms', result.synonyms)) changed = true;
    if (fillCardIfEmpty(card, 'example', result.example)) changed = true;
    if (fillCardIfEmpty(card, 'notes', result.notes)) changed = true;
    if (fillCardIfEmpty(card, 'type', result.type)) changed = true;

    return changed;
  }

  async function fetchSmartFill(word) {
    if (window.WordJarHighEndAI?.fetchHighEndSmartFill) {
      return WordJarHighEndAI.fetchHighEndSmartFill(word);
    }

    if (window.WordJarSmartFillAI?.fetchGeminiSmartFill) {
      return WordJarSmartFillAI.fetchGeminiSmartFill(word);
    }

    throw new Error('SMART_FILL_ENGINE_NOT_READY');
  }

  async function runPool(items, worker, limit, onProgress) {
    let index = 0;
    let done = 0;
    const count = Math.min(limit, items.length);

    async function runWorker() {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
        done++;
        if (onProgress) onProgress(done, items.length);
      }
    }

    await Promise.all(Array.from({ length: count }, runWorker));
  }

  async function smartFillSelectedCardsPatched() {
    if (smartBulkRunning) return;

    const targetIds = getTargetCardIds();
    if (!targetIds.length) {
      safeToast('No cards available');
      return;
    }

    const idSet = new Set(targetIds.map(String));
    const targets = (D.words || []).filter(card => idSet.has(String(card.id)) && String(card.word || '').trim());
    const btn = document.getElementById('btnSmartFillSelectedCards');
    const badge = document.getElementById('selectCountBadge');
    const oldText = btn?.textContent || 'Smart';

    let filled = 0;
    let skipped = 0;
    let failed = 0;
    let saveCounter = 0;

    smartBulkRunning = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'AI...';
    }

    try {
      await runPool(
        targets,
        async card => {
          try {
            const result = await fetchSmartFill(card.word);
            if (applySmartFillToCardIfEmpty(card, result)) {
              filled++;
              saveCounter++;
              if (saveCounter >= 5) {
                saveCounter = 0;
                if (typeof save === 'function') save();
              }
            } else {
              skipped++;
            }
          } catch (err) {
            failed++;
            console.warn('Select Smart Fill failed for card', card?.word, err);
          }
        },
        BULK_CONCURRENCY,
        (done, total) => {
          if (btn) btn.textContent = `${done}/${total}`;
          if (badge) badge.textContent = `Smart Filling ${done}/${total}`;
        }
      );

      if (typeof save === 'function') save();
      if (typeof renderDeckCards === 'function') renderDeckCards();
      if (typeof renderWords === 'function') renderWords();
      if (typeof renderDecks === 'function') renderDecks();
      if (typeof updateHome === 'function') updateHome();

      safeToast(`Smart Fill done: ${filled} filled, ${skipped} skipped${failed ? `, ${failed} failed` : ''}`);
    } finally {
      smartBulkRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
      if (typeof updateSelectActions === 'function') updateSelectActions();
      bindSmartButton();
    }
  }

  function bindSmartButton() {
    injectStyles();

    window.smartFillSelectedCards = smartFillSelectedCardsPatched;
    if (window.WordJarHighEndAI) window.WordJarHighEndAI.smartFillSelectedCards = smartFillSelectedCardsPatched;
    if (window.WordJarSmartFillAI) window.WordJarSmartFillAI.smartFillSelectedCards = smartFillSelectedCardsPatched;

    const btn = document.getElementById('btnSmartFillSelectedCards');
    if (btn) btn.onclick = smartFillSelectedCardsPatched;
  }

  function patchUpdateSelectActions() {
    if (window.__wordjarSelectSmartFillPolishUpdatePatched) return;
    if (typeof window.updateSelectActions !== 'function') return;

    const original = window.updateSelectActions;
    window.__wordjarSelectSmartFillPolishUpdatePatched = true;

    window.updateSelectActions = function updateSelectActionsWithSelectSmartFillPolish() {
      const result = original.apply(this, arguments);
      setTimeout(bindSmartButton, 0);
      return result;
    };
  }

  function boot() {
    injectStyles();
    patchUpdateSelectActions();
    bindSmartButton();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();
