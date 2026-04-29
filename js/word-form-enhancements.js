// WordJar Word Form Enhancements V2
// Adds a Synonyms field and keeps word field order consistent: Meaning → Synonyms → Example → Notes.

(function installWordFormEnhancements() {
  if (window.__wordjarWordFormEnhancementsInstalledV2) return;
  window.__wordjarWordFormEnhancementsInstalledV2 = true;

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
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return String(value || '')
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function synonymsText(w) {
    return parseSynonyms(w?.synonyms || w?.synonym || '').join(', ');
  }

  function injectStyles() {
    if (document.getElementById('wordFormEnhancementStyle')) return;
    const style = document.createElement('style');
    style.id = 'wordFormEnhancementStyle';
    style.textContent = `
      .synonym-chip-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .synonym-chip { display:inline-flex; align-items:center; border:1px solid var(--bdr); background:var(--sur2); color:var(--ink2); border-radius:999px; padding:6px 9px; font-size:12px; font-weight:800; }
      .form-help-text { color:var(--ink2); font-size:12px; line-height:1.35; margin-top:6px; }
    `;
    document.head.appendChild(style);
  }

  function fieldParent(id) {
    const el = document.getElementById(id);
    return el?.closest?.('.fg, .deck-field, .opt-row, label') || el?.parentElement || null;
  }

  function ensureSynonymsField() {
    injectStyles();
    if (document.getElementById('fSynonyms')) return;

    const field = document.createElement('div');
    field.className = 'fg';
    field.id = 'fSynonymsWrap';
    field.innerHTML = `
      <label class="fl">Synonyms</label>
      <input class="fi" id="fSynonyms" type="text" placeholder="e.g. improve, enhance, refine">
      <div class="form-help-text">Separate synonyms with commas. They can be shown or hidden on flashcards.</div>
    `;

    const meaningParent = fieldParent('fMeaning');
    const exampleParent = fieldParent('fEx');
    if (meaningParent) meaningParent.insertAdjacentElement('afterend', field);
    else if (exampleParent) exampleParent.insertAdjacentElement('beforebegin', field);
    else document.getElementById('wordModal')?.querySelector('.modal-card')?.appendChild(field);
  }

  function reorderWordFormFields() {
    const modal = document.getElementById('wordModal');
    const card = modal?.querySelector('.modal-card');
    if (!card) return;

    const orderedIds = ['fWord', 'fDeck', 'fPron', 'fMeaning', 'fSynonyms', 'fEx', 'fNotes'];
    let anchor = null;
    orderedIds.forEach(id => {
      const parent = fieldParent(id);
      if (!parent || !card.contains(parent)) return;
      if (!anchor) {
        anchor = parent;
        return;
      }
      anchor.insertAdjacentElement('afterend', parent);
      anchor = parent;
    });
  }

  function fillSynonymsField(wordId) {
    ensureSynonymsField();
    const input = document.getElementById('fSynonyms');
    if (!input) return;
    const w = wordId ? D.words.find(x => String(x.id) === String(wordId)) : null;
    input.value = w ? synonymsText(w) : '';
  }

  function applySynonymsToSavedWord(previousEditId, word, deckId, synonyms) {
    if (!word) return;
    const normalized = String(word || '').trim().toLowerCase();
    let target = null;

    if (previousEditId) target = D.words.find(w => String(w.id) === String(previousEditId));
    if (!target) {
      const matches = D.words.filter(w =>
        String(w.word || '').trim().toLowerCase() === normalized &&
        String(w.deckId || '') === String(deckId || '')
      );
      target = matches[matches.length - 1];
    }
    if (!target) return;

    target.synonyms = parseSynonyms(synonyms);
    save();
    if (typeof renderWords === 'function') renderWords();
    if (typeof renderDeckCards === 'function' && curPage === 'deck-cards') renderDeckCards();
  }

  const originalOpenWordModal = window.openWordModal;
  window.openWordModal = function openWordModalWithSynonyms(id, deckId) {
    if (typeof originalOpenWordModal === 'function') originalOpenWordModal(id, deckId);
    ensureSynonymsField();
    fillSynonymsField(id || null);
    reorderWordFormFields();
  };

  const originalSaveWord = window.saveWord;
  window.saveWord = function saveWordWithSynonyms() {
    ensureSynonymsField();
    const previousEditId = editWordId;
    const word = document.getElementById('fWord')?.value?.trim() || '';
    const deckId = document.getElementById('fDeck')?.value || '';
    const synonyms = document.getElementById('fSynonyms')?.value || '';

    if (typeof originalSaveWord === 'function') originalSaveWord();

    setTimeout(() => {
      const modalStillOpen = document.getElementById('wordModal')?.classList.contains('open');
      if (modalStillOpen) return;
      applySynonymsToSavedWord(previousEditId, word, deckId, synonyms);
    }, 80);
  };

  function renderDetailSynonyms(wordId) {
    injectStyles();
    const modal = document.getElementById('detailModal');
    const card = modal?.querySelector('.modal-card');
    if (!card) return;

    let section = document.getElementById('dtSynSec');
    if (!section) {
      section = document.createElement('div');
      section.id = 'dtSynSec';
      section.className = 'dt-sec';
      section.innerHTML = `
        <div class="ans-label">Synonyms:</div>
        <div id="dtSynonyms" class="synonym-chip-row"></div>
      `;
      const meaningEl = document.getElementById('dtMeaning');
      const meaningSection = meaningEl?.closest?.('.dt-sec, .fg, .detail-section, section, div');
      const exSec = document.getElementById('dtExSec');
      const ntSec = document.getElementById('dtNtSec');
      if (meaningSection && card.contains(meaningSection)) meaningSection.insertAdjacentElement('afterend', section);
      else if (exSec) exSec.insertAdjacentElement('beforebegin', section);
      else if (ntSec) ntSec.insertAdjacentElement('beforebegin', section);
      else card.appendChild(section);
    }

    const exSec = document.getElementById('dtExSec');
    if (exSec && section.nextElementSibling !== exSec) {
      exSec.insertAdjacentElement('beforebegin', section);
    }

    const w = D.words.find(x => String(x.id) === String(wordId));
    const syns = parseSynonyms(w?.synonyms || w?.synonym || '');
    if (!syns.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    const out = document.getElementById('dtSynonyms');
    if (out) out.innerHTML = syns.map(s => `<span class="synonym-chip">${safeText(s)}</span>`).join('');
  }

  const originalShowDetail = window.showDetail;
  window.showDetail = function showDetailWithSynonyms(id) {
    if (typeof originalShowDetail === 'function') originalShowDetail(id);
    renderDetailSynonyms(id);
  };

  setTimeout(ensureSynonymsField, 0);
})();
