// WordJar Deck UI V2
// Owns compact account System Deck setting and long-press deck reordering.

(function installWordJarDeckUI() {
  if (window.__wordjarDeckUIInstalled) return;
  window.__wordjarDeckUIInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const REORDER_CLASS = 'wordjar-deck-reordering';
  const DRAGGING_CLASS = 'wordjar-deck-dragging';
  const HINT_ID = 'wordjarDeckReorderHint';

  function ensureSettings() {
    D.settings = D.settings || {};
    if (D.settings.showSystemNoDeck === undefined) D.settings.showSystemNoDeck = true;
  }

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
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
  installAccountSettingsHook();
  injectSystemDeckSettingsRow();
  removeLegacySystemDeckCard();
  setTimeout(removeLegacySystemDeckCard, 0);
  setTimeout(removeLegacySystemDeckCard, 300);
  installRenderDecksHook();
  installDeckReorder();
})();
