// WordJar Reader Note Detail Control Fix V1
// Fixes duplicate Aa buttons and makes Note Detail controls work on #readerNotesPage.

(function installReaderNoteDetailControlFix() {
  if (window.__wordjarReaderNoteDetailControlFixInstalled) return;
  window.__wordjarReaderNoteDetailControlFixInstalled = true;

  const SHEET_ID = 'rnCoreCustomSheet';
  const STYLE_ID = 'rnCoreCustomSheetStyle';
  let aiLoadPromise = null;

  function esc(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function toastSafe(message) {
    if (typeof toast === 'function') toast(message);
  }

  function ensureData() {
    window.D = window.D || {};
    D.reader = D.reader || {};
    D.reader.noteCustom = {
      mode: 'learning',
      fontSize: 'regular',
      lineHeight: 'comfortable',
      paragraphGap: 'regular',
      theme: 'light',
      showIPA: true,
      ipaPosition: 'above',
      ipaStandard: 'en-US',
      showTranslation: true,
      translationPosition: 'popup',
      translationStyle: 'natural',
      showGrammar: false,
      showCEFR: false,
      showPOS: false,
      showPhrases: true,
      focusMode: false,
      hideEasyWords: true,
      targetsOnly: false,
      delayedReveal: false,
      ...D.reader.noteCustom
    };
  }

  function currentNoteId() {
    const page = document.getElementById('readerNotesPage');
    return page?.dataset?.learningNoteId || page?.querySelector('.rn-learning-core')?.dataset?.noteId || '';
  }

  function getCustom() {
    ensureData();
    return D.reader.noteCustom;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #readerNotesPage .rn-core-custom-backdrop { position:absolute; inset:0; z-index:100020; background:rgba(0,0,0,.34); display:flex; align-items:flex-end; }
      #readerNotesPage .rn-core-custom-sheet { width:100%; max-height:min(82vh,680px); overflow:auto; border-radius:26px 26px 0 0; border:1px solid var(--bdr); border-bottom:0; background:var(--bg); padding:12px 18px 22px; box-shadow:0 -18px 48px rgba(0,0,0,.18); }
      #readerNotesPage .rn-core-grabber { width:42px; height:5px; border-radius:999px; background:var(--ink2); opacity:.55; margin:2px auto 16px; }
      #readerNotesPage .rn-core-title { font-size:24px; line-height:1.08; font-weight:950; letter-spacing:-.04em; margin-bottom:14px; }
      #readerNotesPage .rn-core-section { margin:18px 0 0; }
      #readerNotesPage .rn-core-section-title { color:var(--ink2); font-size:13px; font-weight:950; margin-bottom:8px; }
      #readerNotesPage .rn-core-segment { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--bdr); border-radius:16px; overflow:hidden; background:var(--sur); }
      #readerNotesPage .rn-core-segment button { min-height:40px; border:0; border-right:1px solid var(--bdr); background:transparent; color:var(--ink); font-size:13px; font-weight:900; }
      #readerNotesPage .rn-core-segment button:last-child { border-right:0; }
      #readerNotesPage .rn-core-segment button.active { background:var(--brand,#2f7cf6); color:white; }
      #readerNotesPage .rn-core-row { min-height:54px; display:flex; align-items:center; justify-content:space-between; gap:14px; border-bottom:1px solid var(--bdr); background:transparent; color:var(--ink); width:100%; text-align:left; }
      #readerNotesPage .rn-core-row:last-child { border-bottom:0; }
      #readerNotesPage .rn-core-label { color:var(--ink); font-size:15px; font-weight:900; }
      #readerNotesPage .rn-core-sub { display:block; color:var(--ink2); font-size:12px; font-weight:750; margin-top:2px; }
      #readerNotesPage .rn-core-select { min-width:138px; min-height:36px; border:1px solid var(--bdr); border-radius:12px; background:var(--sur); color:var(--ink); padding:0 10px; font-size:13px; font-weight:850; }
      #readerNotesPage .rn-core-toggle { width:52px; height:32px; border:1px solid var(--bdr); border-radius:999px; background:var(--sur2); padding:3px; display:flex; align-items:center; justify-content:flex-start; }
      #readerNotesPage .rn-core-toggle.on { justify-content:flex-end; background:var(--brand,#2f7cf6); }
      #readerNotesPage .rn-core-toggle span { width:24px; height:24px; border-radius:999px; background:white; box-shadow:0 2px 8px rgba(0,0,0,.16); }
    `;
    document.head.appendChild(style);
  }

  function selected(value, option) {
    return String(value) === String(option) ? ' active' : '';
  }

  function selectRow(key, title, options, subtitle = '') {
    const c = getCustom();
    return `<div class="rn-core-row"><span><span class="rn-core-label">${esc(title)}</span>${subtitle ? `<span class="rn-core-sub">${esc(subtitle)}</span>` : ''}</span><select class="rn-core-select" data-rn-custom-key="${esc(key)}">${options.map(opt => `<option value="${esc(opt.value)}" ${String(c[key]) === String(opt.value) ? 'selected' : ''}>${esc(opt.label)}</option>`).join('')}</select></div>`;
  }

  function toggleRow(key, title, subtitle = '') {
    const on = !!getCustom()[key];
    return `<button class="rn-core-row" type="button" data-rn-toggle="${esc(key)}"><span><span class="rn-core-label">${esc(title)}</span>${subtitle ? `<span class="rn-core-sub">${esc(subtitle)}</span>` : ''}</span><span class="rn-core-toggle ${on ? 'on' : ''}"><span></span></span></button>`;
  }

  function sheetHTML() {
    const c = getCustom();
    return `
      <div id="${SHEET_ID}" class="rn-core-custom-backdrop">
        <div class="rn-core-custom-sheet">
          <div class="rn-core-grabber"></div>
          <div class="rn-core-title">Custom</div>
          <div class="rn-core-section"><div class="rn-core-section-title">Display Mode</div><div class="rn-core-segment">
            ${['clean','learning','detailed'].map(mode => `<button class="${selected(c.mode, mode)}" type="button" data-rn-mode="${mode}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}
          </div></div>
          <div class="rn-core-section"><div class="rn-core-section-title">Text</div>
            ${selectRow('fontSize','Font Size',[{value:'small',label:'Small'},{value:'regular',label:'Regular'},{value:'large',label:'Large'},{value:'xlarge',label:'Extra Large'}])}
            ${selectRow('lineHeight','Line Height',[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'comfortable',label:'Comfortable'}])}
            ${selectRow('paragraphGap','Paragraph Spacing',[{value:'compact',label:'Compact'},{value:'regular',label:'Regular'},{value:'wide',label:'Wide'}])}
            ${selectRow('theme','Theme',[{value:'light',label:'Light'},{value:'warm',label:'Warm'},{value:'dark',label:'Dark'}])}
          </div>
          <div class="rn-core-section"><div class="rn-core-section-title">Learning Layer</div>
            ${toggleRow('showIPA','IPA','Show phonetic symbols from analysis')}
            ${toggleRow('showTranslation','Translation')}
            ${toggleRow('showGrammar','Grammar Hints')}
            ${toggleRow('showCEFR','CEFR Level')}
            ${toggleRow('showPOS','Part of Speech')}
            ${toggleRow('showPhrases','Phrase Highlights')}
          </div>
          <div class="rn-core-section"><div class="rn-core-section-title">Pronunciation</div>
            ${selectRow('ipaStandard','Standard',[{value:'en-US',label:'American English'},{value:'en-GB',label:'British English'},{value:'en-RP',label:'Received Pronunciation'}])}
            ${selectRow('ipaPosition','IPA Position',[{value:'above',label:'Above word'},{value:'below',label:'Below word'},{value:'inline',label:'Inline'},{value:'popup',label:'Popup only'}])}
          </div>
          <div class="rn-core-section"><div class="rn-core-section-title">Translation</div>
            ${selectRow('translationPosition','Position',[{value:'popup',label:'Popup only'},{value:'sentence',label:'Under sentence'},{value:'paragraph',label:'Under paragraph'},{value:'inline',label:'Inline hint'}])}
            ${selectRow('translationStyle','Style',[{value:'natural',label:'Natural'},{value:'literal',label:'Literal'},{value:'learning',label:'Learning-friendly'}])}
          </div>
          <div class="rn-core-section"><div class="rn-core-section-title">Focus</div>
            ${toggleRow('focusMode','Focus Mode')}
            ${toggleRow('hideEasyWords','Hide Easy Words')}
            ${toggleRow('targetsOnly','Show Learning Targets Only')}
            ${toggleRow('delayedReveal','Delayed Reveal')}
          </div>
        </div>
      </div>
    `;
  }

  function rerenderDetail(keepSheet = false) {
    const id = currentNoteId();
    if (typeof save === 'function') save();
    if (id && typeof window.renderReaderNoteLearningDetail === 'function') {
      window.renderReaderNoteLearningDetail(id);
    }
    if (keepSheet) setTimeout(() => window.openReaderNoteCustomSheet(id), 0);
  }

  window.openReaderNoteCustomSheet = function openReaderNoteCustomSheet() {
    ensureData();
    injectStyles();
    const page = document.getElementById('readerNotesPage');
    if (!page) return;
    document.getElementById(SHEET_ID)?.remove();
    page.insertAdjacentHTML('beforeend', sheetHTML());
  };

  window.closeReaderNoteCustomSheet = function closeReaderNoteCustomSheet() {
    document.getElementById(SHEET_ID)?.remove();
  };

  window.setReaderNoteCustom = function setReaderNoteCustom(key, value) {
    ensureData();
    D.reader.noteCustom[key] = value;
    rerenderDetail(true);
  };

  window.toggleReaderNoteCustom = function toggleReaderNoteCustom(key) {
    ensureData();
    D.reader.noteCustom[key] = !D.reader.noteCustom[key];
    rerenderDetail(true);
  };

  function loadAI() {
    if (window.__wordjarReaderNoteAIAnalysisInstalled) return Promise.resolve();
    if (aiLoadPromise) return aiLoadPromise;
    if (typeof loadWordJarModule !== 'function') return Promise.resolve();
    aiLoadPromise = loadWordJarModule('js/reader-note-ai-analysis.js').catch(err => {
      console.warn('Reader note AI module failed to load', err);
    });
    return aiLoadPromise;
  }

  function fixButtons() {
    const page = document.getElementById('readerNotesPage');
    const actions = page?.querySelector('.rn-right');
    if (!actions) return;

    const aaButtons = [...actions.querySelectorAll('button')].filter(button => (button.textContent || '').trim() === 'Aa');
    aaButtons.forEach((button, index) => {
      if (index > 0) {
        button.remove();
        return;
      }
      button.id = 'rnCoreCustomBtn';
      button.type = 'button';
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        window.openReaderNoteCustomSheet();
      };
    });

    [...actions.querySelectorAll('button')]
      .filter(button => /open in reader|open legacy reader/i.test(button.textContent || ''))
      .forEach(button => button.remove());

    const analyze = page.querySelector('#rnCoreLearningBanner button, #rnLearningBanner button');
    if (analyze) {
      analyze.type = 'button';
      analyze.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        const id = currentNoteId();
        loadAI().then(() => window.analyzeReaderNoteLearning?.(id));
      };
    }
  }

  function bindSheetEvents() {
    const sheet = document.getElementById(SHEET_ID);
    if (!sheet || sheet.dataset.bound === '1') return;
    sheet.dataset.bound = '1';
    sheet.addEventListener('click', event => {
      if (event.target === sheet) {
        window.closeReaderNoteCustomSheet();
        return;
      }
      const mode = event.target.closest('[data-rn-mode]')?.dataset.rnMode;
      if (mode) window.setReaderNoteCustom('mode', mode);
      const toggle = event.target.closest('[data-rn-toggle]')?.dataset.rnToggle;
      if (toggle) window.toggleReaderNoteCustom(toggle);
    });
    sheet.addEventListener('change', event => {
      const key = event.target?.dataset?.rnCustomKey;
      if (key) window.setReaderNoteCustom(key, event.target.value);
    });
  }

  function boot() {
    ensureData();
    injectStyles();
    fixButtons();
    bindSheetEvents();
    loadAI();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 350);
  document.addEventListener('click', () => setTimeout(boot, 0), true);
  document.addEventListener('wordjar:note-detail-rendered', () => setTimeout(boot, 0));
})();