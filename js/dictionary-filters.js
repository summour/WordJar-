// WordJar Dictionary Filters V1
// Replaces the old scrolling Dictionary Filters modal with practical user-focused filters.

(function installWordJarDictionaryFilters() {
  if (window.__wordjarDictionaryFiltersInstalled) return;
  window.__wordjarDictionaryFiltersInstalled = true;

  const NO_DECK_ID = typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__';
  const NO_DECK_NAME = typeof SYSTEM_NO_DECK_NAME !== 'undefined' ? SYSTEM_NO_DECK_NAME : 'No Deck';

  function ensureFilters() {
    wordFilters = wordFilters || {};
    if (wordFilters.type === undefined) wordFilters.type = '';
    if (wordFilters.starred === undefined) wordFilters.starred = false;
    if (wordFilters.lang === undefined) wordFilters.lang = 'all';
    if (wordFilters.deck === undefined) wordFilters.deck = 'all';
    if (wordFilters.status === undefined) wordFilters.status = 'all';
    if (wordFilters.missing === undefined) wordFilters.missing = 'all';
    if (wordFilters.sort === undefined) wordFilters.sort = 'recent';
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

  function injectStyles() {
    if (document.getElementById('dictionaryFiltersStyle')) return;
    const style = document.createElement('style');
    style.id = 'dictionaryFiltersStyle';
    style.textContent = `
      .dict-filter-modal .modal-card { max-height: min(76vh, 720px); overflow:auto; }
      .dict-filter-summary-bar { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 14px; }
      .dict-filter-chip { border:1px solid var(--bdr); background:var(--sur); color:var(--ink2); border-radius:999px; padding:8px 11px; font-size:12px; font-weight:800; line-height:1; }
      .dict-filter-chip.on { background:var(--ink); color:white; border-color:var(--ink); }
      .dict-filter-section { margin-top:14px; }
      .dict-filter-section:first-child { margin-top:0; }
      .dict-filter-title { font-size:12px; font-weight:900; color:var(--ink); margin:0 0 8px; }
      .dict-filter-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
      .dict-filter-grid.three { grid-template-columns:repeat(3, minmax(0, 1fr)); }
      .dict-filter-btn { min-width:0; border:1px solid var(--bdr); background:var(--sur); color:var(--ink); border-radius:14px; padding:11px 8px; font-size:13px; font-weight:850; text-align:center; }
      .dict-filter-btn.on { background:var(--ink); color:white; border-color:var(--ink); }
      .dict-filter-select { width:100%; height:44px; border:1px solid var(--bdr); border-radius:14px; padding:0 12px; background:var(--sur); color:var(--ink); font-size:14px; font-weight:750; outline:none; }
      .dict-filter-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; position:sticky; bottom:-1px; background:var(--bg); padding-top:12px; }
      .dict-filter-count { color:var(--ink2); font-size:12px; font-weight:800; line-height:1.35; margin-top:8px; }
      .word-filter-active-dot { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; margin-left:6px; border-radius:999px; background:var(--ink); color:white; font-size:10px; font-weight:900; vertical-align:middle; }
    `;
    document.head.appendChild(style);
  }

  function getWordTypes(w) {
    return String(w.type || 'N')
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);
  }

  function getWordLang(w) {
    return String(w.lang || 'en').toLowerCase();
  }

  function isNoDeck(deckId) {
    return String(deckId || '') === NO_DECK_ID;
  }

  function realDeckExists(deckId) {
    return D.decks.some(d => String(d.id) === String(deckId));
  }

  function wordDeckName(deckId) {
    if (!deckId || isNoDeck(deckId) || !realDeckExists(deckId)) return NO_DECK_NAME;
    const d = D.decks.find(x => String(x.id) === String(deckId));
    return d ? d.name : NO_DECK_NAME;
  }

  function wordStatus(w) {
    if (window.WordJarFSRS?.isDueCard) {
      const state = String(w.srsState || 'new');
      const due = WordJarFSRS.isDueCard(w);
      if (state === 'new') return 'new';
      if (state === 'learning' || state === 'relearning') return due ? 'learning' : 'scheduled';
      return due ? 'due' : 'review';
    }

    if ((w.reps || 0) === 0) return 'new';
    if (typeof isDue === 'function' && isDue(w)) return (w.interval || 1) < 21 ? 'learning' : 'due';
    return 'review';
  }

  function matchesMissing(w) {
    const m = wordFilters.missing || 'all';
    if (m === 'all') return true;
    if (m === 'pronunciation') return !String(w.pronunciation || '').trim();
    if (m === 'example') return !String(w.example || '').trim();
    if (m === 'notes') return !String(w.notes || '').trim();
    if (m === 'incomplete') return !String(w.pronunciation || '').trim() || !String(w.example || '').trim() || !String(w.meaning || '').trim();
    return true;
  }

  function getFilteredWords() {
    ensureFilters();
    const q = (document.getElementById('si')?.value || '').trim().toLowerCase();

    let list = D.words.filter(w => {
      const types = getWordTypes(w);
      const deckName = wordDeckName(w.deckId);
      const lang = getWordLang(w);
      const status = wordStatus(w);
      const searchableText = [w.word, w.meaning, w.pronunciation, w.example, w.notes, w.type, deckName, lang, status].join(' ').toLowerCase();

      if (q && !searchableText.includes(q)) return false;
      if (wordFilters.starred && !w.starred) return false;
      if (wordFilters.type && !types.includes(wordFilters.type)) return false;
      if (wordFilters.lang !== 'all' && lang !== wordFilters.lang) return false;
      if (wordFilters.deck === NO_DECK_ID && realDeckExists(w.deckId)) return false;
      if (wordFilters.deck && wordFilters.deck !== 'all' && wordFilters.deck !== NO_DECK_ID && String(w.deckId) !== String(wordFilters.deck)) return false;
      if (wordFilters.status !== 'all' && status !== wordFilters.status) return false;
      if (!matchesMissing(w)) return false;
      return true;
    });

    const sort = wordFilters.sort || 'recent';
    if (sort === 'az') list.sort((a, b) => String(a.word || '').localeCompare(String(b.word || '')));
    else if (sort === 'deck') list.sort((a, b) => wordDeckName(a.deckId).localeCompare(wordDeckName(b.deckId)) || String(a.word || '').localeCompare(String(b.word || '')));
    else if (sort === 'due') list.sort((a, b) => new Date(a.dueAt || a.nextReview || 0) - new Date(b.dueAt || b.nextReview || 0));
    else list = list.slice().reverse();

    return list;
  }

  function activeFilterCount() {
    ensureFilters();
    let n = 0;
    if (wordFilters.type) n++;
    if (wordFilters.starred) n++;
    if (wordFilters.lang !== 'all') n++;
    if (wordFilters.deck !== 'all') n++;
    if (wordFilters.status !== 'all') n++;
    if (wordFilters.missing !== 'all') n++;
    if (wordFilters.sort !== 'recent') n++;
    return n;
  }

  function filterBtn(group, value, label) {
    const current = group === 'type'
      ? (wordFilters.type || '')
      : group === 'starred'
        ? (wordFilters.starred ? 'yes' : 'no')
        : (wordFilters[group] || 'all');
    const on = String(current) === String(value);
    return `<button class="dict-filter-btn ${on ? 'on' : ''}" type="button" data-filter-group="${group}" data-filter-value="${safeText(value)}">${label}</button>`;
  }

  function summaryParts() {
    ensureFilters();
    const parts = [];
    const typeLabel = { N:'Noun', V:'Verb', ADJ:'Adjective', ADV:'Adverb', ART:'Article', PRON:'Pronoun', PHR:'Phrase', IDM:'Idiom' };
    if (wordFilters.type) parts.push(typeLabel[wordFilters.type] || wordFilters.type);
    if (wordFilters.starred) parts.push('Starred');
    if (wordFilters.lang === 'en') parts.push('English');
    if (wordFilters.lang === 'ja') parts.push('Japanese');
    if (wordFilters.deck && wordFilters.deck !== 'all') parts.push(wordFilters.deck === NO_DECK_ID ? NO_DECK_NAME : wordDeckName(wordFilters.deck));
    if (wordFilters.status !== 'all') parts.push({ new:'New', learning:'Learning', due:'Due', review:'Review', scheduled:'Scheduled' }[wordFilters.status] || wordFilters.status);
    if (wordFilters.missing !== 'all') parts.push({ pronunciation:'No IPA', example:'No example', notes:'No notes', incomplete:'Incomplete' }[wordFilters.missing] || wordFilters.missing);
    if (wordFilters.sort !== 'recent') parts.push({ az:'A-Z', deck:'By deck', due:'Due first' }[wordFilters.sort] || wordFilters.sort);
    return parts.length ? parts : ['All words'];
  }

  function renderActiveSummary() {
    const summary = document.getElementById('wordFilterSummary');
    if (summary) summary.textContent = summaryParts().join(' · ');

    const btn = document.querySelector('[onclick="openWordFilterModal()"], #wordFilterBtn, .word-filter-btn');
    const count = activeFilterCount();
    if (btn) {
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
  }

  function ensureFilterModal() {
    injectStyles();
    let modal = document.getElementById('wordFilterModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wordFilterModal';
      modal.className = 'overlay dict-filter-modal';
      document.body.appendChild(modal);
    }
    modal.classList.add('dict-filter-modal');
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('wordFilterModal');
    }, { once: false });
    return modal;
  }

  function renderFilterModal() {
    ensureFilters();
    const modal = ensureFilterModal();
    const filteredCount = getFilteredWords().length;
    const total = D.words.length;

    const deckOptions = [
      `<option value="all" ${wordFilters.deck === 'all' ? 'selected' : ''}>All decks</option>`,
      `<option value="${NO_DECK_ID}" ${wordFilters.deck === NO_DECK_ID ? 'selected' : ''}>${NO_DECK_NAME}</option>`,
      ...D.decks.map(d => `<option value="${safeText(d.id)}" ${String(wordFilters.deck) === String(d.id) ? 'selected' : ''}>${safeText(d.name)}</option>`)
    ].join('');

    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:10px;">
          <div>
            <div class="sh-title">Dictionary Filters</div>
            <div class="dict-filter-count">Showing ${filteredCount} of ${total} words</div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('wordFilterModal')" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="dict-filter-summary-bar">
          ${summaryParts().map(p => `<span class="dict-filter-chip on">${safeText(p)}</span>`).join('')}
        </div>

        <div class="dict-filter-section">
          <div class="dict-filter-title">Common filters</div>
          <div class="dict-filter-grid">
            ${filterBtn('status', 'all', 'All status')}
            ${filterBtn('status', 'due', 'Due now')}
            ${filterBtn('status', 'new', 'New')}
            ${filterBtn('status', 'learning', 'Learning')}
            ${filterBtn('starred', 'yes', 'Starred only')}
            ${filterBtn('missing', 'incomplete', 'Incomplete')}
          </div>
        </div>

        <div class="dict-filter-section">
          <div class="dict-filter-title">Deck</div>
          <select class="dict-filter-select" id="dictFilterDeck">${deckOptions}</select>
        </div>

        <div class="dict-filter-section">
          <div class="dict-filter-title">Part of speech</div>
          <div class="dict-filter-grid three">
            ${filterBtn('type', '', 'All')}
            ${filterBtn('type', 'N', 'Noun')}
            ${filterBtn('type', 'V', 'Verb')}
            ${filterBtn('type', 'ADJ', 'Adj')}
            ${filterBtn('type', 'ADV', 'Adv')}
            ${filterBtn('type', 'PHR', 'Phrase')}
            ${filterBtn('type', 'IDM', 'Idiom')}
            ${filterBtn('type', 'PRON', 'Pron')}
            ${filterBtn('type', 'ART', 'Article')}
          </div>
        </div>

        <div class="dict-filter-section">
          <div class="dict-filter-title">Language</div>
          <div class="dict-filter-grid three">
            ${filterBtn('lang', 'all', 'All')}
            ${filterBtn('lang', 'en', 'English')}
            ${filterBtn('lang', 'ja', 'Japanese')}
          </div>
        </div>

        <div class="dict-filter-section">
          <div class="dict-filter-title">Missing data</div>
          <div class="dict-filter-grid">
            ${filterBtn('missing', 'all', 'Any data')}
            ${filterBtn('missing', 'pronunciation', 'No IPA')}
            ${filterBtn('missing', 'example', 'No example')}
            ${filterBtn('missing', 'notes', 'No notes')}
          </div>
        </div>

        <div class="dict-filter-section">
          <div class="dict-filter-title">Sort</div>
          <select class="dict-filter-select" id="dictFilterSort">
            <option value="recent" ${wordFilters.sort === 'recent' ? 'selected' : ''}>Recently added</option>
            <option value="az" ${wordFilters.sort === 'az' ? 'selected' : ''}>A-Z</option>
            <option value="deck" ${wordFilters.sort === 'deck' ? 'selected' : ''}>Group by deck</option>
            <option value="due" ${wordFilters.sort === 'due' ? 'selected' : ''}>Due first</option>
          </select>
        </div>

        <div class="dict-filter-actions">
          <button class="btn btn-s" type="button" id="dictResetFilters">Reset</button>
          <button class="btn btn-p" type="button" onclick="closeO('wordFilterModal')">Apply</button>
        </div>
      </div>
    `;

    modal.querySelectorAll('[data-filter-group]').forEach(btn => {
      btn.onclick = () => {
        const group = btn.dataset.filterGroup;
        const value = btn.dataset.filterValue;
        if (group === 'starred') wordFilters.starred = !wordFilters.starred;
        else if (group === 'type') wordFilters.type = value;
        else wordFilters[group] = value;
        renderWords();
        renderFilterModal();
      };
    });

    const deckSel = document.getElementById('dictFilterDeck');
    if (deckSel) deckSel.onchange = () => { wordFilters.deck = deckSel.value; renderWords(); renderFilterModal(); };

    const sortSel = document.getElementById('dictFilterSort');
    if (sortSel) sortSel.onchange = () => { wordFilters.sort = sortSel.value; renderWords(); renderFilterModal(); };

    const resetBtn = document.getElementById('dictResetFilters');
    if (resetBtn) resetBtn.onclick = () => resetWordFilters();
  }

  window.openWordFilterModal = function openWordFilterModalPractical() {
    renderFilterModal();
    openO('wordFilterModal');
  };

  window.setWordTypeFilter = function setWordTypeFilterPractical(type) {
    ensureFilters();
    wordFilters.type = String(type || '').toUpperCase();
    renderWords();
  };

  window.setWordLangFilter = function setWordLangFilterPractical(lang) {
    ensureFilters();
    wordFilters.lang = lang || 'all';
    renderWords();
  };

  window.toggleStarredFilter = window.toggleWordStarFilter = function toggleStarredFilterPractical() {
    ensureFilters();
    wordFilters.starred = !wordFilters.starred;
    renderWords();
  };

  window.resetWordFilters = function resetWordFiltersPractical() {
    wordFilters = {
      type: '',
      starred: false,
      lang: 'all',
      deck: 'all',
      status: 'all',
      missing: 'all',
      sort: 'recent'
    };
    renderWords();
    renderFilterModal();
  };

  window.renderWordFilterUI = window.updateWordFilterUI = window.updateWordFilterSummary = function renderWordFilterUIPractical() {
    ensureFilters();
    renderActiveSummary();
  };

  window.renderWords = function renderWordsPractical() {
    ensureFilters();
    const el = document.getElementById('wordList');
    if (!el) return;

    const list = getFilteredWords();
    renderActiveSummary();

    if (!list.length) {
      el.innerHTML = `
        <div class="empty">
          <div class="empty-title">No words found</div>
          <div class="empty-sub">Try another keyword or loosen filters.</div>
        </div>
      `;
      return;
    }

    el.innerHTML = list.map(w => {
      const types = getWordTypes(w);
      const typeDisplay = types[0] || 'N';
      const pron = w.pronunciation ? `<div class="wpn">${safeText(w.pronunciation)}</div>` : '';
      const status = wordStatus(w);
      const statusLabel = { new:'New', learning:'Learning', due:'Due', review:'Review', scheduled:'Scheduled' }[status] || status;

      return `
        <div class="wr" onclick="showDetail('${safeText(w.id)}')">
          <div class="wm">
            <div class="wen">${safeText(w.word)}</div>
            ${pron}
            <div class="wth">${safeText(w.meaning)}</div>
            <div class="wpn" style="margin-top:6px;">${safeText(wordDeckName(w.deckId))} · ${safeText(statusLabel)}</div>
          </div>

          <div class="wr-right">
            <span class="tt">${safeText(typeDisplay)}</span>
            <button class="star-btn ${w.starred ? 'on' : ''}" onclick="event.stopPropagation(); toggleStar('${safeText(w.id)}')">
              <svg viewBox="0 0 24 24" fill="${w.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  ensureFilters();
  injectStyles();
  setTimeout(renderActiveSummary, 0);
})();
