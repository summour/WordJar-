// WordJar Reader Notes Polish V1
// Theme-matched notes UI: cleaner spacing, readable dates, less noisy controls.

(function installReaderNotesPolish() {
  if (window.__wordjarReaderNotesPolishInstalled) return;
  window.__wordjarReaderNotesPolishInstalled = true;

  let editId = '';
  let undoText = '';

  function ensureNotes() {
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
  }

  function esc(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function note(id) {
    ensureNotes();
    return D.readerNotes.find(n => String(n.id) === String(id));
  }

  function nowLabel() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function readerText() { return document.getElementById('readerInput')?.value || ''; }
  function titleFrom(text) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 58) || 'Untitled note'; }
  function countWords(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
  function preview(text, n = 118) { const s = String(text || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }

  function dateObj(value) {
    const d = new Date(String(value || '').replace(' ', 'T'));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function timeText(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  function shortDate(value) {
    const d = dateObj(value);
    if (!d) return '';
    const today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return `Today · ${timeText(d)}`;
    if (sameDay(d, y)) return `Yesterday · ${timeText(d)}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeText(d)}`;
  }

  function detailDate(value) {
    const d = dateObj(value);
    if (!d) return '';
    return `${d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} · ${timeText(d)}`;
  }

  function groupName(value) {
    const d = dateObj(value);
    if (!d) return 'Older';
    const today = new Date();
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((a - b) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff <= 7) return 'Previous 7 Days';
    return 'Older';
  }

  function saveObj(n, title, text) {
    const now = nowLabel();
    n.title = String(title || '').trim() || titleFrom(text);
    n.text = String(text || '').trim();
    n.updatedAt = now;
    if (!n.createdAt) n.createdAt = now;
  }

  function syncReader(n) {
    if (!n || String(D.reader?.activeNoteId || '') !== String(n.id)) return;
    const input = document.getElementById('readerInput');
    if (input) input.value = n.text || '';
    D.reader.text = n.text || '';
    localStorage.setItem('wordjar_reader_note_v1', D.reader.text);
    if (typeof processReaderText === 'function') processReaderText();
  }

  function styles() {
    if (document.getElementById('readerNotesPolishStyle')) return;
    const s = document.createElement('style');
    s.id = 'readerNotesPolishStyle';
    s.textContent = `
      #readerNotesModal.rn-polish { backdrop-filter:blur(8px); background:rgba(18,18,22,.20); }
      #readerNotesModal.rn-polish .modal-card { width:min(94vw,430px); max-height:min(88vh,780px); padding:0; overflow:hidden; border-radius:26px; border:1px solid var(--bdr); background:var(--bg); box-shadow:0 24px 64px rgba(0,0,0,.14); }
      .rn-shell { height:min(88vh,780px); display:flex; flex-direction:column; position:relative; background:var(--bg); color:var(--ink); }
      .rn-top { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 18px 8px; }
      .rn-actions { display:flex; align-items:center; gap:10px; }
      .rn-circle { width:42px; height:42px; min-width:42px; border-radius:999px; border:1px solid var(--bdr); background:var(--sur); color:var(--ink); display:inline-flex; align-items:center; justify-content:center; padding:0; box-shadow:0 8px 22px rgba(0,0,0,.055); }
      .rn-circle svg { width:21px; height:21px; stroke-width:2.55; }
      .rn-head { padding:2px 20px 12px; }
      .rn-title { font-size:30px; line-height:1.05; letter-spacing:-.045em; font-weight:950; color:var(--ink); }
      .rn-sub { margin-top:6px; color:var(--ink2); font-size:13px; font-weight:800; }
      .rn-search-wrap { padding:0 20px 12px; }
      .rn-search { height:44px; display:flex; align-items:center; gap:10px; padding:0 14px; border-radius:16px; border:1px solid var(--bdr); background:var(--sur); }
      .rn-search svg { width:18px; height:18px; color:var(--ink2); }
      .rn-search input { flex:1; min-width:0; border:0; outline:0; background:transparent; color:var(--ink); font:inherit; font-size:15px; font-weight:750; }
      .rn-content { flex:1 1 auto; min-height:0; overflow:auto; padding:0 20px 96px; }
      .rn-group { margin:14px 2px 8px; font-size:15px; font-weight:950; color:var(--ink); }
      .rn-list { border:1px solid var(--bdr); border-radius:22px; background:var(--sur2); overflow:hidden; }
      .rn-row { padding:14px 16px 13px; border-bottom:1px solid var(--bdr); cursor:pointer; transition:background .12s ease; }
      .rn-row:last-child { border-bottom:0; }
      .rn-row:active { background:rgba(0,0,0,.035); }
      .rn-row-title { font-size:17px; line-height:1.24; font-weight:900; color:var(--ink); margin-bottom:4px; }
      .rn-row-meta { font-size:12px; color:var(--ink2); font-weight:800; margin-bottom:6px; }
      .rn-row-preview { font-size:13px; line-height:1.42; color:var(--ink2); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .rn-empty { border:1px solid var(--bdr); border-radius:22px; background:var(--sur2); padding:28px 18px; color:var(--ink2); text-align:center; font-size:13px; font-weight:800; line-height:1.5; }
      .rn-detail-title { font-size:30px; line-height:1.08; letter-spacing:-.04em; font-weight:950; margin:2px 0 6px; }
      .rn-detail-meta { color:var(--ink2); font-size:12px; font-weight:850; margin-bottom:16px; }
      .rn-detail-body { color:var(--ink); font-size:16px; line-height:1.62; white-space:pre-wrap; padding-bottom:14px; }
      .rn-editor { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; padding:0 20px 96px; }
      .rn-title-input { border:0; outline:0; background:transparent; color:var(--ink); font-size:30px; line-height:1.08; font-weight:950; letter-spacing:-.04em; padding:4px 0 8px; width:100%; }
      .rn-text-input { flex:1 1 auto; min-height:0; border:0; outline:0; background:transparent; color:var(--ink); font:inherit; font-size:16px; line-height:1.62; resize:none; width:100%; padding:4px 0 0; }
      .rn-bottom { position:absolute; left:20px; right:20px; bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:12px; pointer-events:none; }
      .rn-tools { pointer-events:auto; display:flex; align-items:center; gap:18px; padding:10px 16px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur); box-shadow:0 16px 34px rgba(0,0,0,.10); }
      .rn-tool { border:0; background:transparent; color:var(--ink); padding:0; display:inline-flex; align-items:center; justify-content:center; }
      .rn-tool svg { width:25px; height:25px; stroke-width:2.4; }
      .rn-fab { pointer-events:auto; width:56px; height:56px; border-radius:18px; border:1px solid var(--bdr); background:var(--sur); color:var(--brand,#2f7cf6); display:inline-flex; align-items:center; justify-content:center; box-shadow:0 16px 34px rgba(0,0,0,.10); padding:0; }
      .rn-fab svg { width:27px; height:27px; stroke-width:2.5; }
      .rn-menu { position:absolute; top:66px; right:20px; min-width:180px; border:1px solid var(--bdr); border-radius:16px; background:var(--sur); overflow:hidden; box-shadow:0 18px 38px rgba(0,0,0,.14); z-index:4; }
      .rn-menu button { width:100%; border:0; background:transparent; color:var(--ink); text-align:left; padding:13px 14px; font-size:14px; font-weight:850; }
      .rn-menu button + button { border-top:1px solid var(--bdr); }
      .rn-menu .danger { color:#e24a4a; }
      @media (max-width:420px) { #readerNotesModal.rn-polish .modal-card { width:100vw; height:100vh; max-height:100vh; border-radius:0; } .rn-shell{height:100vh;} .rn-title,.rn-detail-title,.rn-title-input{font-size:28px;} }
    `;
    document.head.appendChild(s);
  }

  function modal() {
    styles();
    let m = document.getElementById('readerNotesModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'readerNotesModal';
      document.body.appendChild(m);
    }
    m.className = 'overlay rn-polish';
    m.onclick = e => { if (e.target === m) closeO('readerNotesModal'); };
    m.innerHTML = `<div class="modal-card" onclick="event.stopPropagation()"><div id="readerNotesBody"></div></div>`;
    return m;
  }

  function shell(html) {
    const body = document.getElementById('readerNotesBody');
    if (body) body.innerHTML = `<div class="rn-shell">${html}</div>`;
  }

  function svg(name) {
    const icons = {
      close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      back:'<path d="M15 18l-6-6 6-6"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',
      check:'<path d="M20 6L9 17l-5-5"/>',
      undo:'<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 010 10h-1"/>',
      search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
      more:'<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
      book:'<path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
      checklist:'<path d="M9 6l1.5 1.5L14 4"/><path d="M4 6h1"/><path d="M17 6h3"/><path d="M4 12h1"/><path d="M9 12h11"/><path d="M4 18h1"/><path d="M9 18h11"/>',
      attach:'<path d="M21.44 11.05l-8.49 8.49a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>'
    };
    const fill = name === 'more' ? 'currentColor' : 'none';
    const stroke = name === 'more' ? 'none' : 'currentColor';
    return `<svg viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}">${icons[name] || ''}</svg>`;
  }

  function renderList(query = '') {
    ensureNotes();
    const q = String(query || '').trim().toLowerCase();
    const notes = D.readerNotes.slice().sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))).filter(n => !q || [n.title,n.text].join(' ').toLowerCase().includes(q));
    const map = new Map();
    notes.forEach(n => { const g = groupName(n.updatedAt || n.createdAt); if (!map.has(g)) map.set(g, []); map.get(g).push(n); });
    const list = notes.length ? ['Today','Yesterday','Previous 7 Days','Older'].filter(g => map.has(g)).map(g => `<div class="rn-group">${g}</div><div class="rn-list">${map.get(g).map(n => `<div class="rn-row" onclick="openReaderNoteDetailIOS('${esc(n.id)}')"><div class="rn-row-title">${esc(n.title || 'Untitled note')}</div><div class="rn-row-meta">${esc(shortDate(n.updatedAt || n.createdAt))} · ${countWords(n.text)} words</div><div class="rn-row-preview">${esc(preview(n.text))}</div></div>`).join('')}</div>`).join('') : `<div class="rn-empty">No saved notes found.<br>Tap the compose button to create one.</div>`;
    shell(`<div class="rn-top"><div></div><button class="rn-circle" onclick="closeO('readerNotesModal')">${svg('close')}</button></div><div class="rn-head"><div class="rn-title">Reader Notes</div><div class="rn-sub">${D.readerNotes.length} note${D.readerNotes.length === 1 ? '' : 's'}</div></div><div class="rn-search-wrap"><div class="rn-search">${svg('search')}<input value="${esc(query)}" placeholder="Search notes" oninput="renderReaderNotesListIOS(this.value)"></div></div><div class="rn-content">${list}</div><div class="rn-bottom"><div></div><button class="rn-fab" onclick="newReaderNoteIOS()">${svg('edit')}</button></div>`);
  }

  function renderDetail(id) {
    const n = note(id); if (!n) return renderList();
    shell(`<div class="rn-top"><button class="rn-circle" onclick="renderReaderNotesListIOS()">${svg('back')}</button><div class="rn-actions"><button class="rn-circle" onclick="editReaderNoteIOS('${esc(id)}')">${svg('edit')}</button><button class="rn-circle" onclick="showReaderNoteMenuIOS('${esc(id)}')">${svg('more')}</button></div></div><div class="rn-content"><div class="rn-detail-title">${esc(n.title || 'Untitled note')}</div><div class="rn-detail-meta">${esc(detailDate(n.updatedAt || n.createdAt))} · ${countWords(n.text)} words</div><div class="rn-detail-body">${esc(n.text || '')}</div></div><div class="rn-bottom"><div class="rn-tools"><button class="rn-tool" onclick="openReaderNote('${esc(id)}')">${svg('book')}</button></div><button class="rn-fab" onclick="newReaderNoteIOS()">${svg('edit')}</button></div>`);
  }

  function renderEditor(id = '') {
    editId = id || '';
    const n = id ? note(id) : null;
    const fromReader = readerText().trim();
    const title = n ? n.title : (fromReader ? titleFrom(fromReader) : '');
    const text = n ? n.text : fromReader;
    undoText = text || '';
    shell(`<div class="rn-top"><button class="rn-circle" onclick="cancelReaderNoteEditorIOS()">${svg('back')}</button><div class="rn-actions"><button class="rn-circle" onclick="undoReaderNoteEditIOS()">${svg('undo')}</button><button class="rn-circle" onclick="saveReaderNoteEditorIOS()">${svg('check')}</button></div></div><div class="rn-editor"><input id="rnEditorTitle" class="rn-title-input" value="${esc(title)}" placeholder="Title"><textarea id="rnEditorText" class="rn-text-input" placeholder="Start writing...">${esc(text || '')}</textarea></div><div class="rn-bottom"><div class="rn-tools"><button class="rn-tool" onclick="insertReaderNoteChecklistIOS()">${svg('checklist')}</button><button class="rn-tool" onclick="toast('Attachment is planned for a later version')">${svg('attach')}</button><button class="rn-tool" onclick="openCurrentEditorTextInReaderIOS()">${svg('book')}</button></div><button class="rn-fab" onclick="saveReaderNoteEditorIOS()">${svg('check')}</button></div>`);
    setTimeout(() => document.getElementById('rnEditorText')?.focus({ preventScroll:true }), 0);
  }

  window.openReaderNotesModal = function() { ensureNotes(); modal(); renderList(); openO('readerNotesModal'); };
  window.renderReaderNotesListIOS = window.renderReaderNotesList = renderList;
  window.openReaderNoteDetailIOS = window.openReaderNoteDetail = renderDetail;
  window.editReaderNoteIOS = window.editReaderNote = renderEditor;
  window.newReaderNoteIOS = () => renderEditor('');
  window.cancelReaderNoteEditorIOS = () => editId ? renderDetail(editId) : renderList();
  window.undoReaderNoteEditIOS = () => { const t = document.getElementById('rnEditorText'); if (t) t.value = undoText; };
  window.showReaderNoteMenuIOS = function(id) { document.getElementById('rnMenu')?.remove(); const body = document.getElementById('readerNotesBody'); if (body) body.insertAdjacentHTML('beforeend', `<div id="rnMenu" class="rn-menu"><button onclick="openReaderNote('${esc(id)}')">Open in Reader</button><button onclick="editReaderNoteIOS('${esc(id)}')">Edit</button><button onclick="shareReaderNoteIOS('${esc(id)}')">Share text</button><button class="danger" onclick="deleteReaderNoteIOS('${esc(id)}')">Delete</button></div>`); };
  window.renderMenu = window.showReaderNoteMenuIOS;

  window.insertReaderNoteChecklistIOS = function() { const t = document.getElementById('rnEditorText'); if (!t) return; const s = t.selectionStart || 0, e = t.selectionEnd || 0; const ins = `${s && t.value[s - 1] !== '\n' ? '\n' : ''}☐ `; t.value = t.value.slice(0, s) + ins + t.value.slice(e); t.focus(); t.setSelectionRange(s + ins.length, s + ins.length); };
  window.openCurrentEditorTextInReaderIOS = function() { const text = document.getElementById('rnEditorText')?.value || ''; if (!text.trim()) return toast('Note text is empty'); const input = document.getElementById('readerInput'); if (input) input.value = text; D.reader.text = text; localStorage.setItem('wordjar_reader_note_v1', text); closeO('readerNotesModal'); if (typeof processReaderText === 'function') processReaderText(); else if (typeof renderReader === 'function') renderReader(); };
  window.saveReaderNoteEditorIOS = function() { ensureNotes(); const title = document.getElementById('rnEditorTitle')?.value || ''; const text = document.getElementById('rnEditorText')?.value || ''; if (!text.trim()) return toast('Note text is empty'); let n = editId ? note(editId) : null; if (!n) { n = { id:'rn' + Date.now() + '-' + Math.random().toString(36).slice(2,6), title:'', text:'', createdAt:nowLabel(), updatedAt:nowLabel() }; D.readerNotes.push(n); editId = n.id; } saveObj(n, title, text); D.reader.activeNoteId = n.id; save(); syncReader(n); toast('Note saved'); renderDetail(n.id); };
  window.shareReaderNoteIOS = function(id) { const n = note(id); if (!n) return; const text = `${n.title || 'Untitled note'}\n\n${n.text || ''}`; if (navigator.share) navigator.share({ title:n.title || 'Reader note', text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied note text')); else toast('Share is not available'); };
  window.deleteReaderNoteIOS = window.deleteReaderNote = function(id) { ensureNotes(); const n = note(id); if (!n) return; if (!confirm(`Delete note "${n.title || 'Untitled note'}"?`)) return; D.readerNotes = D.readerNotes.filter(x => String(x.id) !== String(id)); if (String(D.reader.activeNoteId || '') === String(id)) D.reader.activeNoteId = ''; save(); toast('Note deleted'); renderList(); };
})();
