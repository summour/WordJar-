// WordJar Dictionary Filter Smooth V1
// Prevents heavy page rerenders while choosing filters. Changes apply only when Apply is pressed.

(function installDictionaryFilterSmooth() {
  if (window.__wordjarDictionaryFilterSmoothInstalled) return;
  window.__wordjarDictionaryFilterSmoothInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const NO_DECK_NAME = typeof SYSTEM_NO_DECK_NAME !== 'undefined' ? SYSTEM_NO_DECK_NAME : 'No Deck';
  let draftFilters = null;

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

  function defaults() {
    return { type: '', starred: false, lang: 'all', deck: 'all', status: 'all', missing: 'all', sort: 'recent' };
  }

  function ensureFilters() {
    wordFilters = { ...defaults(), ...(wordFilters || {}) };
  }

  function cloneFilters(filters) {
    return { ...defaults(), ...(filters || {}) };
  }

  function deckName(deckId) {
    if (!deckId || String(deckId) === 'all') return 'All decks';
    if (String(deckId) === NO_DECK_ID) return NO_DECK_NAME;
    return D.decks.find(d => String(d.id) === String(deckId))?.name || NO_DECK_NAME;
  }

  function activeCount(filters = wordFilters) {
    const f = cloneFilters(filters);
    let n = 0;
    if (f.type) n++;
    if (f.starred) n++;
    if (f.lang !== 'all') n++;
    if (f.deck !== 'all') n++;
    if (f.status !== 'all') n++;
    if (f.missing !== 'all') n++;
    if (f.sort !== 'recent') n++;
    return n;
  }

  function summaryParts(filters = wordFilters) {
    const f = cloneFilters(filters);
    const parts = [];
    const typeLabel = { N:'Noun', V:'Verb', ADJ:'Adjective', ADV:'Adverb', ART:'Article', PRON:'Pronoun', PHR:'Phrase', IDM:'Idiom' };
    if (f.type) parts.push(typeLabel[f.type] || f.type);
    if (f.starred) parts.push('Starred');
    if (f.lang === 'en') parts.push('English');
    if (f.lang === 'ja') parts.push('Japanese');
    if (f.deck && f.deck !== 'all') parts.push(deckName(f.deck));
    if (f.status !== 'all') parts.push({ new:'New', learning:'Learning', due:'Due', review:'Review', scheduled:'Scheduled' }[f.status] || f.status);
    if (f.missing !== 'all') parts.push({ pronunciation:'No IPA', example:'No example', notes:'No notes', incomplete:'Incomplete' }[f.missing] || f.missing);
    if (f.sort !== 'recent') parts.push({ az:'A-Z', deck:'By deck', due:'Due first' }[f.sort] || f.sort);
    return parts.length ? parts : ['All words'];
  }

  function renderActiveSummary() {
    const summary = document.getElementById('wordFilterSummary');
    if (summary) summary.textContent = summaryParts(wordFilters).join(' · ');
    const btn = document.querySelector('[onclick="openWordFilterModal()"], #wordFilterBtn, .word-filter-btn');
    const count = activeCount(wordFilters);
    if (!btn) return;
    let dot = btn.querySelector('.word-filter-active-dot');
    if (count && !dot) {
      dot = document.createElement('span');
      dot.className = 'word-filter-active-dot';
      btn.appendChild(dot);
    }
    if (dot) {
      dot.textContent = count;
      dot.style.display = count ? 'inline-flex' : 'none';
    }
  }

  function injectStyles() {
    if (document.getElementById('dictionaryFilterSmoothStyle')) return;
    const style = document.createElement('style');
    style.id = 'dictionaryFilterSmoothStyle';
    style.textContent = `
      .dict-filter-modal .modal-card { overflow:auto; max-height:min(78vh, 720px); }
      .dict-filter-actions { position:sticky; bottom:-14px; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px -14px -14px; padding:12px 14px 14px; background:var(--sur); border-top:1px solid var(--bdr); border-radius:0 0 20px 20px; box-shadow:0 -8px 18px rgba(0,0,0,.035); }
      .dict-filter-actions .btn { height:44px; min-width:0; border-radius:14px; }
      .dict-filter-btn { transition:background .12s ease, color .12s ease, border-color .12s ease, transform .08s ease; }
      .dict-filter-btn:active { transform:scale(.985); }
      .dict-filter-draft-note { margin-top:8px; color:var(--ink2); font-size:12px; font-weight:750; line-height:1.35; }
    `;
    document.head.appendChild(style);
  }

  function filterBtn(group, value, label) {
    const current = group === 'type'
      ? (draftFilters.type || '')
      : group === 'starred'
        ? (draftFilters.starred ? 'yes' : 'no')
        : (draftFilters[group] || 'all');
    const on = String(current) === String(value);
    return `<button class="dict-filter-btn ${on ? 'on' : ''}" type="button" data-filter-group="${group}" data-filter-value="${safeText(value)}">${label}</button>`;
  }

  function deckOptionsHtml() {
    return [
      `<option value="all" ${draftFilters.deck === 'all' ? 'selected' : ''}>All decks</option>`,
      `<option value="${NO_DECK_ID}" ${draftFilters.deck === NO_DECK_ID ? 'selected' : ''}>${NO_DECK_NAME}</option>`,
      ...D.decks.map(d => `<option value="${safeText(d.id)}" ${String(draftFilters.deck) === String(d.id) ? 'selected' : ''}>${safeText(d.name)}</option>`)
    ].join('');
  }

  function updateModalVisuals(modal) {
    modal.querySelectorAll('[data-filter-group]').forEach(btn => {
      const group = btn.dataset.filterGroup;
      const value = btn.dataset.filterValue;
      const current = group === 'type'
        ? (draftFilters.type || '')
        : group === 'starred'
          ? (draftFilters.starred ? 'yes' : 'no')
          : (draftFilters[group] || 'all');
      btn.classList.toggle('on', String(current) === String(value));
    });

    const chips = modal.querySelector('#dictFilterDraftSummary');
    if (chips) chips.innerHTML = summaryParts(draftFilters).map(p => `<span class="dict-filter-chip on">${safeText(p)}</span>`).join('');
    const note = modal.querySelector('#dictFilterDraftNote');
    if (note) note.textContent = activeCount(draftFilters) ? `${activeCount(draftFilters)} filter${activeCount(draftFilters) === 1 ? '' : 's'} selected. Press Apply to update the list.` : 'No filters selected. Press Apply to show all words.';
  }

  function renderModal() {
    ensureFilters();
    injectStyles();
    draftFilters = cloneFilters(wordFilters);

    let modal = document.getElementById('wordFilterModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wordFilterModal';
      modal.className = 'overlay dict-filter-modal';
      document.body.appendChild(modal);
    }
    modal.className = 'overlay dict-filter-modal';
    modal.onclick = e => { if (e.target === modal) closeO('wordFilterModal'); };

    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:10px;">
          <div>
            <div class="sh-title">Dictionary Filters</div>
            <div id="dictFilterDraftNote" class="dict-filter-draft-note"></div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('wordFilterModal')" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div id="dictFilterDraftSummary" class="dict-filter-summary-bar"></div>
        <div class="dict-filter-section"><div class="dict-filter-title">Common filters</div><div class="dict-filter-grid">
          ${filterBtn('status', 'all', 'All status')}${filterBtn('status', 'due', 'Due now')}${filterBtn('status', 'new', 'New')}${filterBtn('status', 'learning', 'Learning')}${filterBtn('starred', 'yes', 'Starred only')}${filterBtn('missing', 'incomplete', 'Incomplete')}
        </div></div>
        <div class="dict-filter-section"><div class="dict-filter-title">Deck</div><select class="dict-filter-select" id="dictFilterDeck">${deckOptionsHtml()}</select></div>
        <div class="dict-filter-section"><div class="dict-filter-title">Part of speech</div><div class="dict-filter-grid three">
          ${filterBtn('type', '', 'All')}${filterBtn('type', 'N', 'Noun')}${filterBtn('type', 'V', 'Verb')}${filterBtn('type', 'ADJ', 'Adj')}${filterBtn('type', 'ADV', 'Adv')}${filterBtn('type', 'PHR', 'Phrase')}${filterBtn('type', 'IDM', 'Idiom')}${filterBtn('type', 'PRON', 'Pron')}${filterBtn('type', 'ART', 'Article')}
        </div></div>
        <div class="dict-filter-section"><div class="dict-filter-title">Language</div><div class="dict-filter-grid three">${filterBtn('lang', 'all', 'All')}${filterBtn('lang', 'en', 'English')}${filterBtn('lang', 'ja', 'Japanese')}</div></div>
        <div class="dict-filter-section"><div class="dict-filter-title">Missing data</div><div class="dict-filter-grid">${filterBtn('missing', 'all', 'Any data')}${filterBtn('missing', 'pronunciation', 'No IPA')}${filterBtn('missing', 'example', 'No example')}${filterBtn('missing', 'notes', 'No notes')}</div></div>
        <div class="dict-filter-section"><div class="dict-filter-title">Sort</div><select class="dict-filter-select" id="dictFilterSort">
          <option value="recent" ${draftFilters.sort === 'recent' ? 'selected' : ''}>Recently added</option><option value="az" ${draftFilters.sort === 'az' ? 'selected' : ''}>A-Z</option><option value="deck" ${draftFilters.sort === 'deck' ? 'selected' : ''}>Group by deck</option><option value="due" ${draftFilters.sort === 'due' ? 'selected' : ''}>Due first</option>
        </select></div>
        <div class="dict-filter-actions"><button class="btn btn-s" type="button" id="dictResetFilters">Reset</button><button class="btn btn-p" type="button" id="dictApplyFilters">Apply</button></div>
      </div>
    `;

    modal.querySelectorAll('[data-filter-group]').forEach(btn => {
      btn.onclick = () => {
        const group = btn.dataset.filterGroup;
        const value = btn.dataset.filterValue;
        if (group === 'starred') draftFilters.starred = !draftFilters.starred;
        else if (group === 'type') draftFilters.type = value;
        else draftFilters[group] = value;
        updateModalVisuals(modal);
      };
    });
    const deckSel = modal.querySelector('#dictFilterDeck');
    if (deckSel) deckSel.onchange = () => { draftFilters.deck = deckSel.value; updateModalVisuals(modal); };
    const sortSel = modal.querySelector('#dictFilterSort');
    if (sortSel) sortSel.onchange = () => { draftFilters.sort = sortSel.value; updateModalVisuals(modal); };
    const resetBtn = modal.querySelector('#dictResetFilters');
    if (resetBtn) resetBtn.onclick = () => { draftFilters = defaults(); renderModal(); };
    const applyBtn = modal.querySelector('#dictApplyFilters');
    if (applyBtn) applyBtn.onclick = () => {
      wordFilters = cloneFilters(draftFilters);
      if (window.WordJarDictionaryPerformance?.clearCache) WordJarDictionaryPerformance.clearCache();
      renderActiveSummary();
      if (typeof renderWords === 'function') renderWords();
      closeO('wordFilterModal');
    };

    updateModalVisuals(modal);
  }

  window.openWordFilterModal = function openWordFilterModalSmooth() {
    renderModal();
    openO('wordFilterModal');
  };

  window.resetWordFilters = function resetWordFiltersSmooth() {
    wordFilters = defaults();
    renderActiveSummary();
    if (typeof renderWords === 'function') renderWords();
  };

  window.renderWordFilterUI = window.updateWordFilterUI = window.updateWordFilterSummary = function renderWordFilterUISmooth() {
    ensureFilters();
    renderActiveSummary();
  };

  ensureFilters();
  injectStyles();
  setTimeout(renderActiveSummary, 0);
})();
