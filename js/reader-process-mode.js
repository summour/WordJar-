// WordJar Reader Process Mode V1
// Adds a manual Process Text button so long notes do not re-tokenize on every edit.

(function installReaderProcessMode() {
  if (window.__wordjarReaderProcessModeInstalled) return;
  window.__wordjarReaderProcessModeInstalled = true;

  let dirty = false;

  function injectStyles() {
    if (document.getElementById('readerProcessModeStyle')) return;
    const style = document.createElement('style');
    style.id = 'readerProcessModeStyle';
    style.textContent = `
      .reader-process-row { display:grid; grid-template-columns: minmax(0, 1fr) auto; gap:10px; align-items:center; margin-top:10px; }
      .reader-process-note { color:var(--ink2); font-size:12px; font-weight:800; line-height:1.35; min-width:0; }
      .reader-process-btn { width:auto !important; padding:9px 12px !important; font-size:12px !important; border-radius:12px !important; white-space:nowrap; }
      .reader-process-btn.dirty { border-color:var(--ink) !important; color:var(--ink) !important; }
    `;
    document.head.appendChild(style);
  }

  function ensureProcessButton() {
    injectStyles();
    const card = document.querySelector('#pg-reader .reader-card');
    if (!card || document.getElementById('readerProcessRow')) return;

    const meta = document.querySelector('#pg-reader .reader-meta');
    const row = document.createElement('div');
    row.id = 'readerProcessRow';
    row.className = 'reader-process-row';
    row.innerHTML = `
      <div id="readerProcessNote" class="reader-process-note">Edit freely, then process text when ready.</div>
      <button id="readerProcessBtn" class="btn btn-s reader-process-btn" type="button" onclick="processReaderText()">Process Text</button>
    `;

    if (meta) meta.insertAdjacentElement('afterend', row);
    else card.appendChild(row);
  }

  function setDirty(value) {
    dirty = value;
    const btn = document.getElementById('readerProcessBtn');
    const note = document.getElementById('readerProcessNote');
    if (btn) btn.classList.toggle('dirty', dirty);
    if (note) note.textContent = dirty ? 'Text changed. Process again to update Reader View.' : 'Reader View is up to date.';
  }

  function bindInputDirtyMarker() {
    const input = document.getElementById('readerInput');
    if (!input || input.__wordjarProcessDirtyBound) return;
    input.__wordjarProcessDirtyBound = true;
    input.addEventListener('input', () => setDirty(true), true);
  }

  window.processReaderText = function processReaderText() {
    const input = document.getElementById('readerInput');
    if (!input) return;

    D.reader = D.reader || {};
    D.reader.text = input.value;
    localStorage.setItem('wordjar_reader_note_v1', input.value);
    save();

    if (typeof renderReader === 'function') renderReader();
    setDirty(false);
    if (typeof toast === 'function') toast('Reader View updated');
  };

  const originalRenderReader = window.renderReader;
  window.renderReader = function renderReaderWithProcessMode() {
    if (typeof originalRenderReader === 'function') originalRenderReader();
    ensureProcessButton();
    bindInputDirtyMarker();
    if (!dirty) setDirty(false);
  };

  setTimeout(() => {
    ensureProcessButton();
    bindInputDirtyMarker();
  }, 0);
})();
