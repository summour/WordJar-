// WordJar Deck UI V2
// Owns compact account System Deck setting, deck modal color theme, and long-press deck reordering.

(function installWordJarDeckUI() {
  if (window.__wordjarDeckUIInstalled) return;
  window.__wordjarDeckUIInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const REORDER_CLASS = 'wordjar-deck-reordering';
  const DRAGGING_CLASS = 'wordjar-deck-dragging';
  const HINT_ID = 'wordjarDeckReorderHint';
  const DECK_COLOR_PREVIEW_CLASS = 'ที่WordJar-deck-color-preview';
  const DECK_COLOR_PREVIEW_FILL_CLASS = 'ที่WordJar-deck-color-preview-fill';
  const STANDARD_DECK_COLORS = ['#09090b', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6'];

  function ensureSettings() {
    D.settings = D.settings || {};
    if (D.settings.showSystemNoDeck === undefined) D.settings.showSystemNoDeck = true;
  }

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
  }

  function normalizeColor(color) {
    return String(color || '#09090b').trim().toLowerCase();
  }

  function removeLegacySystemDeckCard() {
    document.querySelectorAll('#systemDeckSettingsCard').forEach(card => card.remove());
  }

  function watchLegacySystemDeckCard() {
    const accountPage = document.getElementById('pg-account');
    if (!accountPage || accountPage.__wordjarSystemDeckCleanupObserver) return;

    const observer = new MutationObserver(() => removeLegacySystemDeckCard());
    observer.observe(accountPage, { childList: true, subtree: true });
    accountPage.__wordjarSystemDeckCleanupObserver = observer;
  }

  function injectStyles() {
    if (document.getElementById('wordjarDeckUiStyle')) return;

    const style = document.createElement('style');
    style.id = 'wordjarDeckUiStyle';
    style.textContent = `
      .settings-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 0; border-top:1px solid var(--bdr); }
      .settings-toggle-row:first-of-type { border-top:0; padding-top:2px; }
      .settings-toggle-text { min-width:0; }
      .settings-toggle-title { font-size:13px; font-weight:800; color:var(--ink); }
      .settings-toggle-desc { font-size:12px; color:var(--ink2); margin-top:4px; line-height:1.35; }
      .settings-inline-note { color:var(--ink2); font-size:12px; line-height:1.4; margin:0 0 12px; }

      #deckModal .deck-color-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: nowrap;
        padding: 8px 2px 10px;
        overflow-x: auto;
        scrollbar-width: none;
      }

      #deckModal .deck-color-row::-webkit-scrollbar {
        display: none;
      }

      #deckModal .deck-color-row .csw,
      #deckModal .deck-color-row .custom-color-btn {
        width: 36px;
        height: 36px;
        min-width: 36px;
        border-radius: 50%;
        cursor: pointer;
        position: relative;
        border: 2px solid #e5e7eb;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .10);
        transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
      }

      #deckModal .deck-color-row .csw.sel,
      #deckModal .deck-color-row .custom-color-btn.sel {
        transform: none;
        border-color: #e5e7eb;
        box-shadow: 0 0 0 3px #ffffff, 0 0 0 5px #09090b, 0 2px 8px rgba(0, 0, 0, .10);
      }

      #deckModal .deck-color-row .custom-color-btn {
        background: #ffffff;
        border-style: solid;
        color: var(--ink);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      #deckModal .deck-color-row .custom-color-btn::before {
        content: '';
        width: 14px;
        height: 14px;
        background: currentColor;
        transform: rotate(-45deg);
        clip-path: polygon(45% 0, 65% 0, 65% 70%, 55% 100%, 45% 70%);
        opacity: .82;
        pointer-events: none;
      }

      #deckModal .deck-color-row .custom-color-btn input[type='color'] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }

      #deckModal .${DECK_COLOR_PREVIEW_CLASS} {
        height: 44px;
        margin-top: 4px;
        padding: 6px;
        border-radius: 999px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        box-shadow: 0 1px 0 rgba(255, 255, 255, .9) inset;
      }

      #deckModal .${DECK_COLOR_PREVIEW_FILL_CLASS} {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        background: var(--ที่WordJar-deck-color, #09090b);
        transition: background .18s ease;
      }

      #deckList .deck-card {
        touch-action: pan-y;
      }

      body.${REORDER_CLASS} {
        user-select: none;
        -webkit-user-select: none;
        cursor: grabbing;
      }

      body.${REORDER_CLASS} #deckList {
        touch-action: none;
      }

      body.${REORDER_CLASS} #deckList .deck-card {
        cursor: grabbing;
      }

      #deckList .deck-card.${DRAGGING_CLASS} {
        position: relative;
        z-index: 40;
        opacity: .9;
        transform: scale(.985);
        box-shadow: 0 18px 42px rgba(0, 0, 0, .14);
      }

      #deckList .deck-gear,
      #deckList .deck-gear * {
        pointer-events: auto;
      }

      .wordjar-deck-reorder-hint {
        position: fixed;
        left: 50%;
        bottom: calc(22px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        z-index: 3000;
        padding: 9px 13px;
        border-radius: 999px;
        background: rgba(255, 255, 255, .96);
        border: 1px solid var(--bdr);
        color: var(--ink);
        font-size: 12px;
        font-weight: 800;
        box-shadow: 0 12px 32px rgba(0, 0, 0, .12);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function syncDeckColorPreview(color) {
    const modal = document.getElementById('deckModal');
    if (!modal) return;

    const safeColor = normalizeColor(color || window.selDCol);
    modal.style.setProperty('--ที่WordJar-deck-color', safeColor);

    const customBtn = document.getElementById('customColorWrapper');
    if (!customBtn) return;

    const isPreset = STANDARD_DECK_COLORS.includes(safeColor);
    customBtn.classList.toggle('sel', !isPreset);
    customBtn.style.borderColor = isPreset ? '#e5e7eb' : safeColor;
  }

  function ensureDeckColorPreview() {
    const colorRow = document.querySelector('#deckModal .deck-color-row');
    if (!colorRow) return;

    STANDARD_DECK_COLORS.forEach(color => {
      const exists = colorRow.querySelector(`.csw[data-c="${color}"]`);
      if (exists) return;

      const customButton = document.getElementById('customColorWrapper');
      const swatch = document.createElement('div');
      swatch.className = 'csw';
      swatch.dataset.c = color;
      swatch.style.background = color;
      swatch.addEventListener('click', () => window.selDC?.(color));
      colorRow.insertBefore(swatch, customButton || null);
    });

    const customButton = document.getElementById('customColorWrapper');
    if (customButton) customButton.setAttribute('aria-label', 'Choose custom deck color');

    if (!colorRow.parentElement.querySelector(`.${DECK_COLOR_PREVIEW_CLASS}`)) {
      const preview = document.createElement('div');
      preview.className = DECK_COLOR_PREVIEW_CLASS;
      preview.innerHTML = `<div class="${DECK_COLOR_PREVIEW_FILL_CLASS}"></div>`;
      colorRow.insertAdjacentElement('afterend', preview);
    }

    syncDeckColorPreview(window.selDCol || '#09090b');
  }

  function installDeckColorThemeHook() {
    if (window.__wordjarDeckColorThemeHookInstalled) return;
    window.__wordjarDeckColorThemeHookInstalled = true;

    const originalSelDC = window.selDC;
    if (typeof originalSelDC === 'function') {
      window.selDC = function selectDeckColorWithPreview(colorHex) {
        originalSelDC.apply(this, arguments);
        ensureDeckColorPreview();
        syncDeckColorPreview(colorHex);
      };
    }

    const originalOpenDeckModal = window.openDeckModal;
    if (typeof originalOpenDeckModal === 'function') {
      window.openDeckModal = function openDeckModalWithCalendarStyleColorPicker() {
        originalOpenDeckModal.apply(this, arguments);
        ensureDeckColorPreview();
        syncDeckColorPreview(window.selDCol || '#09090b');
      };
    }

    document.addEventListener('DOMContentLoaded', ensureDeckColorPreview);
    ensureDeckColorPreview();
  }

  function ensureSystemDeckModal() {
    let modal = document.getElementById('systemDeckSettingsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'systemDeckSettingsModal';
    modal.className = 'overlay';
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('systemDeckSettingsModal');
    });
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">System Deck</div>
            <div class="modal-subtitle" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;">Control the protected No Deck system deck.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('systemDeckSettingsModal')" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="settings-inline-note">No Deck collects cards without a user deck. It can be hidden, but it cannot be deleted.</div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-text">
            <div class="settings-toggle-title">Show No Deck</div>
            <div class="settings-toggle-desc">Show or hide the protected system deck on the Decks page.</div>
          </div>
          <label class="switch" style="flex-shrink:0;"><input type="checkbox" id="showSystemNoDeckToggle"><span class="slider"></span></label>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function refreshSystemDeckModal() {
    ensureSettings();
    ensureSystemDeckModal();

    const toggle = document.getElementById('showSystemNoDeckToggle');
    if (!toggle) return;

    toggle.checked = D.settings.showSystemNoDeck !== false;
    toggle.onchange = () => {
      D.settings.showSystemNoDeck = toggle.checked;
      if (typeof normalizeWordDeckIds === 'function') normalizeWordDeckIds();
      save();

      if (typeof renderDecks === 'function') renderDecks();

      const shouldLeaveHiddenSystemDeck =
        !toggle.checked &&
        isNoDeck(currentStudyDeckId) &&
        (curPage === 'deck-overview' || curPage === 'deck-cards');

      if (shouldLeaveHiddenSystemDeck) nav('decks');

      toast(toggle.checked ? 'No Deck shown' : 'No Deck hidden');
    };
  }

  window.openSystemDeckSettingsModal = function openSystemDeckSettingsModal() {
    injectStyles();
    refreshSystemDeckModal();
    openO('systemDeckSettingsModal');
  };

  function injectSystemDeckSettingsRow() {
    ensureSettings();
    injectStyles();
    removeLegacySystemDeckCard();
    watchLegacySystemDeckCard();

    const accountPage = document.getElementById('pg-account');
    const menu = accountPage?.querySelector('.menu-sec');
    if (!menu) return;

    let row = document.getElementById('systemDeckSettingsRow');
    if (!row) {
      row = document.createElement('div');
      row.className = 'mr';
      row.id = 'systemDeckSettingsRow';
      row.onclick = () => openSystemDeckSettingsModal();
      row.innerHTML = `<div class="ml">System Deck</div><div class="ma"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg></div>`;
      menu.appendChild(row);
    }
  }

  function installAccountSettingsHook() {
    const originalUpdateAccount = window.__wordjarOriginalUpdateAccount || window.updateAccount;
    window.__wordjarOriginalUpdateAccount = originalUpdateAccount;

    window.updateAccount = function updateAccountWithSystemDeckSetting() {
      if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
      injectSystemDeckSettingsRow();
      setTimeout(removeLegacySystemDeckCard, 0);
      setTimeout(removeLegacySystemDeckCard, 200);
    };
  }

  function getDeckIdFromCard(card) {
    const dataId = card?.dataset?.deckId;
    if (dataId) return String(dataId);

    const clickAttr = card?.getAttribute?.('onclick') || '';
    const match = clickAttr.match(/showDeckOverview\(['"](.+?)['"]\)/);
    return match ? String(match[1]) : '';
  }

  function prepareDeckCardsForReorder() {
    const cards = document.querySelectorAll('#deckList .deck-card');
    cards.forEach(card => {
      const deckId = getDeckIdFromCard(card);
      if (!deckId) return;

      card.dataset.deckId = deckId;
      card.classList.add('wordjar-deck-reorderable');
      card.classList.toggle(DRAGGING_CLASS, String(window.__wordjarDraggingDeckId || '') === deckId);
    });
  }

  function installRenderDecksHook() {
    if (window.__wordjarDeckRenderHookInstalled) return;
    window.__wordjarDeckRenderHookInstalled = true;

    const hook = () => setTimeout(prepareDeckCardsForReorder, 0);
    const originalRenderDecks = window.renderDecks;

    if (typeof originalRenderDecks === 'function') {
      window.renderDecks = function renderDecksWithReorder() {
        originalRenderDecks.apply(this, arguments);
        prepareDeckCardsForReorder();
      };
    }

    hook();
    document.addEventListener('DOMContentLoaded', hook);
  }

  function moveDeckBefore(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return false;

    const from = D.decks.findIndex(deck => String(deck.id) === String(sourceId));
    const to = D.decks.findIndex(deck => String(deck.id) === String(targetId));

    if (from < 0 || to < 0 || from === to) return false;

    const [sourceDeck] = D.decks.splice(from, 1);
    D.decks.splice(to, 0, sourceDeck);
    save();

    return true;
  }

  function getDeckCardFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el?.closest?.('#deckList .deck-card') || null;
  }

  function showReorderHint() {
    let hint = document.getElementById(HINT_ID);
    if (!hint) {
      hint = document.createElement('div');
      hint.id = HINT_ID;
      hint.className = 'wordjar-deck-reorder-hint';
      document.body.appendChild(hint);
    }

    hint.textContent = 'Drag to reorder decks';
    hint.hidden = false;
  }

  function hideReorderHint() {
    const hint = document.getElementById(HINT_ID);
    if (hint) hint.hidden = true;
  }

  function installDeckReorder() {
    if (window.__wordjarDeckReorderInstalled) return;
    window.__wordjarDeckReorderInstalled = true;

    let pressTimer = null;
    let pressState = null;
    let dragState = null;
    let suppressClick = false;

    function clearPressTimer() {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressState = null;
    }

    function startDrag() {
      if (!pressState?.card || !pressState.deckId) return;

      dragState = {
        pointerId: pressState.pointerId,
        deckId: pressState.deckId,
        changed: false
      };

      window.__wordjarDraggingDeckId = dragState.deckId;
      document.body.classList.add(REORDER_CLASS);
      showReorderHint();
      prepareDeckCardsForReorder();

      const activeCard = document.querySelector(`#deckList .deck-card[data-deck-id="${CSS.escape(dragState.deckId)}"]`);
      if (activeCard?.setPointerCapture) {
        try { activeCard.setPointerCapture(dragState.pointerId); } catch (err) {}
      }
    }

    function finishDrag() {
      clearPressTimer();

      if (!dragState) return;

      const changed = dragState.changed;
      dragState = null;
      window.__wordjarDraggingDeckId = '';
      document.body.classList.remove(REORDER_CLASS);
      hideReorderHint();

      if (typeof renderDecks === 'function') renderDecks();
      else prepareDeckCardsForReorder();

      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 220);

      if (changed) toast('Deck order saved');
    }

    document.addEventListener('pointerdown', event => {
      if (curPage !== 'decks') return;

      const card = event.target.closest?.('#deckList .deck-card');
      if (!card) return;
      if (event.target.closest?.('.deck-gear, button, a, input, select, textarea')) return;
      if (event.button !== undefined && event.button !== 0) return;

      const deckId = getDeckIdFromCard(card);
      if (!deckId) return;

      clearPressTimer();
      prepareDeckCardsForReorder();

      pressState = {
        card,
        deckId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      };

      pressTimer = setTimeout(startDrag, 320);
    }, true);

    document.addEventListener('pointermove', event => {
      if (pressState && !dragState) {
        const dx = Math.abs(event.clientX - pressState.startX);
        const dy = Math.abs(event.clientY - pressState.startY);
        if (dx > 10 || dy > 10) clearPressTimer();
        return;
      }

      if (!dragState || event.pointerId !== dragState.pointerId) return;

      event.preventDefault();

      const targetCard = getDeckCardFromPoint(event.clientX, event.clientY);
      const targetId = getDeckIdFromCard(targetCard);

      if (targetId && moveDeckBefore(dragState.deckId, targetId)) {
        dragState.changed = true;

        if (typeof renderDecks === 'function') renderDecks();
        else prepareDeckCardsForReorder();
      }
    }, { capture: true, passive: false });

    document.addEventListener('pointerup', event => {
      if (dragState && event.pointerId === dragState.pointerId) finishDrag();
      else clearPressTimer();
    }, true);

    document.addEventListener('pointercancel', event => {
      if (dragState && event.pointerId === dragState.pointerId) finishDrag();
      else clearPressTimer();
    }, true);

    document.addEventListener('click', event => {
      if (!suppressClick) return;
      if (!event.target.closest?.('#deckList .deck-card')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
  }

  injectStyles();
  installDeckColorThemeHook();
  installAccountSettingsHook();
  injectSystemDeckSettingsRow();
  removeLegacySystemDeckCard();
  setTimeout(removeLegacySystemDeckCard, 0);
  setTimeout(removeLegacySystemDeckCard, 300);
  installRenderDecksHook();
  installDeckReorder();
})();
