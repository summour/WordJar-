// WordJar Deck Clean + Smart Actions V2
// Select bar layout: Fill/Clean/Smart on top, Delete/Move on bottom.
// Clean now opens options modal before clearing card fields.

(function installWordJarDeckCleanSmartActions() {
  if (window.__wordjarDeckCleanSmartActionsInstalledV2) return;
  window.__wordjarDeckCleanSmartActionsInstalledV2 = true;

  const STYLE_ID = 'wordjarDeckCleanSmartActionsStyle';
  const CLEAN_MODAL_ID = 'wordjarCleanCardsModal';

  const CLEAN_FIELDS = [
    { key: 'type', label: 'Type' },
    { key: 'pronunciation', label: 'Pronunciation' },
    { key: 'meaning', label: 'Meaning' },
    { key: 'synonyms', label: 'Synonyms' },
    { key: 'example', label: 'Example Sentence' },
    { key: 'notes', label: 'Notes' },
    { key: 'extras', label: 'Extras: tags, source, audio, image' }
  ];

  function safeToast(message) {
    if (typeof toast === 'function') toast(message);
  }

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html body #cardSelectActions.select-action-bar .select-action-buttons {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 10px;
        align-items: stretch;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons .btn {
        min-width: 0;
        width: 100%;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnAutoFillSelectedCards {
        grid-column: 1 / 3;
        grid-row: 1;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnCleanSelectedCards {
        grid-column: 3 / 5;
        grid-row: 1;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnSmartFillSelectedCards {
        grid-column: 5 / 7;
        grid-row: 1;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnDeleteSelectedCards {
        grid-column: 1 / 4;
        grid-row: 2;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons #btnMoveSelectedCards {
        grid-column: 4 / 7;
        grid-row: 2;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons .wordjar-clean-cards-btn,
      html body #cardSelectActions.select-action-bar .select-action-buttons #btnSmartFillSelectedCards,
      html body #cardSelectActions.select-action-bar .select-action-buttons #btnAutoFillSelectedCards {
        background: #fff;
        border: 1px solid var(--bdr);
        color: var(--ink);
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons .wordjar-clean-cards-btn {
        color: #92400e;
        background: #fffbeb;
        border-color: #f4d58d;
      }

      html body #cardSelectActions.select-action-bar .select-action-buttons .wordjar-clean-cards-btn:disabled,
      html body #cardSelectActions.select-action-bar .select-action-buttons #btnSmartFillSelectedCards:disabled {
        opacity: .5;
        pointer-events: none;
      }

      .wordjar-clean-modal-sub {
        color: var(--ink2);
        font-size: 13px;
        font-weight: 750;
        line-height: 1.4;
        margin-top: 4px;
      }

      .wordjar-clean-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 16px;
      }

      .wordjar-clean-option {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 10px;
        align-items: center;
        min-height: 48px;
        padding: 10px 12px;
        border-radius: 16px;
        border: 1px solid var(--bdr);
        background: var(--sur2);
        color: var(--ink);
        font-size: 14px;
        font-weight: 850;
        cursor: pointer;
      }

      .wordjar-clean-option input {
        width: 20px;
        height: 20px;
        accent-color: var(--ink);
      }

      .wordjar-clean-actions {
        display: grid;
        grid-template-columns: 1fr 1.35fr;
        gap: 10px;
        margin-top: 16px;
      }

      @media (max-width: 380px) {
        html body #cardSelectActions.select-action-bar .select-action-buttons {
          gap: 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getDeckCards() {
    if (!Array.isArray(D?.words)) return [];
    if (typeof currentStudyDeckId === 'undefined') return [];
    return D.words.filter(w => String(w.deckId) === String(currentStudyDeckId));
  }

  function isAllMode() {
    return !!window.isSelectMode || (typeof isSelectMode !== 'undefined' && !!isSelectMode)
      ? !(typeof selectedCards !== 'undefined' && selectedCards && selectedCards.size > 0)
      : false;
  }

  function isSelectModeActive() {
    try { return !!isSelectMode; } catch (err) { return false; }
  }

  function getTargetCardIds() {
    if (!isSelectModeActive()) return [];

    try {
      if (selectedCards && selectedCards.size > 0) return Array.from(selectedCards).map(String);
    } catch (err) {}

    return getDeckCards().map(w => String(w.id));
  }

  function ensureCleanModal() {
    injectStyles();

    let modal = document.getElementById(CLEAN_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = CLEAN_MODAL_ID;
    modal.className = 'overlay';
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:12px;">
          <div>
            <div class="sh-title">Clean Cards</div>
            <div id="wordjarCleanCardsSub" class="wordjar-clean-modal-sub">Choose fields to clear. Word text will always be kept.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeWordJarCleanCardsModal()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="wordjar-clean-options">
          ${CLEAN_FIELDS.map(item => `
            <label class="wordjar-clean-option">
              <input class="wordjar-clean-check" type="checkbox" value="${item.key}" checked>
              <span>${item.label}</span>
            </label>
          `).join('')}
        </div>

        <div class="wordjar-clean-actions">
          <button class="btn btn-s" type="button" onclick="closeWordJarCleanCardsModal()">Cancel</button>
          <button class="btn btn-p" type="button" onclick="applyWordJarCleanCardsFromModal()">Clean</button>
        </div>
      </div>
    `;

    modal.addEventListener('click', event => {
      if (event.target === modal) closeWordJarCleanCardsModal();
    });

    document.body.appendChild(modal);
    return modal;
  }

  function selectedCleanFields() {
    return Array.from(document.querySelectorAll(`#${CLEAN_MODAL_ID} .wordjar-clean-check:checked`))
      .map(input => input.value)
      .filter(Boolean);
  }

  function closeWordJarCleanCardsModal() {
    document.getElementById(CLEAN_MODAL_ID)?.classList.remove('open');
  }

  function openCleanCardsModal() {
    const targetIds = getTargetCardIds();
    if (!targetIds.length) {
      safeToast('No cards available');
      return;
    }

    const modal = ensureCleanModal();
    const sub = document.getElementById('wordjarCleanCardsSub');
    const allMode = isAllMode();
    if (sub) {
      sub.textContent = allMode
        ? `Clean all ${targetIds.length} cards. Word text will always be kept.`
        : `Clean ${targetIds.length} selected cards. Word text will always be kept.`;
    }

    modal.classList.add('open');
  }

  function clearField(card, field) {
    if (!card) return false;

    const map = {
      type: ['type'],
      pronunciation: ['pronunciation'],
      meaning: ['meaning'],
      synonyms: ['synonyms', 'synonym'],
      example: ['example'],
      notes: ['notes'],
      extras: ['tags', 'source', 'audio', 'image']
    };

    const fields = map[field] || [];
    let changed = false;

    fields.forEach(key => {
      if (card[key] !== undefined && card[key] !== '' && card[key] !== null) {
        if (Array.isArray(card[key])) card[key] = [];
        else card[key] = '';
        changed = true;
      }
    });

    return changed;
  }

  function cleanWordCard(card, fields) {
    if (!card) return false;
    let changed = false;
    fields.forEach(field => {
      if (clearField(card, field)) changed = true;
    });
    return changed;
  }

  function applyWordJarCleanCardsFromModal() {
    const targetIds = getTargetCardIds();
    const fields = selectedCleanFields();

    if (!targetIds.length) {
      closeWordJarCleanCardsModal();
      safeToast('No cards available');
      return;
    }

    if (!fields.length) {
      safeToast('Select at least one field to clean');
      return;
    }

    const idSet = new Set(targetIds.map(String));
    let cleaned = 0;

    D.words.forEach(card => {
      if (idSet.has(String(card.id)) && cleanWordCard(card, fields)) cleaned++;
    });

    closeWordJarCleanCardsModal();

    if (typeof save === 'function') save();
    if (typeof renderDeckCards === 'function') renderDeckCards();
    if (typeof renderWords === 'function') renderWords();
    if (typeof renderDecks === 'function') renderDecks();
    if (typeof updateHome === 'function') updateHome();
    if (typeof updateSelectActions === 'function') setTimeout(updateSelectActions, 0);

    safeToast(cleaned ? `${cleaned} cards cleaned` : 'Cards already clean');
  }

  function ensureCleanButton() {
    const buttonsWrap = document.querySelector('#cardSelectActions .select-action-buttons');
    if (!buttonsWrap) return;

    let cleanBtn = document.getElementById('btnCleanSelectedCards');
    if (!cleanBtn) {
      cleanBtn = document.createElement('button');
      cleanBtn.id = 'btnCleanSelectedCards';
      cleanBtn.className = 'btn wordjar-clean-cards-btn';
      cleanBtn.type = 'button';
      cleanBtn.onclick = openCleanCardsModal;

      const fillBtn = document.getElementById('btnAutoFillSelectedCards');
      if (fillBtn) fillBtn.insertAdjacentElement('afterend', cleanBtn);
      else buttonsWrap.appendChild(cleanBtn);
    }
  }

  function updateActionLabels() {
    const allMode = isAllMode();
    const targetCount = getTargetCardIds().length;
    const cleanBtn = document.getElementById('btnCleanSelectedCards');
    const smartBtn = document.getElementById('btnSmartFillSelectedCards');

    if (cleanBtn) {
      cleanBtn.textContent = allMode ? 'Clean All' : 'Clean';
      cleanBtn.disabled = !isSelectModeActive() || targetCount === 0;
      cleanBtn.onclick = openCleanCardsModal;
    }

    if (smartBtn && !/^\d+\/\d+$/.test(String(smartBtn.textContent || '').trim()) && smartBtn.textContent !== 'AI...' && smartBtn.textContent !== 'Pro...') {
      smartBtn.textContent = allMode ? 'Smart All' : 'Smart';
      smartBtn.disabled = !isSelectModeActive() || targetCount === 0;
    }
  }

  function mountActions() {
    injectStyles();
    ensureCleanButton();
    updateActionLabels();
  }

  function patchUpdateSelectActions() {
    if (window.__wordjarDeckCleanSmartUpdatePatchedV2) return;
    if (typeof window.updateSelectActions !== 'function') return;

    const original = window.updateSelectActions;
    window.__wordjarDeckCleanSmartUpdatePatchedV2 = true;

    window.updateSelectActions = function updateSelectActionsWithCleanSmart() {
      const result = original.apply(this, arguments);
      setTimeout(mountActions, 0);
      return result;
    };
  }

  function patchRenderDeckCards() {
    if (window.__wordjarDeckCleanSmartRenderPatchedV2) return;
    if (typeof window.renderDeckCards !== 'function') return;

    const original = window.renderDeckCards;
    window.__wordjarDeckCleanSmartRenderPatchedV2 = true;

    window.renderDeckCards = function renderDeckCardsWithCleanSmart() {
      const result = original.apply(this, arguments);
      setTimeout(mountActions, 0);
      return result;
    };
  }

  function boot() {
    patchUpdateSelectActions();
    patchRenderDeckCards();
    mountActions();
  }

  window.closeWordJarCleanCardsModal = closeWordJarCleanCardsModal;
  window.applyWordJarCleanCardsFromModal = applyWordJarCleanCardsFromModal;
  window.cleanSelectedCards = openCleanCardsModal;
  window.WordJarDeckCleanSmartActions = {
    cleanSelectedCards: openCleanCardsModal,
    applyWordJarCleanCardsFromModal,
    cleanWordCard,
    mountActions
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 350);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();
