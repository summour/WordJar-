// WordJar Reader Notes Core V1
// Single stable module for Reader Notes. Replaces the layered patch files.

(function installReaderNotesCore() {
  if (window.__wordjarReaderNotesCoreInstalled) return;
  window.__wordjarReaderNotesCoreInstalled = true;

  const ALL = 'all';
  const DEFAULT_FOLDER = 'uncategorized';
  const RICH_CLASS = 'reader-rich-note-view';
  const DEFAULT_CLEAN = {
    mode: 'novel',
    removeHeaders: true,
    removePageNumbers: true,
    normalizeSpaces: true,
    mergeBrokenLines: true,
    preserveHeadings: true,
    paragraphIndent: true
  };

  const state = {
    folderId: ALL,
    query: '',
    selectMode: false,
    selected: new Set(),
    editId: '',
    isNew: false,
    toolbar: 'text',
    highlight: '#fff2a8',
    savedRange: null,
    undo: [],
    redo: [],
    lastHTML: ''
  };

  function esc(v) {
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    if (typeof escHTML === 'function') return escHTML(v);
    return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function now() { return new Date().toISOString().slice(0,16).replace('T',' '); }
  function plain(html) { const d = document.createElement('div'); d.innerHTML = String(html || ''); return (d.innerText || d.textContent || '').replace(/\u00a0/g,' ').trim(); }
  function noteText(n) { return String(n?.text || plain(n?.html || '') || '').trim(); }
  function titleFrom(text) { return String(text || '').replace(/\s+/g,' ').trim().slice(0,60) || 'Untitled note'; }
  function words(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
  function preview(text) { const s = String(text || '').replace(/\s+/g,' ').trim(); return s.length > 120 ? s.slice(0,120) + '…' : s; }
  function readerText() { return document.getElementById('readerInput')?.value || ''; }

  function ensureData() {
    D.reader = D.reader || {};
    D.settings = D.settings || {};
    D.settings.readerNoteClean = { ...DEFAULT_CLEAN, ...(D.settings.readerNoteClean || {}) };
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    if (!Array.isArray(D.readerNoteFolders)) D.readerNoteFolders = [];
    D.readerNotes.forEach(n => {
      if (!n.id) n.id = 'rn' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
      if (!n.folderId) n.folderId = DEFAULT_FOLDER;
      if (!n.createdAt) n.createdAt = n.updatedAt || now();
      if (!n.updatedAt) n.updatedAt = n.createdAt;
      if (!n.text && n.html) n.text = plain(n.html);
      if (!n.html && n.text) n.html = esc(n.text).replace(/\n/g,'<br>');
    });
  }

  function noteById(id) { ensureData(); return D.readerNotes.find(n => String(n.id) === String(id)); }

  function folderName(id) {
    if (id === ALL) return 'All Notes';
    if (!id || id === DEFAULT_FOLDER) return 'Notes';
    return D.readerNoteFolders.find(f => String(f.id) === String(id))?.name || 'Folder';
  }

  function folders(includeAll = true) {
    ensureData();
    const base = [
      ...(includeAll ? [{ id: ALL, name: 'All Notes', count: D.readerNotes.length }] : []),
      { id: DEFAULT_FOLDER, name: 'Notes', count: D.readerNotes.filter(n => (n.folderId || DEFAULT_FOLDER) === DEFAULT_FOLDER).length },
      ...D.readerNoteFolders.map(f => ({ id: f.id, name: f.name || 'Folder', count: D.readerNotes.filter(n => String(n.folderId) === String(f.id)).length }))
    ];
    return base;
  }

  function dateObj(v) { const d = new Date(String(v || '').replace(' ', 'T')); return Number.isFinite(d.getTime()) ? d : null; }
  function sameDay(a,b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function shortDate(v) {
    const d = dateObj(v); if (!d) return '';
    const t = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return `Today · ${t}`;
    if (sameDay(d, y)) return `Yesterday · ${t}`;
    return `${d.toLocaleDateString([], { month:'short', day:'numeric' })} · ${t}`;
  }

  function groupLabel(v) {
    const d = dateObj(v); if (!d) return 'Older';
    const today = new Date();
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((a - b) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff <= 7) return 'Previous 7 Days';
    return 'Older';
  }

  function normalizeColor(value, fallback = '#fff2a8') {
    const v = String(value || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(ch => ch + ch).join('');
    const rgb = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgb) return '#' + rgb.slice(1,4).map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2,'0')).join('');
    return fallback;
  }

  function sanitize(html) {
    const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','SPAN','MARK','UL','OL','LI','A','BLOCKQUOTE']);
    const box = document.createElement('div'); box.innerHTML = String(html || '');
    function walk(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (!allowed.has(child.tagName)) { child.replaceWith(document.createTextNode(child.textContent || '')); return; }
        [...child.attributes].forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name === 'href' && child.tagName === 'A') {
            const href = attr.value || '';
            if (/^(https?:|mailto:)/i.test(href)) { child.setAttribute('target','_blank'); child.setAttribute('rel','noopener noreferrer'); }
            else child.removeAttribute(attr.name);
            return;
          }
          if (!['style','data-color','class'].includes(name)) child.removeAttribute(attr.name);
        });
        const style = child.getAttribute('style') || '';
        const safe = [];
        const bg = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
        if (/text-decoration[^;]*underline/i.test(style)) safe.push('text-decoration:underline');
        if (/text-decoration[^;]*line-through/i.test(style)) safe.push('text-decoration:line-through');
        if (bg) {
          const c = normalizeColor(bg[1]);
          safe.push(`background-color:${c}`);
          child.setAttribute('data-color', c);
        }
        if (child.classList.contains('wj-novel-heading')) child.setAttribute('class','wj-novel-heading');
        else child.removeAttribute('class');
        if (safe.length) child.setAttribute('style', safe.join(';'));
        else child.removeAttribute('style');
        walk(child);
      });
    }
    walk(box); return box.innerHTML;
  }

  function noteHTML(n) { return n?.html ? sanitize(n.html) : esc(noteText(n)).replace(/\n/g,'<br>'); }

  function isHeading(line) {
    const text = String(line || '').trim();
    if (!text) return false;
    if (/^chapter\s+([ivxlcdm]+|\d+|[a-z])\b/i.test(text)) return true;
    if (text.length <= 44 && !/[.!?,;:]$/.test(text)) {
      const ws = text.split(/\s+/).filter(Boolean);
      return ws.length > 0 && ws.length <= 7 && ws.every(w => /^[A-Z0-9"'’“”\-]+/.test(w));
    }
    return false;
  }

  function htmlFromPlainText(text) {
    return String(text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      .map(p => `<p${isHeading(p) ? ' class="wj-novel-heading"' : ''}>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
  }

  function formatNovelText(inputText) {
    const opt = D.settings?.readerNoteClean || DEFAULT_CLEAN;
    if (!inputText) return '';
    let text = String(inputText).replace(/\r/g,'\n').replace(/\u00a0/g,' ');
    if (opt.normalizeSpaces) text = text.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[ \t]+/g,' ');
    if (opt.removeHeaders) {
      text = text.replace(/^\s*\d+\s+Charlotte's Web\s*$/gim,'').replace(/^\s*Charlotte's Web\s+\d+\s*$/gim,'')
        .replace(/^\s*Before Breakfast\s+\d+\s*$/gim,'').replace(/^\s*\d+\s+Before Breakfast\s*$/gim,'')
        .replace(/^\s*Wilbur\s+\d+\s*$/gim,'').replace(/^\s*\d+\s+Wilbur\s*$/gim,'').replace(/^\s*Page\s+\d+\s*$/gim,'');
    }
    if (opt.removePageNumbers) text = text.replace(/^\s*[-–—]?\s*\d+\s*[-–—]?\s*$/gm,'');
    const raw = text.split('\n').map(l => opt.normalizeSpaces ? l.replace(/[ \t]+/g,' ').trim() : l.trim());
    const lines = [];
    raw.forEach(line => { if (!line) { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); } else lines.push(line); });
    if (!opt.mergeBrokenLines) return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
    const paragraphs = [];
    let buffer = '';
    const endsSentence = line => /[.!?…"'”’\)]$/.test(line) || /[.!?…]["'”’\)]?$/.test(line);
    const startsNew = line => !line || (opt.preserveHeadings && isHeading(line)) || /^[-–—]\s+/.test(line);
    const flush = () => { const clean = buffer.replace(/\s+/g,' ').trim(); if (clean) paragraphs.push(clean); buffer = ''; };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], next = lines[i + 1] || '';
      if (!line) { flush(); continue; }
      if (opt.preserveHeadings && isHeading(line)) { flush(); paragraphs.push(line); continue; }
      buffer = buffer ? `${buffer} ${line}` : line;
      if (endsSentence(line) || startsNew(next)) flush();
    }
    flush();
    return paragraphs.join('\n\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  }

  function injectCSS() {
    if (document.getElementById('readerNotesCoreStyle')) return;
    const s = document.createElement('style');
    s.id = 'readerNotesCoreStyle';
    s.textContent = `
      #readerNotesModal{display:none!important}
      .rn-page{position:fixed;inset:0;z-index:99999;background:var(--bg);color:var(--ink);display:none;flex-direction:column;box-sizing:border-box;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);overflow:hidden}.rn-page.active{display:flex}
      .rn-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px 8px}.rn-left,.rn-right{display:flex;align-items:center;gap:8px;min-width:0}.rn-right{justify-content:flex-end}
      .rn-btn,.rn-icon,.rn-small{height:38px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);color:var(--ink);font-size:13px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.rn-btn{padding:0 13px;white-space:nowrap}.rn-btn.primary{color:var(--brand,#2f7cf6)}.rn-icon,.rn-small{width:38px;min-width:38px;padding:0;font-size:24px;line-height:1}.rn-small{font-size:20px}
      .rn-head{padding:2px 18px 10px}.rn-title{font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.045em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rn-sub{margin-top:5px;color:var(--ink2);font-size:13px;font-weight:800}
      .rn-search-wrap{padding:0 18px 10px}.rn-search{height:42px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur);display:flex;align-items:center;gap:9px;padding:0 12px}.rn-search span{font-size:15px;color:var(--ink2)}.rn-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:750}
      .rn-folders{display:flex;gap:8px;overflow-x:auto;padding:0 18px 10px;scrollbar-width:none}.rn-folders::-webkit-scrollbar{display:none}.rn-chip{height:34px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);color:var(--ink2);padding:0 12px;font-size:12px;font-weight:900;white-space:nowrap}.rn-chip.active{background:var(--sur2);color:var(--ink);box-shadow:0 0 0 1px var(--ink) inset}
      .rn-content{flex:1 1 auto;min-height:0;overflow:auto;padding:0 18px 18px}.rn-group{font-size:15px;font-weight:950;margin:12px 2px 8px}.rn-list{border:1px solid var(--bdr);border-radius:20px;background:var(--sur2);overflow:hidden}.rn-row{min-height:72px;display:flex;gap:11px;align-items:flex-start;padding:13px 14px;border-bottom:1px solid var(--bdr)}.rn-row:last-child{border-bottom:0}.rn-row:active{background:rgba(0,0,0,.035)}.rn-check{display:none;width:23px;height:23px;min-width:23px;border:2px solid var(--bdr);border-radius:999px;margin-top:2px;color:white;align-items:center;justify-content:center;font-size:14px}.rn-selecting .rn-check{display:flex}.rn-row.selected .rn-check{background:var(--brand,#2f7cf6);border-color:var(--brand,#2f7cf6)}.rn-main{min-width:0;flex:1}.rn-row-title{font-size:16px;font-weight:950;line-height:1.25;margin-bottom:4px}.rn-row-meta{font-size:12px;font-weight:800;color:var(--ink2);margin-bottom:6px}.rn-row-preview{font-size:13px;line-height:1.38;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.rn-empty{border:1px solid var(--bdr);border-radius:20px;background:var(--sur2);padding:24px;text-align:center;color:var(--ink2);font-size:13px;font-weight:800;line-height:1.5}
      .rn-detail-title{font-size:29px;line-height:1.08;font-weight:950;letter-spacing:-.04em;margin:2px 0 6px}.rn-meta{color:var(--ink2);font-size:12px;font-weight:850;margin-bottom:10px}.rn-body{font-size:16px;line-height:1.62;word-break:break-word}.rn-body p,.rn-editor-body p,.${RICH_CLASS} p{margin:0 0 1.05em 0;line-height:1.75;text-indent:1.35em;text-align:left;word-spacing:normal;letter-spacing:normal}.rn-body p:first-child,.rn-editor-body p:first-child,.${RICH_CLASS} p:first-child,.wj-novel-heading{text-indent:0!important;font-weight:800}.rn-body mark,.rn-editor-body mark,.${RICH_CLASS} mark{border-radius:4px;padding:0 2px}
      .rn-editor{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:0 18px 154px}.rn-title-input{border:0;outline:0;background:transparent;color:var(--ink);font-size:29px;font-weight:950;letter-spacing:-.04em;line-height:1.08;padding:4px 0 8px;width:100%}.rn-folder-select{height:34px;border:1px solid var(--bdr);border-radius:12px;background:var(--sur);color:var(--ink2);font-size:12px;font-weight:850;padding:0 10px;max-width:100%;margin-bottom:8px}.rn-editor-body{flex:1 1 auto;min-height:0;overflow:auto;outline:0;font-size:16px;line-height:1.62;white-space:normal}.rn-editor-body:empty:before{content:attr(data-placeholder);color:var(--ink2)}
      .rn-toolbar{position:fixed;left:0;right:0;bottom:var(--rn-keyboard-inset,0px);z-index:100002;padding:8px 14px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(14px);border-top:1px solid var(--bdr);display:grid;gap:7px}.rn-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:5px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur)}.rn-tab{height:29px;border:0;border-radius:11px;background:transparent;color:var(--ink2);font-size:12px;font-weight:950}.rn-tab.active{background:var(--ink);color:var(--sur)}.rn-tools{display:flex;gap:10px;align-items:center;overflow-x:auto;border:1px solid var(--bdr);border-radius:18px;background:var(--sur);padding:10px 12px;scrollbar-width:none}.rn-tools::-webkit-scrollbar{display:none}.rn-tool{height:30px;min-width:30px;border:0;border-radius:10px;background:transparent;color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:950}.rn-tool.label{min-width:auto;padding:0 12px;font-size:13px;border:1px solid var(--bdr);background:var(--sur2)}.rn-swatch{width:28px;height:28px;min-width:28px;border:1px solid var(--bdr);border-radius:999px}.rn-color{width:30px;height:30px;min-width:30px;border:2px solid var(--bdr);border-radius:999px;overflow:hidden}.rn-color input{width:38px;height:38px;border:0;padding:0;margin:-4px;background:transparent}
      .rn-selection{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 18px 16px}.rn-selection .btn{height:44px;border-radius:15px;min-width:0}.rn-menu{position:absolute;right:16px;top:calc(62px + env(safe-area-inset-top));min-width:210px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur);box-shadow:0 18px 38px rgba(0,0,0,.14);overflow:hidden;z-index:10}.rn-menu button{width:100%;border:0;background:transparent;color:var(--ink);text-align:left;padding:13px 14px;font-size:14px;font-weight:850}.rn-menu button+button{border-top:1px solid var(--bdr)}.rn-menu .danger{color:#e24a4a}
      .rn-dialog-back{position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.24);display:flex;align-items:flex-end;justify-content:center;padding:18px;box-sizing:border-box}.rn-dialog{width:min(100%,430px);border:1px solid var(--bdr);border-radius:24px;background:var(--bg);box-shadow:0 22px 60px rgba(0,0,0,.18);padding:18px}.rn-dialog-title{font-size:22px;font-weight:950;margin-bottom:6px}.rn-dialog-sub{color:var(--ink2);font-size:13px;font-weight:800;line-height:1.35;margin-bottom:14px}.rn-dialog-input{width:100%;height:48px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur);color:var(--ink);font:inherit;font-size:16px;font-weight:800;padding:0 14px;box-sizing:border-box;outline:none}.rn-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.rn-dialog-btn{height:44px;border-radius:15px;border:1px solid var(--bdr);background:var(--sur);color:var(--ink);font-size:14px;font-weight:950}.rn-dialog-btn.primary{background:var(--ink);color:var(--sur)}
      .reader-rich-badge{display:inline-flex;margin-bottom:10px;padding:7px 10px;border:1px solid var(--bdr);background:var(--sur2);border-radius:999px;color:var(--ink2);font-size:12px;font-weight:850}.${RICH_CLASS}{font-size:17px;line-height:1.85;color:var(--ink)}.${RICH_CLASS} .reader-token{display:inline;border-radius:8px;padding:1px 2px;cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  function page() { injectCSS(); let p = document.getElementById('readerNotesPage'); if (!p) { p = document.createElement('div'); p.id = 'readerNotesPage'; p.className = 'rn-page'; document.body.appendChild(p); } p.classList.add('active'); document.body.style.overflow = 'hidden'; return p; }
  function shell(html){ page().innerHTML = html; updateKeyboardInset(); }
  function closePage(){ const p = document.getElementById('readerNotesPage'); if (p) p.classList.remove('active'); document.body.style.overflow = ''; }

  function updateKeyboardInset() {
    const p = document.getElementById('readerNotesPage'); if (!p) return;
    const vv = window.visualViewport;
    const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    p.style.setProperty('--rn-keyboard-inset', `${Math.round(inset)}px`);
  }

  if (window.visualViewport) {
    visualViewport.addEventListener('resize', updateKeyboardInset);
    visualViewport.addEventListener('scroll', updateKeyboardInset);
  }
  window.addEventListener('resize', updateKeyboardInset);

  function chips(){return `<div class="rn-folders">${folders(true).map(f=>`<button class="rn-chip ${String(state.folderId)===String(f.id)?'active':''}" onclick="setReaderNotesFolder('${esc(f.id)}')">${esc(f.name)} · ${f.count}</button>`).join('')}</div>`;}

  function visibleNotes(){ensureData();const q=state.query.trim().toLowerCase();return D.readerNotes.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).filter(n=>state.folderId===ALL||String(n.folderId||DEFAULT_FOLDER)===String(state.folderId)).filter(n=>!q||[n.title,noteText(n),folderName(n.folderId||DEFAULT_FOLDER)].join(' ').toLowerCase().includes(q));}

  function renderList(q = state.query){ensureData();state.query=q||'';const notes=visibleNotes();const grouped=new Map();notes.forEach(n=>{const g=groupLabel(n.updatedAt||n.createdAt);if(!grouped.has(g))grouped.set(g,[]);grouped.get(g).push(n)});const rows=notes.length?['Today','Yesterday','Previous 7 Days','Older'].filter(g=>grouped.has(g)).map(g=>`<div class="rn-group">${g}</div><div class="rn-list ${state.selectMode?'rn-selecting':''}">${grouped.get(g).map(n=>{const on=state.selected.has(String(n.id));return `<div class="rn-row ${on?'selected':''}" onclick="handleReaderNoteRow('${esc(n.id)}')"><div class="rn-check">${on?'✓':''}</div><div class="rn-main"><div class="rn-row-title">${esc(n.title||'Untitled note')}</div><div class="rn-row-meta">${esc(shortDate(n.updatedAt||n.createdAt))} · ${esc(folderName(n.folderId||DEFAULT_FOLDER))} · ${words(noteText(n))} words</div><div class="rn-row-preview">${esc(preview(noteText(n)))}</div></div></div>`}).join('')}</div>`).join(''):`<div class="rn-empty">No notes here yet.<br>Tap New Note to create one.</div>`;shell(`<div class="rn-top"><div class="rn-left">${D.readerNotes.length?`<button class="rn-btn" onclick="toggleReaderNoteSelectMode()">${state.selectMode?'Cancel':'Select'}</button>`:''}<button class="rn-btn primary" onclick="newReaderNoteIOS()">New Note</button></div><div class="rn-right"><button class="rn-btn" onclick="createReaderNoteFolder()">New Folder</button><button class="rn-icon" onclick="closeReaderNotesPage()">×</button></div></div><div class="rn-head"><div class="rn-title">${esc(folderName(state.folderId))}</div><div class="rn-sub">${notes.length} note${notes.length===1?'':'s'}</div></div><div class="rn-search-wrap"><div class="rn-search"><span>⌕</span><input value="${esc(state.query)}" placeholder="Search notes" oninput="renderReaderNotesListIOS(this.value)"></div></div>${chips()}<div class="rn-content">${rows}</div>${state.selectMode?`<div class="rn-selection"><button class="btn btn-s" onclick="selectAllReaderNotes()">${state.selected.size===notes.length&&notes.length?'Clear All':'Select All'}</button><button class="btn btn-s" onclick="deleteSelectedReaderNotes()" style="color:#e24a4a">Delete (${state.selected.size})</button></div>`:''}`);}

  function renderDetail(id){const n=noteById(id);if(!n)return renderList();shell(`<div class="rn-top"><button class="rn-icon" onclick="renderReaderNotesListIOS()">‹</button><div class="rn-right"><button class="rn-btn primary" onclick="openReaderNote('${esc(id)}')">Open in Reader</button><button class="rn-icon" onclick="showReaderNoteManageMenu('${esc(id)}')">⋯</button></div></div><div class="rn-content"><div class="rn-detail-title">${esc(n.title||'Untitled note')}</div><div class="rn-meta">${esc(shortDate(n.updatedAt||n.createdAt))} · ${words(noteText(n))} words</div><div class="rn-meta">Folder: ${esc(folderName(n.folderId||DEFAULT_FOLDER))}</div><div class="rn-body">${noteHTML(n)}</div></div><div class="rn-toolbar"><button class="rn-btn primary" onclick="editReaderNoteIOS('${esc(id)}')">Edit Note</button></div>`)}

  function folderSelect(v){return `<select id="rnFolder" class="rn-folder-select">${folders(false).map(f=>`<option value="${esc(f.id)}" ${String(v||DEFAULT_FOLDER)===String(f.id)?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`}
  function toolbar(){const sw=['#fff2a8','#d7f9d2','#cdefff','#ffd6e8','#e6d7ff','#ffd6a5'];const panels={text:`<button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('bold')">B</button><button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('italic')"><i>I</i></button><button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('underline')">U</button><button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('strike')">S</button><button class="rn-tool" onmousedown="event.preventDefault();clearReaderNoteFormatting()">Aa</button>`,color:`<button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('highlight')">▰</button>${sw.map(c=>`<button class="rn-swatch" style="background:${c}" onmousedown="event.preventDefault();setReaderHighlightColor('${c}');formatReaderNote('highlight')"></button>`).join('')}<label class="rn-color"><input type="color" value="${state.highlight}" onchange="setReaderHighlightColor(this.value);formatReaderNote('highlight')"></label>`,list:`<button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('bullet')">•</button><button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('number')">1.</button><button class="rn-tool" onmousedown="event.preventDefault();insertReaderNoteChecklistIOS()">☐</button><button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('outdent')">⇤</button><button class="rn-tool" onmousedown="event.preventDefault();formatReaderNote('indent')">⇥</button>`,insert:`<button class="rn-tool label" onmousedown="event.preventDefault();cleanReaderNoteFormat()">Novel Format</button><button class="rn-tool label" onmousedown="event.preventDefault();copyReaderNoteAllText()">Copy All</button><button class="rn-tool" onmousedown="event.preventDefault();createReaderNoteLink()">🔗</button><button class="rn-tool label" onmousedown="event.preventDefault();openCurrentEditorTextInReaderIOS()">Reader</button>`};return `<div class="rn-tabs">${['text','color','list','insert'].map(k=>`<button class="rn-tab ${state.toolbar===k?'active':''}" onmousedown="event.preventDefault();setReaderToolbar('${k}')">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div><div class="rn-tools">${panels[state.toolbar]||panels.text}</div>`;}

  function renderEditor(id = '', isNew = false){ensureData();state.editId=isNew?'':String(id||'');state.isNew=!!isNew;state.toolbar='text';state.undo=[];state.redo=[];const n=!isNew&&id?noteById(id):null;const title=isNew?'':(n?.title||'');const html=isNew?'':noteHTML(n);const fid=isNew?DEFAULT_FOLDER:(n?.folderId||DEFAULT_FOLDER);shell(`<div class="rn-top"><button class="rn-icon" onclick="cancelReaderNoteEditor()">‹</button><div class="rn-right"><button class="rn-small" onclick="undoReaderNoteEdit()">↶</button><button class="rn-small" onclick="redoReaderNoteEdit()">↷</button><button class="rn-btn primary" onclick="saveReaderNoteEditorIOS()">Done</button></div></div><div class="rn-editor"><input id="rnTitle" class="rn-title-input" value="${esc(title)}" placeholder="Title">${folderSelect(fid)}<div id="rnEditorBody" class="rn-editor-body" contenteditable="true" data-placeholder="Start writing..."></div></div><div class="rn-toolbar">${toolbar()}</div>`);const ed=document.getElementById('rnEditorBody');if(ed){ed.innerHTML=html;state.lastHTML=html;['keyup','mouseup','touchend'].forEach(e=>ed.addEventListener(e,saveRange));ed.addEventListener('beforeinput',pushUndo);setTimeout(()=>ed.focus({preventScroll:true}),50)}}

  function saveEditor(){ensureData();const titleEl=document.getElementById('rnTitle');const bodyEl=document.getElementById('rnEditorBody');const folderEl=document.getElementById('rnFolder');if(!bodyEl)return;const html=sanitize(bodyEl.innerHTML||'');const text=plain(html);if(!text){toast?.('Note text is empty');return;}let n=(!state.isNew&&state.editId)?noteById(state.editId):null;if(!n){n={id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),createdAt:now()};D.readerNotes.push(n);}n.title=String(titleEl?.value||'').trim()||titleFrom(text);n.text=text;n.html=html;n.folderId=folderEl?.value||DEFAULT_FOLDER;n.updatedAt=now();if(!n.createdAt)n.createdAt=n.updatedAt;D.reader.activeNoteId=n.id;state.editId=n.id;state.isNew=false;save?.();toast?.('Note saved');renderDetail(n.id)}

  function saveRange(){const ed=document.getElementById('rnEditorBody');const sel=window.getSelection();if(!ed||!sel||!sel.rangeCount)return;const r=sel.getRangeAt(0);if(ed.contains(r.commonAncestorContainer))state.savedRange=r.cloneRange()}
  function restoreRange(){const ed=document.getElementById('rnEditorBody');const sel=window.getSelection();if(!ed||!sel||!state.savedRange)return false;sel.removeAllRanges();sel.addRange(state.savedRange);return true}
  function pushUndo(){const ed=document.getElementById('rnEditorBody');if(!ed)return;const html=ed.innerHTML;if(html===state.lastHTML)return;state.undo.push(state.lastHTML);if(state.undo.length>50)state.undo.shift();state.redo=[];state.lastHTML=html}
  function undo(){const ed=document.getElementById('rnEditorBody');if(!ed||!state.undo.length)return;state.redo.push(ed.innerHTML);ed.innerHTML=state.undo.pop();state.lastHTML=ed.innerHTML}
  function redo(){const ed=document.getElementById('rnEditorBody');if(!ed||!state.redo.length)return;state.undo.push(ed.innerHTML);ed.innerHTML=state.redo.pop();state.lastHTML=ed.innerHTML}

  function applyHighlight(){const ed=document.getElementById('rnEditorBody');if(!ed)return;pushUndo();ed.focus();restoreRange();const sel=window.getSelection();if(!sel||!sel.rangeCount||sel.isCollapsed){document.execCommand('styleWithCSS',false,true);document.execCommand('backColor',false,state.highlight);return;}const r=sel.getRangeAt(0);if(!ed.contains(r.commonAncestorContainer))return;const mark=document.createElement('mark');mark.style.backgroundColor=state.highlight;mark.setAttribute('data-color',state.highlight);try{mark.appendChild(r.extractContents());r.insertNode(mark);sel.removeAllRanges();const nr=document.createRange();nr.selectNodeContents(mark);sel.addRange(nr);state.savedRange=nr.cloneRange()}catch(e){document.execCommand('styleWithCSS',false,true);document.execCommand('backColor',false,state.highlight)}}

  function makeRich(html){const root=document.createElement('div');root.innerHTML=sanitize(html);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>/[A-Za-z]/.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{const frag=document.createDocumentFragment();(String(node.nodeValue||'').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|[^A-Za-z]+/g)||[]).forEach(p=>{if(/^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(p)){const sp=document.createElement('span');sp.className='reader-token';sp.dataset.word=p;sp.textContent=p;frag.appendChild(sp)}else frag.appendChild(document.createTextNode(p))});node.replaceWith(frag)});return root.innerHTML}

  function openRich(id,html,text){D.reader.activeNoteId=id||'';D.reader.text=text;D.reader.richHTML=html;D.reader.isRichNote=true;const input=document.getElementById('readerInput');if(input)input.value=text;localStorage.setItem('wordjar_reader_note_v1',text);save?.();closePage();if(typeof renderReader==='function')renderReader()}

  function showFolderDialog(){const p=page();document.getElementById('rnFolderDialog')?.remove();p.insertAdjacentHTML('beforeend',`<div id="rnFolderDialog" class="rn-dialog-back" onclick="closeReaderFolderDialog()"><div class="rn-dialog" onclick="event.stopPropagation()"><div class="rn-dialog-title">New Folder</div><div class="rn-dialog-sub">Create a folder to keep Reader notes organized.</div><input id="rnFolderNameInput" class="rn-dialog-input" placeholder="Folder name" maxlength="40"><div class="rn-dialog-actions"><button class="rn-dialog-btn" onclick="closeReaderFolderDialog()">Cancel</button><button class="rn-dialog-btn primary" onclick="submitReaderFolderDialog()">Create</button></div></div></div>`);setTimeout(()=>document.getElementById('rnFolderNameInput')?.focus(),50)}

  window.openReaderNotesModal=function(){ensureData();state.selectMode=false;state.selected.clear();state.query='';renderList()};
  window.closeReaderNotesPage=closePage;window.renderReaderNotesListIOS=window.renderReaderNotesList=renderList;window.openReaderNoteDetailIOS=window.openReaderNoteDetail=renderDetail;
  window.editReaderNoteIOS=window.editReaderNote=(id)=>renderEditor(id,false);window.newReaderNoteIOS=()=>renderEditor('',true);window.createBlankReaderNote=window.newReaderNoteIOS;window.saveReaderNoteEditorIOS=saveEditor;window.cancelReaderNoteEditor=()=>state.editId?renderDetail(state.editId):renderList();
  window.setReaderNotesFolder=id=>{state.folderId=id||ALL;state.selectMode=false;state.selected.clear();renderList()};window.handleReaderNoteRow=id=>{if(state.selectMode){state.selected.has(String(id))?state.selected.delete(String(id)):state.selected.add(String(id));renderList()}else renderDetail(id)};window.toggleReaderNoteSelectMode=()=>{state.selectMode=!state.selectMode;state.selected.clear();renderList()};window.selectAllReaderNotes=()=>{const ids=visibleNotes().map(n=>String(n.id));if(state.selected.size===ids.length)state.selected.clear();else ids.forEach(id=>state.selected.add(id));renderList()};window.deleteSelectedReaderNotes=()=>{if(!state.selected.size)return toast?.('No notes selected');if(!confirm(`Delete ${state.selected.size} selected note${state.selected.size===1?'':'s'}?`))return;D.readerNotes=D.readerNotes.filter(n=>!state.selected.has(String(n.id)));state.selected.clear();state.selectMode=false;save?.();renderList()};
  window.createReaderNoteFolder=showFolderDialog;window.closeReaderFolderDialog=()=>document.getElementById('rnFolderDialog')?.remove();window.submitReaderFolderDialog=()=>{const name=(document.getElementById('rnFolderNameInput')?.value||'').trim().slice(0,40);if(!name)return;if(D.readerNoteFolders.some(f=>String(f.name||'').toLowerCase()===name.toLowerCase()))return toast?.('Folder already exists');const f={id:'rnf'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name,createdAt:now()};D.readerNoteFolders.push(f);state.folderId=f.id;save?.();window.closeReaderFolderDialog();renderList()};
  window.showReaderNoteManageMenu=id=>{document.getElementById('rnMenu')?.remove();page().insertAdjacentHTML('beforeend',`<div id="rnMenu" class="rn-menu"><button onclick="editReaderNoteIOS('${esc(id)}')">Edit Note</button><button onclick="openReaderNote('${esc(id)}')">Open in Reader</button><button onclick="moveReaderNoteToFolder('${esc(id)}')">Move to Folder</button><button onclick="duplicateReaderNote('${esc(id)}')">Duplicate</button><button onclick="shareReaderNoteIOS('${esc(id)}')">Share Text</button><button class="danger" onclick="deleteReaderNoteIOS('${esc(id)}')">Delete</button></div>`)};window.showReaderNoteMenuIOS=window.showReaderNoteManageMenu;
  window.moveReaderNoteToFolder=id=>{const n=noteById(id);if(!n)return;const fs=folders(false);const ans=prompt(`Move to folder:\n${fs.map((f,i)=>`${i+1}. ${f.name}`).join('\n')}\n\nType folder number or new folder name.`);if(!ans)return;const idx=Number(ans.trim())-1;if(Number.isInteger(idx)&&fs[idx])n.folderId=fs[idx].id;else{let f=D.readerNoteFolders.find(x=>String(x.name||'').toLowerCase()===ans.trim().toLowerCase());if(!f){f={id:'rnf'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:ans.trim().slice(0,40),createdAt:now()};D.readerNoteFolders.push(f)}n.folderId=f.id}n.updatedAt=now();save?.();renderDetail(id)};window.duplicateReaderNote=id=>{const n=noteById(id);if(!n)return;D.readerNotes.push({...n,id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:(n.title||'Untitled note')+' Copy',createdAt:now(),updatedAt:now()});save?.();renderList()};window.shareReaderNoteIOS=id=>{const n=noteById(id);if(!n)return;const text=`${n.title||'Untitled note'}\n\n${noteText(n)}`;if(navigator.share)navigator.share({title:n.title||'Reader note',text}).catch(()=>{});else navigator.clipboard?.writeText(text).then(()=>toast?.('Copied note text'))};window.deleteReaderNoteIOS=window.deleteReaderNote=id=>{if(!confirm('Delete this note?'))return;D.readerNotes=D.readerNotes.filter(n=>String(n.id)!==String(id));save?.();renderList()};
  window.setReaderToolbar=tab=>{const title=document.getElementById('rnTitle')?.value||'',body=document.getElementById('rnEditorBody')?.innerHTML||'',folder=document.getElementById('rnFolder')?.value||DEFAULT_FOLDER;state.toolbar=['text','color','list','insert'].includes(tab)?tab:'text';renderEditor(state.editId,state.isNew);document.getElementById('rnTitle').value=title;document.getElementById('rnEditorBody').innerHTML=body;document.getElementById('rnFolder').value=folder};window.setReaderHighlightColor=c=>{state.highlight=normalizeColor(c)};window.formatReaderNote=t=>{const ed=document.getElementById('rnEditorBody');if(!ed)return;pushUndo();ed.focus();restoreRange();document.execCommand('styleWithCSS',false,true);const map={bold:'bold',italic:'italic',underline:'underline',strike:'strikeThrough',bullet:'insertUnorderedList',number:'insertOrderedList',indent:'indent',outdent:'outdent'};if(t==='highlight')applyHighlight();else if(map[t])document.execCommand(map[t],false,null);saveRange()};window.insertReaderNoteChecklistIOS=()=>{const ed=document.getElementById('rnEditorBody');if(!ed)return;pushUndo();ed.focus();restoreRange();document.execCommand('insertHTML',false,'☐&nbsp;');saveRange()};window.createReaderNoteLink=()=>{const url=prompt('Paste link URL');if(!url)return;if(!/^https?:\/\//i.test(url)&&!/^mailto:/i.test(url))return toast?.('Use http, https, or mailto links');const ed=document.getElementById('rnEditorBody');if(!ed)return;pushUndo();ed.focus();restoreRange();document.execCommand('createLink',false,url)};window.clearReaderNoteFormatting=()=>{const ed=document.getElementById('rnEditorBody');if(!ed)return;pushUndo();ed.focus();restoreRange();document.execCommand('removeFormat',false,null)};
  window.undoReaderNoteEdit=undo;window.redoReaderNoteEdit=redo;window.cleanReaderNoteFormat=()=>{const ed=document.getElementById('rnEditorBody');if(!ed)return;pushUndo();ed.innerHTML=htmlFromPlainText(formatNovelText(ed.innerText||ed.textContent||''));toast?.('Novel format cleaned')};window.copyReaderNoteAllText=()=>{const ed=document.getElementById('rnEditorBody');const text=(ed?.innerText||ed?.textContent||'').trim();if(!text)return;navigator.clipboard?.writeText(text).then(()=>toast?.('Copied all text'))};window.formatNovelText=formatNovelText;
  window.openCurrentEditorTextInReaderIOS=()=>{const ed=document.getElementById('rnEditorBody');const html=sanitize(ed?.innerHTML||'');const text=plain(html);if(!text)return toast?.('Note text is empty');openRich(state.editId,html,text)};window.openReaderNote=id=>{const n=noteById(id);if(!n)return;openRich(n.id,noteHTML(n),noteText(n))};window.saveCurrentReaderNoteAsNew=()=>{const text=readerText().trim();if(!text)return window.newReaderNoteIOS();const html=D.reader?.isRichNote&&D.reader?.richHTML?sanitize(D.reader.richHTML):esc(text).replace(/\n/g,'<br>');ensureData();const n={id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:titleFrom(text),text,html,folderId:state.folderId!==ALL?state.folderId:DEFAULT_FOLDER,createdAt:now(),updatedAt:now()};D.readerNotes.push(n);D.reader.activeNoteId=n.id;save?.();toast?.('Reader note saved')};window.updateCurrentReaderNote=window.saveCurrentReaderNoteAsNew;
  const oldRender=window.renderReader;window.renderReader=function(){if(typeof oldRender==='function')oldRender();if(D.reader?.isRichNote&&D.reader?.richHTML){const tokens=document.getElementById('readerTokens');if(tokens){tokens.innerHTML=`<div class="reader-rich-badge">Saved note · rich text</div><div class="${RICH_CLASS}">${makeRich(D.reader.richHTML)}</div>`;if(!tokens.__rnCoreClick){tokens.addEventListener('click',e=>{const token=e.target.closest('.reader-token');if(token&&typeof window.selectReaderWord==='function')window.selectReaderWord(token)});tokens.__rnCoreClick=true}}}const actions=document.getElementById('readerNoteActions');if(actions)actions.innerHTML=`<div class="reader-note-actions"><button class="btn btn-s" type="button" onclick="openReaderNotesModal()">Notes</button><button class="btn btn-p" type="button" onclick="saveCurrentReaderNoteAsNew()">Save as Note</button></div><div id="readerActiveNoteLabel" class="reader-note-active">${D.reader?.activeNoteId?'Current saved note loaded':'Current: unsaved draft'}</div>`};
})();
