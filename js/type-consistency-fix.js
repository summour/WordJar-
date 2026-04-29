// WordJar Type Consistency Fix V1
// Keeps type selection stable and uses consistent display labels across edit and dictionary views.

(function installWordJarTypeConsistencyFix() {
  if (window.__wordjarTypeConsistencyFixInstalled) return;
  window.__wordjarTypeConsistencyFixInstalled = true;

  const STYLE_ID = 'wordjarTypeConsistencyStyle';
  const VALID_TYPES = ['N', 'V', 'ADJ', 'ADV', 'ART', 'PRON', 'PHR', 'IDM'];
  const TYPE_LABELS = {
    N: 'N',
    V: 'V',
    ADJ: 'ADJ',
    ADV: 'ADV',
    ART: 'ART',
    PRON: 'PRON',
    PHR: 'PHR',
    IDM: 'IDM',
    NOU: 'N',
    VER: 'V',
    NOUN: 'N',
    VERB: 'V',
    ADJECTIVE: 'ADJ',
    ADVERB: 'ADV',
    ARTICLE: 'ART',
    PRONOUN: 'PRON',
    PHRASE: 'PHR',
    IDIOM: 'IDM'
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #typePills .tp {
        font-weight: 600;
        letter-spacing: -0.01em;
        transition: background .16s ease, color .16s ease, border-color .16s ease, transform .16s ease;
      }
      #typePills .tp:active { transform: scale(.985); }
      #typePills .tp.sel {
        background: var(--ink);
        color: var(--sur);
        border-color: var(--ink);
      }
      .tt {
        font-weight: 650;
        letter-spacing: .01em;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeType(value) {
    const raw = String(value || 'N').trim().toUpperCase();
    return TYPE_LABELS[raw] || (VALID_TYPES.includes(raw) ? raw : 'N');
  }

  function normalizeTypeList(value) {
    const parts = String(value || 'N')
      .split(',')
      .map(normalizeType)
      .filter(Boolean);
    return Array.from(new Set(parts.length ? parts : ['N']));
  }

  function setTypeSelection(type, options = {}) {
    const safeType = normalizeType(type);
    const shouldPersist = options.persist !== false;

    if (typeof selectedTypes !== 'undefined' && selectedTypes?.clear) {
      selectedTypes.clear();
      selectedTypes.add(safeType);
    }

    document.querySelectorAll('#typePills .tp').forEach(btn => {
      const btnType = normalizeType(btn.dataset.t || btn.textContent);
      btn.dataset.t = btnType;
      btn.classList.toggle('sel', btnType === safeType);
    });

    if (shouldPersist && typeof editWordId !== 'undefined' && editWordId) {
      const card = D?.words?.find(w => String(w.id) === String(editWordId));
      if (card) card.type = safeType;
    }

    return safeType;
  }

  function patchSelectOnlyType() {
    if (window.__wordjarSelectOnlyTypePatched) return;
    const original = typeof window.selectOnlyType === 'function' ? window.selectOnlyType : null;
    window.__wordjarSelectOnlyTypePatched = true;

    window.selectOnlyType = function selectOnlyTypeStable(type) {
      const safeType = setTypeSelection(type, { persist: false });
      return safeType;
    };

    window.__wordjarOriginalSelectOnlyType = original;
  }

  function bindTypePills() {
    const wrap = document.getElementById('typePills');
    if (!wrap || wrap.dataset.wordjarTypeBound === '1') return;
    wrap.dataset.wordjarTypeBound = '1';

    wrap.addEventListener('click', event => {
      const btn = event.target.closest('.tp');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const safeType = setTypeSelection(btn.dataset.t || btn.textContent, { persist: false });
      btn.dataset.t = safeType;
    }, true);
  }

  function patchSaveWord() {
    if (window.__wordjarSaveWordTypePatched) return;
    if (typeof window.saveWord !== 'function') return;
    const original = window.saveWord;
    window.__wordjarSaveWordTypePatched = true;

    window.saveWord = function saveWordWithNormalizedType() {
      try {
        if (typeof selectedTypes !== 'undefined' && selectedTypes?.size) {
          const first = normalizeType(Array.from(selectedTypes)[0]);
          selectedTypes.clear();
          selectedTypes.add(first);
        }
      } catch (err) {}
      const result = original.apply(this, arguments);
      normalizeStoredTypes();
      return result;
    };
  }

  function normalizeStoredTypes() {
    if (!Array.isArray(D?.words)) return;
    let changed = false;
    D.words.forEach(card => {
      const normalized = normalizeTypeList(card.type).join(',');
      if (String(card.type || '') !== normalized) {
        card.type = normalized;
        changed = true;
      }
    });
    if (changed && typeof save === 'function') save();
  }

  function typeDisplay(value) {
    return normalizeTypeList(value)[0] || 'N';
  }

  function refreshDictionaryTypeBadges() {
    document.querySelectorAll('.wr .tt').forEach(badge => {
      const oldText = badge.textContent;
      const newText = typeDisplay(oldText);
      if (oldText !== newText) badge.textContent = newText;
    });
  }

  function patchRenderWords() {
    if (window.__wordjarRenderWordsTypePatched) return;
    if (typeof window.renderWords !== 'function') return;
    const original = window.renderWords;
    window.__wordjarRenderWordsTypePatched = true;
    window.renderWords = function renderWordsWithConsistentType() {
      const result = original.apply(this, arguments);
      setTimeout(refreshDictionaryTypeBadges, 0);
      return result;
    };
  }

  function boot() {
    injectStyles();
    patchSelectOnlyType();
    patchSaveWord();
    patchRenderWords();
    bindTypePills();
    normalizeStoredTypes();
    refreshDictionaryTypeBadges();
  }

  window.WordJarType = {
    normalizeType,
    normalizeTypeList,
    typeDisplay,
    setTypeSelection
  };

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
})();
