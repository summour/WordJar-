// WordJar Share Card Options Complete V10
// Compact share options modal + Synonyms option support + preview restored.

(function installWordJarShareCardOptionsComplete() {
  if (window.__wordjarShareCardOptionsCompleteInstalledV10) return;
  window.__wordjarShareCardOptionsCompleteInstalledV10 = true;

  const STYLE_ID = 'wordjarShareCardOptionsCompleteStyleV10';
  const SYN_OPTION_ID = 'shareOptSynonyms';
  const SYN_WRAP_ID = 'shareCardSynonymsWrap';
  const SYN_LIST_ID = 'shareCardSynonyms';

  function injectStyles() {
    document.getElementById('wordjarShareCardOptionsCompleteStyleV9')?.remove();
    document.getElementById('wordjarShareCardOptionsCompleteStyleV8')?.remove();
    document.getElementById('wordjarShareCardOptionsCompleteStyleV7')?.remove();
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #shareAdjustModal.overlay {
        background: rgba(0,0,0,.50);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
      }

      #shareAdjustModal .share-options-toggle,
      #shareAdjustModal .share-adjust-note {
        display: none;
      }

      #shareAdjustModal .wordjar-share-shell,
      #shareAdjustModal .share-preview-box {
        display: block;
        margin: 0 0 18px;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        filter: none;
      }

      #shareAdjustModal #sharePreviewMount {
        display: block;
        width: 100%;
        min-height: 180px;
        overflow: hidden;
        border: 1px solid #e5e5ea;
        border-radius: 20px;
        background: #f5f5f7;
        box-shadow: none;
        filter: none;
      }

      #shareAdjustModal #shareCardPreview.share-card-preview-clone,
      #shareAdjustModal #shareCardPreview.share-card-preview-clone * {
        box-shadow: none;
        text-shadow: none;
        filter: none;
      }

      #shareAdjustModal .share-adjust-modal,
      #shareAdjustModal .modal-card.share-adjust-modal {
        width: min(calc(100vw - 42px), 360px);
        max-width: 360px;
        max-height: min(88vh, 760px);
        padding: 26px 28px 22px;
        border-radius: 22px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        box-shadow: none;
      }

      #shareAdjustModal .share-adjust-modal::-webkit-scrollbar,
      #shareAdjustModal .modal-card.share-adjust-modal::-webkit-scrollbar {
        width: 0;
        height: 0;
      }

      #shareAdjustModal #shareOptionsPanel,
      #shareAdjustModal #shareOptionsPanel.open {
        display: block;
      }

      #shareAdjustModal #shareOptionsPanel,
      #shareAdjustModal #shareOptionsPanel * {
        box-shadow: none;
        text-shadow: none;
        filter: none;
      }

      #shareAdjustModal .share-adjust-section,
      #shareAdjustModal .settings-card,
      #shareAdjustModal .share-options-card,
      #shareAdjustModal .wordjar-share-option-group {
        border: 0;
        border-radius: 0;
        overflow: visible;
        margin: 0;
        background: transparent;
        box-shadow: none;
      }

      #shareAdjustModal .share-adjust-title,
      #shareAdjustModal .share-adjust-section-title,
      #shareAdjustModal .settings-card-title,
      #shareAdjustModal .wordjar-share-section-title {
        padding: 16px 0 10px;
        border: 0;
        background: transparent;
        color: #8e8e93;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: -0.01em;
        text-transform: none;
      }

      #shareAdjustModal .share-check-row,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row {
        min-height: 62px;
        padding: 10px 0;
        border-top: 0;
        border-bottom: 1px solid #e5e5ea;
        background: transparent;
        color: #111111;
        font-size: 15px;
        line-height: 1.25;
        font-weight: 750;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        box-shadow: none;
      }

      #shareAdjustModal .share-check-row:first-of-type,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row:first-of-type {
        border-top: 0;
      }

      #shareAdjustModal .share-check-row span,
      #shareAdjustModal .share-check-row .label,
      #shareAdjustModal .share-check-row .text,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row span {
        color: #111111;
        font-size: 15px;
        line-height: 1.25;
        font-weight: 750;
        letter-spacing: -0.02em;
      }

      #shareAdjustModal .share-check-row input[type="checkbox"],
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        flex: 0 0 46px;
        width: 46px;
        height: 28px;
        border: 0;
        border-radius: 999px;
        background: #d1d1d6;
        cursor: pointer;
        margin: 0;
        outline: none;
        box-shadow: none;
        transition: background-color .18s ease;
      }

      #shareAdjustModal .share-check-row input[type="checkbox"]::before,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"]::before {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0,0,0,.18);
        transform: translateX(0);
        transition: transform .18s ease;
      }

      #shareAdjustModal .share-check-row input[type="checkbox"]:checked,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"]:checked {
        background: #111111;
        background-image: none;
      }

      #shareAdjustModal .share-check-row input[type="checkbox"]:checked::before,
      #shareAdjustModal .wordjar-share-syn-option.share-check-row input[type="checkbox"]:checked::before {
        transform: translateX(18px);
      }

      #shareAdjustModal .form-row,
      #shareAdjustModal .share-adjust-actions {
        display: grid;
        grid-template-columns: 1fr 1.55fr;
        gap: 10px;
        margin-top: 18px;
      }

      #shareAdjustModal .form-row .btn,
      #shareAdjustModal .share-adjust-actions .btn,
      #shareAdjustModal button[id*="Share"],
      #shareAdjustModal button[id*="Cancel"] {
        min-height: 44px;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 850;
      }

      #shareCardSynonymsWrap {
        display: none;
        margin-top: 18px;
      }

      #shareCardSynonymsWrap .share-syn-title {
        margin: 0 0 10px;
        color: var(--ink);
        font-size: 15px;
        line-height: 1.3;
        font-weight: 650;
        letter-spacing: -0.01em;
      }

      #shareCardSynonyms {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }

      #shareCardSynonyms .share-syn-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border: 1px solid #d9d9de;
        border-radius: 999px;
        background: #f4f4f6;
        color: #6f6f78;
        font-size: 17px;
        line-height: 1;
        font-weight: 650;
        letter-spacing: -0.01em;
        box-shadow: none;
        white-space: nowrap;
      }
    `;

    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function splitSynonyms(value) {
    return clean(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  function getSynonymsOptionFallback() {
    try {
      const opt = typeof getShareCardOptions === 'function' ? getShareCardOptions() : {};
      return opt.synonyms !== false;
    } catch (err) {
      return true;
    }
  }

  function getSynonymsChecked() {
    const input = document.getElementById(SYN_OPTION_ID);
    return input ? !!input.checked : getSynonymsOptionFallback();
  }

  function findCardContentGroup() {
    const panel = document.getElementById('shareOptionsPanel');
    if (!panel) return null;

    const meaningInput = document.getElementById('shareOptMeaning');
    const notesInput = document.getElementById('shareOptNotes');
    return meaningInput?.closest('.share-adjust-section') ||
      notesInput?.closest('.share-adjust-section') ||
      meaningInput?.closest('.settings-card, .share-options-card, .wordjar-share-option-group, div') ||
      notesInput?.closest('.settings-card, .share-options-card, .wordjar-share-option-group, div') ||
      panel;
  }

  function closestShareRow(input) {
    return input?.closest?.('.share-check-row, label, .opt-row, .mr, .wordjar-share-option-row, div') || null;
  }

  function createSynonymsOption() {
    let row = document.getElementById(SYN_OPTION_ID)?.closest('.share-check-row, label');

    if (!row) {
      const group = findCardContentGroup();
      if (!group) return;

      row = document.createElement('label');
      row.className = 'share-check-row wordjar-share-syn-option';
      row.setAttribute('for', SYN_OPTION_ID);
      row.innerHTML = `
        <span>Synonyms</span>
        <input id="${SYN_OPTION_ID}" type="checkbox" ${getSynonymsOptionFallback() ? 'checked' : ''}>
      `;
      group.appendChild(row);

      row.addEventListener('click', event => {
        if (event.target.matches('input')) return;
        const input = document.getElementById(SYN_OPTION_ID);
        if (!input) return;
        event.preventDefault();
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      row.querySelector('input')?.addEventListener('change', () => {
        saveSynonymsOption();
        requestAnimationFrame(() => {
          if (typeof updateSharePreview === 'function') updateSharePreview();
        });
      });
    }

    moveSynonymsAfterMeaning();
  }

  function moveSynonymsAfterMeaning() {
    const synRow = document.getElementById(SYN_OPTION_ID)?.closest('.share-check-row, label');
    const meaningRow = closestShareRow(document.getElementById('shareOptMeaning'));
    if (!synRow || !meaningRow || !meaningRow.parentElement) return;

    if (meaningRow.nextElementSibling !== synRow) {
      meaningRow.insertAdjacentElement('afterend', synRow);
    }
  }

  function normalizeShareOptionRows() {
    const panel = document.getElementById('shareOptionsPanel');
    if (!panel) return;

    panel.querySelectorAll('label, .share-check-row').forEach(row => {
      if (!row.querySelector?.('input[type="checkbox"]')) return;
      row.classList.add('share-check-row');
      row.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
        input.addEventListener('change', () => {
          input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
        }, { passive: true });
      });
    });

    moveSynonymsAfterMeaning();
  }

  function ensureSynonymsWrap() {
    let wrap = document.getElementById(SYN_WRAP_ID);
    if (wrap) return wrap;

    const exampleWrap = document.getElementById('shareCardExampleWrap');
    const meaningWrap = document.getElementById('shareCardMeaningWrap');
    const anchor = exampleWrap || meaningWrap;
    if (!anchor) return null;

    wrap = document.createElement('div');
    wrap.id = SYN_WRAP_ID;
    wrap.innerHTML = `
      <div class="share-syn-title">Synonyms:</div>
      <div id="${SYN_LIST_ID}"></div>
    `;

    anchor.insertAdjacentElement('beforebegin', wrap);
    return wrap;
  }

  function renderSynonyms(w, options) {
    const wrap = ensureSynonymsWrap();
    if (!wrap) return;

    const list = document.getElementById(SYN_LIST_ID);
    if (!list) return;

    const synonyms = splitSynonyms(w?.synonyms || w?.syns || w?.similarWords || '');
    const shouldShow = options.synonyms !== false && synonyms.length > 0;

    wrap.style.display = shouldShow ? 'block' : 'none';

    if (!shouldShow) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = synonyms
      .map(item => `<span class="share-syn-pill">${escapeHTML(item)}</span>`)
      .join('');
  }

  function saveSynonymsOption() {
    if (typeof getShareCardOptions !== 'function' || typeof saveShareCardOptions !== 'function') return;
    const opt = getShareCardOptions();
    opt.synonyms = getSynonymsChecked();
    saveShareCardOptions(opt);
  }

  function patchOptions() {
    if (window.__wordjarShareSynOptionsPatchedV10) return;
    window.__wordjarShareSynOptionsPatchedV10 = true;

    if (typeof window.getShareCardOptions === 'function') {
      const originalGetShareCardOptions = window.getShareCardOptions;
      window.getShareCardOptions = function getShareCardOptionsWithSynonyms() {
        const opt = originalGetShareCardOptions.apply(this, arguments) || {};
        return { synonyms: true, ...opt };
      };
    }

    if (typeof window.getShareOptionsFromModal === 'function') {
      const originalGetShareOptionsFromModal = window.getShareOptionsFromModal;
      window.getShareOptionsFromModal = function getShareOptionsFromModalWithSynonyms() {
        const opt = originalGetShareOptionsFromModal.apply(this, arguments) || {};
        return { ...opt, synonyms: getSynonymsChecked() };
      };
    }

    if (typeof window.saveShareCardOptions === 'function') {
      const originalSaveShareCardOptions = window.saveShareCardOptions;
      window.saveShareCardOptions = function saveShareCardOptionsWithSynonyms(options) {
        return originalSaveShareCardOptions.call(this, { synonyms: true, ...(options || {}) });
      };
    }
  }

  function patchFillShareCard() {
    if (window.__wordjarShareFillSynPatchedV10) return;
    if (typeof window.fillShareCard !== 'function') return;

    const originalFillShareCard = window.fillShareCard;
    window.__wordjarShareFillSynPatchedV10 = true;

    window.fillShareCard = function fillShareCardWithSynonyms(w, options) {
      const mergedOptions = { synonyms: true, ...(options || {}) };
      const result = originalFillShareCard.call(this, w, mergedOptions);
      renderSynonyms(w, mergedOptions);
      return result;
    };
  }

  function patchOpenModal() {
    if (window.__wordjarShareOpenSynPatchedV10) return;
    if (typeof window.openShareAdjustModal !== 'function') return;

    const originalOpenShareAdjustModal = window.openShareAdjustModal;
    window.__wordjarShareOpenSynPatchedV10 = true;

    window.openShareAdjustModal = function openShareAdjustModalWithCompactOptions() {
      const result = originalOpenShareAdjustModal.apply(this, arguments);
      setTimeout(() => {
        createSynonymsOption();
        normalizeShareOptionRows();
        const synInput = document.getElementById(SYN_OPTION_ID);
        if (synInput) synInput.checked = getSynonymsOptionFallback();
        if (typeof updateSharePreview === 'function') updateSharePreview();
      }, 0);
      setTimeout(() => {
        if (typeof updateSharePreview === 'function') updateSharePreview();
      }, 80);
      return result;
    };
  }

  function bindLegacyOptionUpdates() {
    const modal = document.getElementById('shareAdjustModal');
    if (!modal || modal.dataset.wordjarShareSynBoundV10 === '1') return;
    modal.dataset.wordjarShareSynBoundV10 = '1';

    modal.addEventListener('change', event => {
      const target = event.target;
      if (!target || !target.matches('input[type="checkbox"], input[type="radio"], select')) return;
      if (target.matches('input[type="checkbox"]')) {
        target.setAttribute('aria-checked', target.checked ? 'true' : 'false');
      }
      requestAnimationFrame(() => {
        if (typeof updateSharePreview === 'function') updateSharePreview();
      });
    });

    modal.addEventListener('click', event => {
      const customize = event.target.closest('#shareOptionsToggle, [onclick*="toggleShareOptionsPanel"]');
      if (customize) {
        setTimeout(() => {
          createSynonymsOption();
          normalizeShareOptionRows();
          if (typeof updateSharePreview === 'function') updateSharePreview();
        }, 0);
      }
    }, true);
  }

  function boot() {
    injectStyles();
    patchOptions();
    patchFillShareCard();
    patchOpenModal();
    createSynonymsOption();
    normalizeShareOptionRows();
    bindLegacyOptionUpdates();

    if (document.getElementById('shareAdjustModal')?.classList.contains('open') && typeof updateSharePreview === 'function') {
      updateSharePreview();
    }
  }

  window.WordJarShareCardOptionsComplete = {
    boot,
    createSynonymsOption,
    renderSynonyms,
    normalizeShareOptionRows
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();
