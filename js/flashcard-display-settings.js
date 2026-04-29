// WordJar Flashcard Display Settings V3
// Lets users choose which optional fields appear on flashcards.
// Standard word field order: Meaning → Synonyms → Example → Notes.

(function installFlashcardDisplaySettings() {
  if (window.__wordjarFlashcardDisplayInstalledV3) return;
  window.__wordjarFlashcardDisplayInstalledV3 = true;

  const DEFAULTS = {
    showDeck: true,
    showType: true,
    showPronunciation: true,
    showMeaning: true,
    showSynonyms: true,
    showExample: true,
    showNotes: true,
    showLevel: true
  };

  function ensureSettings() {
    D.settings = D.settings || {};
    D.settings.flashcardDisplay = D.settings.flashcardDisplay || {};
    Object.keys(DEFAULTS).forEach(key => {
      if (D.settings.flashcardDisplay[key] === undefined) D.settings.flashcardDisplay[key] = DEFAULTS[key];
    });
  }

  function safeText(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function parseSynonyms(value) {
    if (Array.isArray(value)) return value.filter(Boolean).slice(0, 8);
    return String(value || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
  }

  function deckName(deckId) {
    if (typeof getDeckName === 'function') return getDeckName(deckId);
    return D.decks.find(d => String(d.id) === String(deckId))?.name || '';
  }

  function injectStyles() {
    const oldStyle = document.getElementById('flashcardDisplayStyle');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'flashcardDisplayStyle';
    style.textContent = `
      .wordjar-fc-syn-section { margin-top: 18px; margin-bottom: 18px; }
      .wordjar-fc-syn-section .ans-label { margin-bottom: 10px; }
      .wordjar-fc-syn-row { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-start; align-items:center; }
      .wordjar-fc-syn-chip { display:inline-flex; align-items:center; justify-content:center; min-height:34px; padding:0 13px; border-radius:999px; border:1px solid var(--bdr); background:var(--sur2); color:var(--ink2); font-size:13px; font-weight:800; line-height:1; }
      #fcMeaning { margin-bottom: 2px; }
      #fcExWrap { margin-top: 18px; }
      #fcNtWrap { margin-top: 18px; }
      #fcExWrap .ans-label, #fcNtWrap .ans-label { margin-bottom: 10px; }
      .settings-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 0; border-top:1px solid var(--bdr); }
      .settings-toggle-row:first-of-type { border-top:0; padding-top:2px; }
      .settings-toggle-text { min-width:0; }
      .settings-toggle-title { font-size:13px; font-weight:800; color:var(--ink); }
      .settings-toggle-desc { font-size:12px; color:var(--ink2); margin-top:4px; line-height:1.35; }
      .settings-inline-note { color:var(--ink2); font-size:12px; line-height:1.4; margin:0 0 12px; }
    `;
    document.head.appendChild(style);
  }

  function toggleRow(key, title, desc) {
    const checked = D.settings.flashcardDisplay[key] !== false ? 'checked' : '';
    return `
      <div class="settings-toggle-row">
        <div class="settings-toggle-text">
          <div class="settings-toggle-title">${title}</div>
          <div class="settings-toggle-desc">${desc}</div>
        </div>
        <label class="switch" style="flex-shrink:0;"><input type="checkbox" data-fc-display-toggle="${key}" ${checked}><span class="slider"></span></label>
      </div>
    `;
  }

  function ensureModal() {
    let modal = document.getElementById('flashcardDisplayModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'flashcardDisplayModal';
    modal.className = 'overlay';
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('flashcardDisplayModal');
    });
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">Flashcard Display</div>
            <div class="modal-subtitle" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;">Choose what appears on review cards.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('flashcardDisplayModal')" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="settings-inline-note">Scheduling is unchanged. These switches only control what is shown during review.</div>
        <div id="flashcardDisplayBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderModalBody() {
    ensureSettings();
    const body = document.getElementById('flashcardDisplayBody');
    if (!body) return;
    body.innerHTML = `
      ${toggleRow('showDeck', 'Deck tag', 'Show which deck the card belongs to.')}
      ${toggleRow('showType', 'Part of speech', 'Show N, V, ADJ, phrase, and similar tags.')}
      ${toggleRow('showPronunciation', 'Pronunciation', 'Show IPA or pronunciation text.')}
      ${toggleRow('showMeaning', 'Meaning', 'Show the main definition on the back.')}
      ${toggleRow('showSynonyms', 'Synonyms', 'Show synonym chips after the meaning.')}
      ${toggleRow('showExample', 'Example sentence', 'Show the example/context sentence.')}
      ${toggleRow('showNotes', 'Notes', 'Show notes saved on the card.')}
      ${toggleRow('showLevel', 'Vocabulary level', 'Show A1-C1 level when available.')}
    `;

    body.querySelectorAll('[data-fc-display-toggle]').forEach(input => {
      input.onchange = () => {
        D.settings.flashcardDisplay[input.dataset.fcDisplayToggle] = input.checked;
        save();
        if (curPage === 'fc' && typeof renderFC === 'function') renderFC();
        toast('Flashcard display saved');
      };
    });
  }

  window.openFlashcardDisplayModal = function openFlashcardDisplayModal() {
    ensureSettings();
    injectStyles();
    ensureModal();
    renderModalBody();
    openO('flashcardDisplayModal');
  };

  function injectSettingsRow() {
    const account = document.getElementById('pg-account');
    const menu = account?.querySelector('.menu-sec');
    if (!menu || document.getElementById('flashcardDisplayRow')) return;

    const row = document.createElement('div');
    row.className = 'mr';
    row.id = 'flashcardDisplayRow';
    row.onclick = () => openFlashcardDisplayModal();
    row.innerHTML = `<div class="ml">Flashcard Display</div><div class="ma"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg></div>`;
    menu.appendChild(row);
  }

  function insertSynonymsAfterMeaning(w, settings) {
    document.querySelectorAll('.fc-extra-row, .wordjar-fc-syn-section').forEach(el => el.remove());
    if (settings.showSynonyms === false) return;

    const syns = parseSynonyms(w.synonyms || w.synonym || '');
    if (!syns.length) return;

    const section = document.createElement('div');
    section.className = 'wordjar-fc-syn-section';
    section.innerHTML = `
      <div class="ans-label">Synonyms:</div>
      <div class="wordjar-fc-syn-row">
        ${syns.map(x => `<span class="wordjar-fc-syn-chip">${safeText(x)}</span>`).join('')}
      </div>
    `;

    const meaning = document.getElementById('fcMeaning');
    if (meaning) meaning.insertAdjacentElement('afterend', section);
  }

  function applyVisibility() {
    ensureSettings();
    const s = D.settings.flashcardDisplay;
    const w = Array.isArray(fcQ) ? fcQ[fcI] : null;
    if (!w) return;

    const tagF = document.getElementById('fcTagsF');
    const tagB = document.getElementById('fcTagsB');
    if (tagF || tagB) {
      const parts = [];
      if (s.showDeck) parts.push(`<div class="tag-pill">${safeText(deckName(w.deckId))}</div>`);
      if (s.showType) parts.push(`<div class="tag-pill">${safeText((w.type || 'N').split(',')[0].toUpperCase())}</div>`);
      if (s.showLevel && w.level) parts.push(`<div class="tag-pill">${safeText(w.level)}</div>`);
      if (tagF) tagF.innerHTML = parts.join('');
      if (tagB) tagB.innerHTML = parts.join('');
    }

    ['fcPronF', 'fcPronB'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = s.showPronunciation === false ? 'none' : '';
    });

    const meaning = document.getElementById('fcMeaning');
    if (meaning) meaning.style.display = s.showMeaning === false ? 'none' : '';

    insertSynonymsAfterMeaning(w, s);

    const exWrap = document.getElementById('fcExWrap');
    if (exWrap) exWrap.style.display = s.showExample === false || !w.example ? 'none' : 'block';

    const ntWrap = document.getElementById('fcNtWrap');
    if (ntWrap) ntWrap.style.display = s.showNotes === false || !w.notes || String(w.notes).trim() === '-' ? 'none' : 'block';
  }

  const originalRenderFC = window.renderFC;
  window.renderFC = function renderFCWithDisplaySettings() {
    if (typeof originalRenderFC === 'function') originalRenderFC();
    applyVisibility();
  };

  const originalUpdateAccount = window.__wordjarOriginalUpdateAccountForFlashcardDisplay || window.updateAccount;
  window.__wordjarOriginalUpdateAccountForFlashcardDisplay = originalUpdateAccount;
  window.updateAccount = function updateAccountWithFlashcardDisplay() {
    if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
    injectSettingsRow();
  };

  ensureSettings();
  injectStyles();
  setTimeout(injectSettingsRow, 0);
})();
