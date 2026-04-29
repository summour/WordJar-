// WordJar Reader Notes UX Manager V1
// Overrides the rich notes manager with a cleaner Notes-like flow, folder support, and logical toolbar groups.

(function installReaderNotesUXManager() {
  if (window.__wordjarReaderNotesUXManagerInstalled) return;
  window.__wordjarReaderNotesUXManagerInstalled = true;

  const RICH_READER_CLASS = 'reader-rich-note-view';
  const ALL_FOLDER = 'all';
  const UNCATEGORIZED_FOLDER = 'uncategorized';

  let currentFolderId = ALL_FOLDER;
  let currentQuery = '';
  let selectMode = false;
  let selected = new Set();
  let editingId = '';
  let activeToolbar = 'format';
  let currentHighlightColor = '#fff2a8';
  let savedRange = null;

  function ensureData() {
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    if (!Array.isArray(D.readerNoteFolders)) D.readerNoteFolders = [];
    D.readerNotes.forEach(n => {
      if (!n.folderId) n.folderId = UNCATEGORIZED_FOLDER;
      if (!n.createdAt) n.createdAt = n.updatedAt || nowLabel();
      if (!n.updatedAt) n.updatedAt = n.createdAt;
      if (!n.text && n.html) n.text = plainFromHTML(n.html);
      if (!n.html && n.text) n.html = esc(n.text).replace(/\n/g, '<br>');
    });
  }

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

  function nowLabel() {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }

  function titleFrom(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 58) || 'Untitled note';
  }

  function plainFromHTML(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function notePlain(note) {
    return String(note?.text || plainFromHTML(note?.html || '') || '').trim();
  }

  function noteHTML(note) {
    if (note?.html) return sanitizeHTML(note.html);
    return esc(notePlain(note)).replace(/\n/g, '<br>');
  }

  function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function previewText(text, limit = 112) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  }

  function validColor(value, fallback = '#fff2a8') {
    const v = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    const rgb = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgb) {
      const [r, g, b] = rgb.slice(1).map(n => Math.max(0, Math.min(255, Number(n))));
      return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    }
    return fallback;
  }

  function sanitizeHTML(html) {
    const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','SPAN','MARK','UL','OL','LI','A','BLOCKQUOTE']);
    const box = document.createElement('div');
    box.innerHTML = String(html || '');

    function clean(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;

        if (!allowed.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent || ''));
          return;
        }

        [...child.attributes].forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name === 'href' && child.tagName === 'A') {
            const href = attr.value || '';
            if (/^(https?:|mailto:)/i.test(href)) {
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener noreferrer');
            } else child.removeAttribute(attr.name);
            return;
          }
          if (name !== 'style' && name !== 'data-color') child.removeAttribute(attr.name);
        });

        const style = child.getAttribute('style') || '';
        const safe = [];
        const bg = style.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,6}|rgb\([^)]*\)|[a-z]+)\s*/i);
        const color = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{3,6}|rgb\([^)]*\)|[a-z]+)\s*/i);
        if (/text-decoration[^;]*underline/i.test(style)) safe.push('text-decoration: underline');
        if (/text-decoration[^;]*line-through/i.test(style)) safe.push('text-decoration: line-through');
        if (bg) safe.push(`background-color: ${validColor(bg[1])}`);
        if (color) safe.push(`color: ${validColor(color[1], '#111111')}`);
        if (safe.length) child.setAttribute('style', safe.join('; '));
        else child.removeAttribute('style');
        clean(child);
      });
    }
    clean(box);
    return box.innerHTML;
  }

  function noteById(id) {
    ensureData();
    return D.readerNotes.find(n => String(n.id) === String(id));
  }

  function folderName(folderId) {
    if (folderId === ALL_FOLDER) return 'All Notes';
    if (folderId === UNCATEGORIZED_FOLDER) return 'Notes';
    return D.readerNoteFolders.find(f => String(f.id) === String(folderId))?.name || 'Folder';
  }

  function foldersWithCounts() {
    ensureData();
    return [
      { id: ALL_FOLDER, name: 'All Notes', count: D.readerNotes.length, system: true },
      { id: UNCATEGORIZED_FOLDER, name: 'Notes', count: D.readerNotes.filter(n => !n.folderId || n.folderId === UNCATEGORIZED_FOLDER).length, system: true },
      ...D.readerNoteFolders.map(f => ({ ...f, count: D.readerNotes.filter(n => String(n.folderId) === String(f.id)).length }))
    ];
  }

  function dateObj(value) {
    const d = new Date(String(value || '').replace(' ', 'T'));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function shortDate(value) {
    const d = dateObj(value);
    if (!d) return '';
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay(d, today)) return `Today · ${time}`;
    if (sameDay(d, y)) return `Yesterday · ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
  }

  function detailDate(value) {
    const d = dateObj(value);
    if (!d) return '';
    return `${d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function groupLabel(value) {
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

  function readerText() {
    return document.getElementById('readerInput')?.value || '';
  }

  function injectStyles() {
    if (document.getElementById('readerNotesUXStyle')) return;
    const style = document.createElement('style');
    style.id = 'readerNotesUXStyle';
    style.textContent = `
      #readerNotesModal.rn-manager { backdrop-filter: blur(8px); background:rgba(18,18,22,.20); }
      #readerNotesModal.rn-manager .modal-card { width:min(94vw,430px); max-height:min(88vh,780px); padding:0; overflow:hidden; border-radius:26px; border:1px solid var(--bdr); background:var(--bg); box-shadow:0 24px 64px rgba(0,0,0,.14); }
      .rn-shell { height:min(88vh,780px); display:flex; flex-direction:column; position:relative; background:var(--bg); color:var(--ink); }
      .rn-top { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 18px 8px; }
      .rn-left,.rn-actions { display:flex; align-items:center; gap:10px; min-width:0; }
      .rn-circle { width:40px; height:40px; min-width:40px; border-radius:999px; border:1px solid var(--bdr); background:var(--sur); color:var(--ink); display:inline-flex; align-items:center; justify-content:center; padding:0; box-shadow:0 8px 22px rgba(0,0,0,.055); }
      .rn-circle svg { width:20px; height:20px; stroke-width:2.45; }
      .rn-text-btn { height:40px; border:1px solid var(--bdr); background:var(--sur); color:var(--ink); border-radius:999px; padding:0 14px; font-size:13px; font-weight:900; display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; }
      .rn-text-btn.primary { color:var(--brand,#2f7cf6); }
      .rn-head { padding:2px 20px 10px; }
      .rn-title { font-size:30px; line-height:1.05; letter-spacing:-.045em; font-weight:950; color:var(--ink); }
      .rn-sub { margin-top:6px; color:var(--ink2); font-size:13px; font-weight:800; }
      .rn-search-wrap { padding:0 20px 10px; }
      .rn-search { height:44px; display:flex; align-items:center; gap:10px; padding:0 14px; border-radius:16px; border:1px solid var(--bdr); background:var(--sur); }
      .rn-search input { flex:1; min-width:0; border:0; outline:0; background:transparent; color:var(--ink); font:inherit; font-size:15px; font-weight:750; }
      .rn-folder-strip { display:flex; gap:8px; overflow-x:auto; padding:0 20px 12px; scrollbar-width:none; }
      .rn-folder-strip::-webkit-scrollbar { display:none; }
      .rn-folder-chip { height:34px; padding:0 12px; border-radius:999px; border:1px solid var(--bdr); background:var(--sur); color:var(--ink2); font-size:12px; font-weight:900; white-space:nowrap; }
      .rn-folder-chip.active { color:var(--ink); background:var(--sur2); box-shadow:0 0 0 1px var(--ink) inset; }
      .rn-content { flex:1 1 auto; min-height:0; overflow:auto; padding:0 20px 108px; }
      .rn-group { margin:14px 2px 8px; font-size:15px; font-weight:950; color:var(--ink); }
      .rn-list { border:1px solid var(--bdr); border-radius:22px; background:var(--sur2); overflow:hidden; }
      .rn-row { min-height:74px; padding:14px 16px 13px; border-bottom:1px solid var(--bdr); cursor:pointer; display:flex; align-items:flex-start; gap:12px; transition:background .12s ease; }
      .rn-row:last-child { border-bottom:0; }
      .rn-row:active { background:rgba(0,0,0,.035); }
      .rn-check { width:24px; height:24px; min-width:24px; border-radius:999px; border:2px solid var(--bdr); display:none; align-items:center; justify-content:center; margin-top:2px; color:white; background:transparent; }
      .rn-selecting .rn-check { display:flex; }
      .rn-row.selected .rn-check { border-color:var(--brand,#2f7cf6); background:var(--brand,#2f7cf6); }
      .rn-row-main { min-width:0; flex:1; }
      .rn-row-title { font-size:17px; line-height:1.24; font-weight:900; color:var(--ink); margin-bottom:4px; }
      .rn-row-meta { font-size:12px; color:var(--ink2); font-weight:800; margin-bottom:6px; }
      .rn-row-preview { font-size:13px; line-height:1.42; color:var(--ink2); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .rn-empty { border:1px solid var(--bdr); border-radius:22px; background:var(--sur2); padding:28px 18px; color:var(--ink2); text-align:center; font-size:13px; font-weight:800; line-height:1.5; }
      .rn-detail-title { font-size:30px; line-height:1.08; letter-spacing:-.04em; font-weight:950; margin:2px 0 6px; }
      .rn-detail-meta { color:var(--ink2); font-size:12px; font-weight:850; margin-bottom:16px; }
      .rn-detail-folder { color:var(--ink2); font-size:12px; font-weight:850; margin-bottom:12px; }
      .rn-detail-body { color:var(--ink); font-size:16px; line-height:1.62; padding-bottom:14px; word-wrap:break-word; }
      .rn-detail-body mark,.rn-editor-body mark,.${RICH_READER_CLASS} mark { border-radius:4px; padding:0 2px; }
      .rn-editor { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; padding:0 20px 132px; }
      .rn-title-input { border:0; outline:0; background:transparent; color:var(--ink); font-size:30px; line-height:1.08; font-weight:950; letter-spacing:-.04em; padding:4px 0 8px; width:100%; }
      .rn-editor-meta { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
      .rn-folder-select { height:34px; border:1px solid var(--bdr); border-radius:12px; background:var(--sur); color:var(--ink2); font-size:12px; font-weight:850; padding:0 10px; max-width:100%; }
      .rn-editor-body { flex:1 1 auto; min-height:0; overflow:auto; outline:0; color:var(--ink); font:inherit; font-size:16px; line-height:1.62; padding:4px 0 0; white-space:pre-wrap; }
      .rn-editor-body:empty:before { content:attr(data-placeholder); color:var(--ink2); }
      .rn-bottom { position:absolute; left:20px; right:20px; bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:12px; pointer-events:none; }
      .rn-toolbar-wrap { pointer-events:auto; max-width:calc(100% - 66px); display:grid; gap:7px; }
      .rn-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; background:rgba(255,255,255,.78); border:1px solid var(--bdr); border-radius:16px; padding:5px; box-shadow:0 12px 28px rgba(0,0,0,.08); }
      .rn-tab { height:30px; border:0; border-radius:11px; background:transparent; color:var(--ink2); font-size:12px; font-weight:950; }
      .rn-tab.active { background:var(--ink); color:var(--sur); }
      .rn-tools { display:flex; align-items:center; gap:12px; padding:10px 13px; border:1px solid var(--bdr); border-radius:18px; background:var(--sur); box-shadow:0 16px 34px rgba(0,0,0,.10); overflow-x:auto; scrollbar-width:none; }
      .rn-tools::-webkit-scrollbar { display:none; }
      .rn-tool { min-width:30px; height:30px; border:0; border-radius:10px; background:transparent; color:var(--ink); padding:0; display:inline-flex; align-items:center; justify-content:center; font-size:20px; font-weight:950; line-height:1; }
      .rn-tool:active { background:var(--sur2); }
      .rn-tool svg { width:23px; height:23px; stroke-width:2.4; }
      .rn-color { width:30px; height:30px; min-width:30px; padding:0; border:2px solid var(--bdr); border-radius:999px; overflow:hidden; background:transparent; }
      .rn-color input { width:38px; height:38px; border:0; padding:0; margin:-4px; background:transparent; }
      .rn-swatch { width:28px; height:28px; min-width:28px; border:1px solid var(--bdr); border-radius:999px; }
      .rn-fab { pointer-events:auto; width:54px; height:54px; min-width:54px; border-radius:18px; border:1px solid var(--bdr); background:var(--sur); color:var(--brand,#2f7cf6); display:inline-flex; align-items:center; justify-content:center; box-shadow:0 16px 34px rgba(0,0,0,.10); padding:0; }
      .rn-fab svg { width:26px; height:26px; stroke-width:2.5; }
      .rn-menu { position:absolute; top:66px; right:20px; min-width:210px; border:1px solid var(--bdr); border-radius:16px; background:var(--sur); overflow:hidden; box-shadow:0 18px 38px rgba(0,0,0,.14); z-index:4; }
      .rn-menu button { width:100%; border:0; background:transparent; color:var(--ink); text-align:left; padding:13px 14px; font-size:14px; font-weight:850; }
      .rn-menu button + button { border-top:1px solid var(--bdr); }
      .rn-menu .danger { color:#e24a4a; }
      .rn-selection-bar { position:absolute; left:20px; right:20px; bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .rn-selection-bar .btn { height:46px; border-radius:16px; min-width:0; }
      .reader-rich-badge { display:inline-flex; align-items:center; gap:6px; margin-bottom:10px; padding:7px 10px; border:1px solid var(--bdr); background:var(--sur2); border-radius:999px; color:var(--ink2); font-size:12px; font-weight:850; }
      .${RICH_READER_CLASS} { font-size:17px; line-height:1.85; color:var(--ink); word-break:break-word; }
      .${RICH_READER_CLASS} .reader-token { display:inline; border-radius:8px; padding:1px 2px; cursor:pointer; }
      #readerNoteActions { display:block !important; }
      #readerNoteActions .reader-note-actions { grid-template-columns:1fr 1fr !important; }
      #readerNoteActions .reader-note-actions:nth-of-type(2) { display:none !important; }
      @media (max-width:420px) { #readerNotesModal.rn-manager .modal-card { width:100vw; height:100vh; max-height:100vh; border-radius:0; } .rn-shell{height:100vh;} .rn-title,.rn-detail-title,.rn-title-input{font-size:28px;} .rn-bottom{left:14px;right:14px;} .rn-toolbar-wrap{max-width:calc(100% - 62px);} }
    `;
    document.head.appendChild(style);
  }

  function svg(name) {
    const icons = {
      close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      back:'<path d="M15 18l-6-6 6-6"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',
      check:'<path d="M20 6L9 17l-5-5"/>',
      search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
      more:'<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
      book:'<path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
      underline:'<path d="M6 4v6a6 6 0 0012 0V4"/><path d="M4 21h16"/>',
      strike:'<path d="M17 9a4 4 0 00-4-4H9.5a3.5 3.5 0 000 7H15a3.5 3.5 0 010 7H9a4 4 0 01-4-4"/><path d="M4 12h16"/>',
      highlight:'<path d="M9 11l6-6 4 4-6 6"/><path d="M4 20h16"/><path d="M13 15l-4 1-1-4"/>',
      checklist:'<path d="M9 6l1.5 1.5L14 4"/><path d="M4 6h1"/><path d="M17 6h3"/><path d="M4 12h1"/><path d="M9 12h11"/><path d="M4 18h1"/><path d="M9 18h11"/>',
      bullet:'<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
      number:'<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 5h1v4"/><path d="M4 11h2l-2 3h2"/><path d="M4 17h2v4H4"/>',
      link:'<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
      indent:'<path d="M3 6h18"/><path d="M3 12h10"/><path d="M3 18h18"/><path d="M15 10l3 2-3 2"/>',
      outdent:'<path d="M3 6h18"/><path d="M11 12h10"/><path d="M3 18h18"/><path d="M9 10l-3 2 3 2"/>'
    };
    const fill = name === 'more' ? 'currentColor' : 'none';
    const stroke = name === 'more' ? 'none' : 'currentColor';
    return `<svg viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}">${icons[name] || ''}</svg>`;
  }

  function ensureModal() {
    injectStyles();
    let m = document.getElementById('readerNotesModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'readerNotesModal';
      document.body.appendChild(m);
    }
    m.className = 'overlay rn-manager';
    m.onclick = e => { if (e.target === m) closeO('readerNotesModal'); };
    m.innerHTML = `<div class="modal-card" onclick="event.stopPropagation()"><div id="readerNotesBody"></div></div>`;
    return m;
  }

  function shell(html) {
    const body = document.getElementById('readerNotesBody');
    if (body) body.innerHTML = `<div class="rn-shell">${html}</div>`;
  }

  function visibleNotes() {
    ensureData();
    const q = String(currentQuery || '').trim().toLowerCase();
    return D.readerNotes
      .slice()
      .sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .filter(n => currentFolderId === ALL_FOLDER || String(n.folderId || UNCATEGORIZED_FOLDER) === String(currentFolderId))
      .filter(n => !q || [n.title, notePlain(n), folderName(n.folderId || UNCATEGORIZED_FOLDER)].join(' ').toLowerCase().includes(q));
  }

  function folderStripHTML() {
    return `<div class="rn-folder-strip">${foldersWithCounts().map(f => `
      <button class="rn-folder-chip ${String(currentFolderId) === String(f.id) ? 'active' : ''}" type="button" onclick="setReaderNotesFolder('${esc(f.id)}')">
        ${esc(f.name)} · ${f.count}
      </button>
    `).join('')}</div>`;
  }

  function renderList(query = currentQuery) {
    ensureData();
    currentQuery = query || '';
    const notes = visibleNotes();
    const groups = new Map();
    notes.forEach(n => {
      const g = groupLabel(n.updatedAt || n.createdAt);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(n);
    });

    const noteRows = notes.length
      ? ['Today','Yesterday','Previous 7 Days','Older'].filter(g => groups.has(g)).map(g => `
        <div class="rn-group">${g}</div>
        <div class="rn-list ${selectMode ? 'rn-selecting' : ''}">
          ${groups.get(g).map(n => {
            const isSel = selected.has(String(n.id));
            return `<div class="rn-row ${isSel ? 'selected' : ''}" onclick="handleReaderNoteRow('${esc(n.id)}')">
              <div class="rn-check">${isSel ? svg('check') : ''}</div>
              <div class="rn-row-main">
                <div class="rn-row-title">${esc(n.title || 'Untitled note')}</div>
                <div class="rn-row-meta">${esc(shortDate(n.updatedAt || n.createdAt))} · ${esc(folderName(n.folderId || UNCATEGORIZED_FOLDER))} · ${wordCount(notePlain(n))} words</div>
                <div class="rn-row-preview">${esc(previewText(notePlain(n)))}</div>
              </div>
            </div>`;
          }).join('')}
        </div>`).join('')
      : `<div class="rn-empty">No notes here yet.<br>Create a note or switch folders.</div>`;

    const bottom = selectMode
      ? `<div class="rn-selection-bar"><button class="btn btn-s" type="button" onclick="selectAllReaderNotes()">${selected.size === notes.length && notes.length ? 'Clear All' : 'Select All'}</button><button class="btn btn-s" type="button" onclick="deleteSelectedReaderNotes()" style="color:#e24a4a;">Delete (${selected.size})</button></div>`
      : `<div class="rn-bottom"><div></div><button class="rn-fab" type="button" onclick="newReaderNoteIOS()" aria-label="New Note">${svg('edit')}</button></div>`;

    shell(`
      <div class="rn-top">
        <div class="rn-left">
          ${D.readerNotes.length ? `<button class="rn-text-btn" type="button" onclick="toggleReaderNoteSelectMode()">${selectMode ? 'Cancel' : 'Select'}</button>` : ''}
          <button class="rn-text-btn primary" type="button" onclick="newReaderNoteIOS()">New Note</button>
        </div>
        <div class="rn-actions">
          <button class="rn-text-btn" type="button" onclick="createReaderNoteFolder()">New Folder</button>
          <button class="rn-circle" type="button" onclick="closeO('readerNotesModal')">${svg('close')}</button>
        </div>
      </div>
      <div class="rn-head"><div class="rn-title">${esc(folderName(currentFolderId))}</div><div class="rn-sub">${notes.length} note${notes.length === 1 ? '' : 's'}</div></div>
      <div class="rn-search-wrap"><div class="rn-search">${svg('search')}<input value="${esc(currentQuery)}" placeholder="Search notes" oninput="renderReaderNotesListIOS(this.value)"></div></div>
      ${folderStripHTML()}
      <div class="rn-content">${noteRows}</div>${bottom}
    `);
  }

  function renderDetail(id) {
    const n = noteById(id);
    if (!n) return renderList();
    shell(`
      <div class="rn-top">
        <button class="rn-circle" type="button" onclick="renderReaderNotesListIOS()">${svg('back')}</button>
        <div class="rn-actions">
          <button class="rn-text-btn primary" type="button" onclick="openReaderNote('${esc(id)}')">Open in Reader</button>
          <button class="rn-circle" type="button" onclick="showReaderNoteManageMenu('${esc(id)}')">${svg('more')}</button>
        </div>
      </div>
      <div class="rn-content">
        <div class="rn-detail-title">${esc(n.title || 'Untitled note')}</div>
        <div class="rn-detail-meta">${esc(detailDate(n.updatedAt || n.createdAt))} · ${wordCount(notePlain(n))} words</div>
        <div class="rn-detail-folder">Folder: ${esc(folderName(n.folderId || UNCATEGORIZED_FOLDER))}</div>
        <div class="rn-detail-body">${noteHTML(n)}</div>
      </div>
      <div class="rn-bottom"><div></div><button class="rn-fab" type="button" onclick="editReaderNoteIOS('${esc(id)}')">${svg('edit')}</button></div>
    `);
  }

  function saveSelectionRange() {
    const sel = window.getSelection();
    const editor = document.getElementById('rnEditorBody');
    if (!sel || !editor || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
  }

  function restoreSelectionRange() {
    if (!savedRange) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function folderSelectHTML(value) {
    const ids = foldersWithCounts().filter(f => f.id !== ALL_FOLDER);
    return `<select id="rnEditorFolder" class="rn-folder-select">${ids.map(f => `<option value="${esc(f.id)}" ${String(value || UNCATEGORIZED_FOLDER) === String(f.id) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>`;
  }

  function toolbarButtons() {
    const swatches = ['#fff2a8','#d7f9d2','#cdefff','#ffd6e8','#e6d7ff','#ffd6a5'];
    const panels = {
      format: `<button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('bold')">B</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('italic')"><i>I</i></button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('underline')">${svg('underline')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('strike')">${svg('strike')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); clearReaderNoteFormatting()">Aa</button>`,
      highlight: `<button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('highlight')">${svg('highlight')}</button>${swatches.map(c => `<button class="rn-swatch" type="button" style="background:${c}" onmousedown="event.preventDefault(); setReaderHighlightColor('${c}'); formatReaderNote('highlight')"></button>`).join('')}<label class="rn-color"><input id="rnColorPicker" type="color" value="${currentHighlightColor}" onchange="setReaderHighlightColor(this.value); formatReaderNote('highlight')"></label>`,
      list: `<button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('bullet')">${svg('bullet')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('number')">${svg('number')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); insertReaderNoteChecklistIOS()">${svg('checklist')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('outdent')">${svg('outdent')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); formatReaderNote('indent')">${svg('indent')}</button>`,
      insert: `<button class="rn-tool" type="button" onmousedown="event.preventDefault(); createReaderNoteLink()">${svg('link')}</button><button class="rn-tool" type="button" onmousedown="event.preventDefault(); openCurrentEditorTextInReaderIOS()">${svg('book')}</button>`
    };
    return `
      <div class="rn-toolbar-wrap" onmousedown="saveReaderNoteSelection()" ontouchstart="saveReaderNoteSelection()">
        <div class="rn-tabs">
          ${['format','highlight','list','insert'].map(k => `<button class="rn-tab ${activeToolbar === k ? 'active' : ''}" type="button" onmousedown="event.preventDefault(); setReaderToolbar('${k}')">${k === 'format' ? 'Text' : k === 'highlight' ? 'Color' : k === 'list' ? 'List' : 'Insert'}</button>`).join('')}
        </div>
        <div class="rn-tools">${panels[activeToolbar] || panels.format}</div>
      </div>`;
  }

  function renderEditor(id = '') {
    ensureData();
    editingId = id || '';
    savedRange = null;
    activeToolbar = 'format';
    const n = id ? noteById(id) : null;
    const fromReader = readerText().trim();
    const title = n ? (n.title || '') : (fromReader ? titleFrom(fromReader) : '');
    const html = n ? noteHTML(n) : esc(fromReader).replace(/\n/g, '<br>');
    const folderId = n?.folderId || (currentFolderId !== ALL_FOLDER ? currentFolderId : UNCATEGORIZED_FOLDER);

    shell(`
      <div class="rn-top">
        <button class="rn-circle" type="button" onclick="cancelReaderNoteEditor()">${svg('back')}</button>
        <button class="rn-text-btn primary" type="button" onclick="saveReaderNoteEditorIOS()">Done</button>
      </div>
      <div class="rn-editor">
        <input id="rnEditorTitle" class="rn-title-input" value="${esc(title)}" placeholder="Title">
        <div class="rn-editor-meta">${folderSelectHTML(folderId)}</div>
        <div id="rnEditorBody" class="rn-editor-body" contenteditable="true" data-placeholder="Start writing...">${html}</div>
      </div>
      <div class="rn-bottom">${toolbarButtons()}<button class="rn-fab" type="button" onclick="saveReaderNoteEditorIOS()">${svg('check')}</button></div>
    `);

    const editor = document.getElementById('rnEditorBody');
    if (editor) {
      ['keyup','mouseup','touchend'].forEach(evt => editor.addEventListener(evt, saveSelectionRange));
      setTimeout(() => editor.focus({ preventScroll:true }), 0);
    }
  }

  function saveEditor() {
    ensureData();
    const title = document.getElementById('rnEditorTitle')?.value || '';
    const body = document.getElementById('rnEditorBody');
    const folderId = document.getElementById('rnEditorFolder')?.value || UNCATEGORIZED_FOLDER;
    const html = sanitizeHTML(body?.innerHTML || '');
    const text = plainFromHTML(html);
    if (!text) return toast('Note text is empty');

    let n = editingId ? noteById(editingId) : null;
    if (!n) {
      n = { id:'rn' + Date.now() + '-' + Math.random().toString(36).slice(2,6), title:'', text:'', html:'', folderId, createdAt:nowLabel(), updatedAt:nowLabel() };
      D.readerNotes.push(n);
      editingId = n.id;
    }
    n.title = String(title || '').trim() || titleFrom(text);
    n.text = text;
    n.html = html;
    n.folderId = folderId;
    n.updatedAt = nowLabel();
    if (!n.createdAt) n.createdAt = n.updatedAt;
    D.reader.activeNoteId = n.id;
    save();
    toast('Note saved');
    renderDetail(n.id);
  }

  function makeReaderRichInteractive(html) {
    const root = document.createElement('div');
    root.innerHTML = sanitizeHTML(html);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return /[A-Za-z]/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      const frag = document.createDocumentFragment();
      const parts = String(node.nodeValue || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|[^A-Za-z]+/g) || [];
      parts.forEach(part => {
        if (/^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(part)) {
          const span = document.createElement('span');
          span.className = 'reader-token';
          span.dataset.word = part;
          span.textContent = part;
          frag.appendChild(span);
        } else frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    });
    return root.innerHTML;
  }

  function applyRichReaderView() {
    if (!D.reader?.isRichNote || !D.reader?.richHTML) return;
    const tokens = document.getElementById('readerTokens');
    if (!tokens) return;
    tokens.innerHTML = `<div class="reader-rich-badge">Saved note · rich text</div><div class="${RICH_READER_CLASS}">${makeReaderRichInteractive(D.reader.richHTML)}</div>`;
    const countEl = document.getElementById('readerCount');
    if (countEl) countEl.textContent = `${wordCount(D.reader.text || plainFromHTML(D.reader.richHTML))} words`;
  }

  function clearRichModeOnManualEdit() {
    const input = document.getElementById('readerInput');
    if (!input || input.__wordjarRichClearBoundV2) return;
    input.addEventListener('input', () => {
      D.reader.isRichNote = false;
      D.reader.richHTML = '';
    });
    input.__wordjarRichClearBoundV2 = true;
  }

  window.openReaderNotesModal = function openReaderNotesModalUX() {
    ensureData();
    ensureModal();
    selectMode = false;
    selected.clear();
    currentQuery = '';
    renderList();
    openO('readerNotesModal');
  };

  window.renderReaderNotesListIOS = window.renderReaderNotesList = renderList;
  window.openReaderNoteDetailIOS = window.openReaderNoteDetail = renderDetail;
  window.editReaderNoteIOS = window.editReaderNote = renderEditor;
  window.newReaderNoteIOS = function newReaderNoteIOS() { renderEditor(''); };
  window.cancelReaderNoteEditor = function cancelReaderNoteEditor() { editingId ? renderDetail(editingId) : renderList(); };
  window.saveReaderNoteEditorIOS = saveEditor;
  window.saveReaderNoteSelection = saveSelectionRange;

  window.setReaderNotesFolder = function setReaderNotesFolder(folderId) {
    currentFolderId = folderId || ALL_FOLDER;
    selectMode = false;
    selected.clear();
    renderList();
  };

  window.createReaderNoteFolder = function createReaderNoteFolder() {
    ensureData();
    const name = prompt('Folder name');
    if (!name || !name.trim()) return;
    const clean = name.trim().slice(0, 40);
    const existing = D.readerNoteFolders.some(f => f.name.toLowerCase() === clean.toLowerCase());
    if (existing) return toast('Folder already exists');
    const folder = { id:'rnf' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: clean, createdAt: nowLabel() };
    D.readerNoteFolders.push(folder);
    currentFolderId = folder.id;
    save();
    toast('Folder created');
    renderList();
  };

  window.handleReaderNoteRow = function handleReaderNoteRow(id) {
    if (selectMode) {
      if (selected.has(String(id))) selected.delete(String(id));
      else selected.add(String(id));
      renderList();
    } else renderDetail(id);
  };

  window.toggleReaderNoteSelectMode = function toggleReaderNoteSelectMode() {
    selectMode = !selectMode;
    selected.clear();
    renderList();
  };

  window.selectAllReaderNotes = function selectAllReaderNotes() {
    const ids = visibleNotes().map(n => String(n.id));
    if (selected.size === ids.length) selected.clear();
    else ids.forEach(id => selected.add(id));
    renderList();
  };

  window.deleteSelectedReaderNotes = function deleteSelectedReaderNotes() {
    if (!selected.size) return toast('No notes selected');
    if (!confirm(`Delete ${selected.size} selected note${selected.size === 1 ? '' : 's'}?`)) return;
    D.readerNotes = D.readerNotes.filter(n => !selected.has(String(n.id)));
    if (selected.has(String(D.reader.activeNoteId || ''))) D.reader.activeNoteId = '';
    selected.clear();
    selectMode = false;
    save();
    renderList();
    toast('Selected notes deleted');
  };

  window.showReaderNoteManageMenu = window.showReaderNoteMenuIOS = function showReaderNoteManageMenu(id) {
    const n = noteById(id);
    if (!n) return;
    document.getElementById('rnMenu')?.remove();
    const body = document.getElementById('readerNotesBody');
    if (!body) return;
    body.insertAdjacentHTML('beforeend', `
      <div id="rnMenu" class="rn-menu">
        <button type="button" onclick="editReaderNoteIOS('${esc(id)}')">Edit Note</button>
        <button type="button" onclick="openReaderNote('${esc(id)}')">Open in Reader</button>
        <button type="button" onclick="moveReaderNoteToFolder('${esc(id)}')">Move to Folder</button>
        <button type="button" onclick="duplicateReaderNote('${esc(id)}')">Duplicate</button>
        <button type="button" onclick="shareReaderNoteIOS('${esc(id)}')">Share Text</button>
        <button class="danger" type="button" onclick="deleteReaderNoteIOS('${esc(id)}')">Delete</button>
      </div>
    `);
  };

  window.moveReaderNoteToFolder = function moveReaderNoteToFolder(id) {
    const n = noteById(id);
    if (!n) return;
    const labels = foldersWithCounts().filter(f => f.id !== ALL_FOLDER).map((f, i) => `${i + 1}. ${f.name}`).join('\n');
    const answer = prompt(`Move to folder:\n${labels}\n\nType folder number or new folder name.`);
    if (!answer) return;
    const folders = foldersWithCounts().filter(f => f.id !== ALL_FOLDER);
    const index = Number(answer.trim()) - 1;
    if (Number.isInteger(index) && folders[index]) n.folderId = folders[index].id;
    else {
      const clean = answer.trim().slice(0, 40);
      let folder = D.readerNoteFolders.find(f => f.name.toLowerCase() === clean.toLowerCase());
      if (!folder) {
        folder = { id:'rnf' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: clean, createdAt: nowLabel() };
        D.readerNoteFolders.push(folder);
      }
      n.folderId = folder.id;
    }
    n.updatedAt = nowLabel();
    save();
    toast('Note moved');
    renderDetail(id);
  };

  window.setReaderToolbar = function setReaderToolbar(tab) {
    activeToolbar = ['format','highlight','list','insert'].includes(tab) ? tab : 'format';
    saveSelectionRange();
    const id = editingId;
    const title = document.getElementById('rnEditorTitle')?.value || '';
    const body = document.getElementById('rnEditorBody')?.innerHTML || '';
    const folder = document.getElementById('rnEditorFolder')?.value || UNCATEGORIZED_FOLDER;
    renderEditor(id);
    const titleEl = document.getElementById('rnEditorTitle');
    const bodyEl = document.getElementById('rnEditorBody');
    const folderEl = document.getElementById('rnEditorFolder');
    if (titleEl) titleEl.value = title;
    if (bodyEl) bodyEl.innerHTML = body;
    if (folderEl) folderEl.value = folder;
  };

  window.setReaderHighlightColor = function setReaderHighlightColor(color) {
    currentHighlightColor = validColor(color);
    const picker = document.getElementById('rnColorPicker');
    if (picker) picker.value = currentHighlightColor;
  };

  window.formatReaderNote = function formatReaderNote(type) {
    const editor = document.getElementById('rnEditorBody');
    if (!editor) return;
    editor.focus();
    restoreSelectionRange();
    document.execCommand('styleWithCSS', false, true);
    if (type === 'bold') document.execCommand('bold', false, null);
    else if (type === 'italic') document.execCommand('italic', false, null);
    else if (type === 'underline') document.execCommand('underline', false, null);
    else if (type === 'strike') document.execCommand('strikeThrough', false, null);
    else if (type === 'highlight') document.execCommand('backColor', false, currentHighlightColor);
    else if (type === 'bullet') document.execCommand('insertUnorderedList', false, null);
    else if (type === 'number') document.execCommand('insertOrderedList', false, null);
    else if (type === 'indent') document.execCommand('indent', false, null);
    else if (type === 'outdent') document.execCommand('outdent', false, null);
    saveSelectionRange();
  };

  window.insertReaderNoteChecklistIOS = function insertReaderNoteChecklistIOS() {
    const editor = document.getElementById('rnEditorBody');
    if (!editor) return;
    editor.focus();
    restoreSelectionRange();
    document.execCommand('insertHTML', false, '☐&nbsp;');
    saveSelectionRange();
  };

  window.createReaderNoteLink = function createReaderNoteLink() {
    const url = prompt('Paste link URL');
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return toast('Use http, https, or mailto links');
    const editor = document.getElementById('rnEditorBody');
    if (!editor) return;
    editor.focus();
    restoreSelectionRange();
    document.execCommand('createLink', false, url);
    saveSelectionRange();
  };

  window.clearReaderNoteFormatting = function clearReaderNoteFormatting() {
    const editor = document.getElementById('rnEditorBody');
    if (!editor) return;
    editor.focus();
    restoreSelectionRange();
    document.execCommand('removeFormat', false, null);
    saveSelectionRange();
  };

  window.openCurrentEditorTextInReaderIOS = function openCurrentEditorTextInReaderIOS() {
    const html = sanitizeHTML(document.getElementById('rnEditorBody')?.innerHTML || '');
    const text = plainFromHTML(html);
    if (!text) return toast('Note text is empty');
    D.reader.activeNoteId = editingId || '';
    D.reader.text = text;
    D.reader.richHTML = html;
    D.reader.isRichNote = true;
    const input = document.getElementById('readerInput');
    if (input) input.value = text;
    localStorage.setItem('wordjar_reader_note_v1', text);
    save();
    closeO('readerNotesModal');
    if (typeof renderReader === 'function') renderReader();
  };

  window.openReaderNote = function openReaderNote(id) {
    const n = noteById(id);
    if (!n) return;
    const text = notePlain(n);
    const html = noteHTML(n);
    D.reader.activeNoteId = n.id;
    D.reader.text = text;
    D.reader.richHTML = html;
    D.reader.isRichNote = true;
    const input = document.getElementById('readerInput');
    if (input) input.value = text;
    localStorage.setItem('wordjar_reader_note_v1', text);
    save();
    closeO('readerNotesModal');
    if (typeof renderReader === 'function') renderReader();
    toast('Opened note in Reader');
  };

  window.duplicateReaderNote = function duplicateReaderNote(id) {
    const n = noteById(id);
    if (!n) return;
    const copy = { ...n, id:'rn' + Date.now() + '-' + Math.random().toString(36).slice(2,6), title:(n.title || 'Untitled note') + ' Copy', createdAt:nowLabel(), updatedAt:nowLabel() };
    D.readerNotes.push(copy);
    save();
    toast('Note duplicated');
    renderList();
  };

  window.shareReaderNoteIOS = function shareReaderNoteIOS(id) {
    const n = noteById(id);
    if (!n) return;
    const text = `${n.title || 'Untitled note'}\n\n${notePlain(n)}`;
    if (navigator.share) navigator.share({ title:n.title || 'Reader note', text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied note text'));
    else toast('Share is not available');
  };

  window.deleteReaderNoteIOS = window.deleteReaderNote = function deleteReaderNoteIOS(id) {
    const n = noteById(id);
    if (!n) return;
    if (!confirm(`Delete note "${n.title || 'Untitled note'}"?`)) return;
    D.readerNotes = D.readerNotes.filter(x => String(x.id) !== String(id));
    if (String(D.reader.activeNoteId || '') === String(id)) {
      D.reader.activeNoteId = '';
      D.reader.richHTML = '';
      D.reader.isRichNote = false;
    }
    save();
    toast('Note deleted');
    renderList();
  };

  window.saveCurrentReaderNoteAsNew = function saveCurrentReaderNoteAsNewUX() {
    const text = readerText().trim();
    if (!text) return newReaderNoteIOS();
    ensureData();
    const html = D.reader?.isRichNote && D.reader?.richHTML ? sanitizeHTML(D.reader.richHTML) : esc(text).replace(/\n/g, '<br>');
    const n = { id:'rn' + Date.now() + '-' + Math.random().toString(36).slice(2,6), title:titleFrom(text), text, html, folderId: currentFolderId !== ALL_FOLDER ? currentFolderId : UNCATEGORIZED_FOLDER, createdAt:nowLabel(), updatedAt:nowLabel() };
    D.readerNotes.push(n);
    D.reader.activeNoteId = n.id;
    save();
    toast('Reader note saved');
  };

  window.updateCurrentReaderNote = function updateCurrentReaderNoteUX() {
    const active = noteById(D.reader?.activeNoteId || '');
    if (!active) return saveCurrentReaderNoteAsNew();
    const text = readerText().trim();
    if (!text) return toast('Nothing to save');
    active.text = text;
    active.html = D.reader?.isRichNote && D.reader?.richHTML ? sanitizeHTML(D.reader.richHTML) : esc(text).replace(/\n/g, '<br>');
    active.title = active.title || titleFrom(text);
    active.updatedAt = nowLabel();
    save();
    toast('Current note updated');
  };

  function makeReaderRichInteractive(html) {
    const root = document.createElement('div');
    root.innerHTML = sanitizeHTML(html);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return /[A-Za-z]/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      const frag = document.createDocumentFragment();
      const parts = String(node.nodeValue || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|[^A-Za-z]+/g) || [];
      parts.forEach(part => {
        if (/^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(part)) {
          const span = document.createElement('span');
          span.className = 'reader-token';
          span.dataset.word = part;
          span.textContent = part;
          frag.appendChild(span);
        } else frag.appendChild(document.createTextNode(part));
      });
      node.replaceWith(frag);
    });
    return root.innerHTML;
  }

  function applyRichReaderView() {
    if (!D.reader?.isRichNote || !D.reader?.richHTML) return;
    const tokens = document.getElementById('readerTokens');
    if (!tokens) return;
    tokens.innerHTML = `<div class="reader-rich-badge">Saved note · rich text</div><div class="${RICH_READER_CLASS}">${makeReaderRichInteractive(D.reader.richHTML)}</div>`;
    const countEl = document.getElementById('readerCount');
    if (countEl) countEl.textContent = `${wordCount(D.reader.text || plainFromHTML(D.reader.richHTML))} words`;
  }

  function clearRichModeOnManualEdit() {
    const input = document.getElementById('readerInput');
    if (!input || input.__wordjarRichClearBoundV3) return;
    input.addEventListener('input', () => {
      D.reader.isRichNote = false;
      D.reader.richHTML = '';
    });
    input.__wordjarRichClearBoundV3 = true;
  }

  const originalRenderReader = window.renderReader;
  window.renderReader = function renderReaderWithUXNotes() {
    if (typeof originalRenderReader === 'function') originalRenderReader();
    clearRichModeOnManualEdit();
    applyRichReaderView();
    const actions = document.getElementById('readerNoteActions');
    if (actions) {
      actions.innerHTML = `
        <div class="reader-note-actions">
          <button class="btn btn-s" type="button" onclick="openReaderNotesModal()">Notes</button>
          <button class="btn btn-p" type="button" onclick="saveCurrentReaderNoteAsNew()">Save as Note</button>
        </div>
        <div id="readerActiveNoteLabel" class="reader-note-active">${D.reader?.activeNoteId ? 'Current saved note loaded' : 'Current: unsaved draft'}</div>
      `;
    }
    const tokens = document.getElementById('readerTokens');
    if (tokens && !tokens.__richClickBoundV3) {
      tokens.addEventListener('click', e => {
        const token = e.target.closest('.reader-token');
        if (token && typeof window.selectReaderWord === 'function') window.selectReaderWord(token);
      });
      tokens.__richClickBoundV3 = true;
    }
  };
})();
