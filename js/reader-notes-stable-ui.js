// WordJar Reader Notes Stable UI V1
// Practical mobile-first notes UI. This overrides earlier experimental notes UIs.

(function installReaderNotesStableUI() {
  if (window.__wordjarReaderNotesStableUIInstalled) return;
  window.__wordjarReaderNotesStableUIInstalled = true;

  const ALL = 'all';
  const DEFAULT_FOLDER = 'uncategorized';
  const RICH_CLASS = 'reader-rich-note-view';
  let folderId = ALL;
  let query = '';
  let selectMode = false;
  let selected = new Set();
  let editingId = '';
  let highlightColor = '#fff2a8';
  let savedRange = null;

  function ensureData() {
    D.reader = D.reader || {};
    if (!Array.isArray(D.readerNotes)) D.readerNotes = [];
    if (!Array.isArray(D.readerNoteFolders)) D.readerNoteFolders = [];
    D.readerNotes.forEach(n => {
      if (!n.id) n.id = 'rn' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      if (!n.folderId) n.folderId = DEFAULT_FOLDER;
      if (!n.createdAt) n.createdAt = n.updatedAt || now();
      if (!n.updatedAt) n.updatedAt = n.createdAt;
      if (!n.text && n.html) n.text = plain(n.html);
      if (!n.html && n.text) n.html = escapeHTMLLocal(n.text).replace(/\n/g, '<br>');
    });
  }

  function escapeHTMLLocal(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    if (typeof escHTML === 'function') return escHTML(value);
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function now() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  function titleFrom(text) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled note'; }
  function noteById(id) { ensureData(); return D.readerNotes.find(n => String(n.id) === String(id)); }
  function plain(html) { const d = document.createElement('div'); d.innerHTML = String(html || ''); return (d.textContent || '').replace(/\u00a0/g, ' ').trim(); }
  function noteText(n) { return String(n?.text || plain(n?.html || '') || '').trim(); }
  function countWords(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
  function preview(text) { const s = String(text || '').replace(/\s+/g, ' ').trim(); return s.length > 112 ? s.slice(0,112) + '…' : s; }

  function cleanColor(value, fallback = '#fff2a8') {
    const v = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    return fallback;
  }

  function sanitize(html) {
    const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','SPAN','MARK','UL','OL','LI','A','BLOCKQUOTE']);
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    function walk(node) {
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
        const bg = style.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{6})/i);
        if (/text-decoration[^;]*underline/i.test(style)) safe.push('text-decoration: underline');
        if (/text-decoration[^;]*line-through/i.test(style)) safe.push('text-decoration: line-through');
        if (bg) safe.push(`background-color: ${cleanColor(bg[1])}`);
        if (safe.length) child.setAttribute('style', safe.join('; '));
        else child.removeAttribute('style');
        walk(child);
      });
    }
    walk(box);
    return box.innerHTML;
  }

  function noteHTML(n) { return n?.html ? sanitize(n.html) : escapeHTMLLocal(noteText(n)).replace(/\n/g, '<br>'); }

  function folderName(id) {
    if (id === ALL) return 'All Notes';
    if (id === DEFAULT_FOLDER || !id) return 'Notes';
    return D.readerNoteFolders.find(f => String(f.id) === String(id))?.name || 'Folder';
  }

  function folders() {
    ensureData();
    return [
      { id: ALL, name: 'All Notes', count: D.readerNotes.length, system: true },
      { id: DEFAULT_FOLDER, name: 'Notes', count: D.readerNotes.filter(n => (n.folderId || DEFAULT_FOLDER) === DEFAULT_FOLDER).length, system: true },
      ...D.readerNoteFolders.map(f => ({ ...f, count: D.readerNotes.filter(n => String(n.folderId) === String(f.id)).length }))
    ];
  }

  function dateObj(v) { const d = new Date(String(v || '').replace(' ', 'T')); return Number.isFinite(d.getTime()) ? d : null; }
  function sameDay(a,b) { return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function shortDate(v) {
    const d = dateObj(v); if (!d) return '';
    const t = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const today = new Date(); const y = new Date(); y.setDate(today.getDate()-1);
    if (sameDay(d,today)) return `Today · ${t}`;
    if (sameDay(d,y)) return `Yesterday · ${t}`;
    return `${d.toLocaleDateString([], {month:'short', day:'numeric'})} · ${t}`;
  }

  function groupLabel(v) {
    const d = dateObj(v); if (!d) return 'Older';
    const today = new Date();
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((a-b)/86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff <= 7) return 'Previous 7 Days';
    return 'Older';
  }

  function readerText() { return document.getElementById('readerInput')?.value || ''; }

  function injectCSS() {
    if (document.getElementById('readerNotesStableUIStyle')) return;
    const s = document.createElement('style');
    s.id = 'readerNotesStableUIStyle';
    s.textContent = `
      #readerNotesModal.rn2-overlay{background:rgba(0,0,0,.22);backdrop-filter:blur(6px)}
      #readerNotesModal.rn2-overlay .modal-card{width:min(94vw,430px);height:min(88vh,780px);max-height:min(88vh,780px);padding:0;overflow:hidden;border-radius:24px;background:var(--bg);border:1px solid var(--bdr);box-shadow:0 24px 64px rgba(0,0,0,.16)}
      .rn2{height:100%;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);position:relative;overflow:hidden}
      .rn2-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px 8px}
      .rn2-left,.rn2-right{display:flex;align-items:center;gap:8px;min-width:0}.rn2-right{justify-content:flex-end}
      .rn2-icon{width:38px;height:38px;min-width:38px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);display:inline-flex;align-items:center;justify-content:center;padding:0;color:var(--ink)}
      .rn2-icon svg{width:20px;height:20px;stroke-width:2.5}.rn2-icon svg *{vector-effect:non-scaling-stroke}
      .rn2-btn{height:38px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);padding:0 13px;color:var(--ink);font-size:13px;font-weight:900;white-space:nowrap}.rn2-btn.primary{color:var(--brand,#2f7cf6)}
      .rn2-head{padding:0 18px 10px}.rn2-title{font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.045em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rn2-sub{margin-top:5px;color:var(--ink2);font-size:13px;font-weight:800}
      .rn2-search-wrap{padding:0 18px 10px}.rn2-search{height:42px;border:1px solid var(--bdr);background:var(--sur);border-radius:16px;display:flex;align-items:center;gap:10px;padding:0 12px}.rn2-search span{font-size:16px;line-height:1;color:var(--ink2)}.rn2-search input{border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:750;min-width:0;flex:1}
      .rn2-folders{flex:0 0 auto;display:flex;gap:8px;overflow-x:auto;padding:0 18px 10px;scrollbar-width:none}.rn2-folders::-webkit-scrollbar{display:none}.rn2-chip{height:34px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);color:var(--ink2);padding:0 12px;font-size:12px;font-weight:900;white-space:nowrap}.rn2-chip.active{color:var(--ink);box-shadow:0 0 0 1px var(--ink) inset;background:var(--sur2)}
      .rn2-content{flex:1 1 auto;min-height:0;overflow:auto;padding:0 18px 104px}.rn2-group{font-size:15px;font-weight:950;margin:12px 2px 8px}.rn2-list{border:1px solid var(--bdr);border-radius:20px;background:var(--sur2);overflow:hidden}.rn2-row{display:flex;gap:11px;align-items:flex-start;padding:13px 14px;border-bottom:1px solid var(--bdr);min-height:72px}.rn2-row:last-child{border-bottom:0}.rn2-row:active{background:rgba(0,0,0,.035)}.rn2-check{display:none;width:23px;height:23px;min-width:23px;border:2px solid var(--bdr);border-radius:999px;margin-top:2px;color:white;align-items:center;justify-content:center;font-size:14px}.rn2-selecting .rn2-check{display:flex}.rn2-row.selected .rn2-check{background:var(--brand,#2f7cf6);border-color:var(--brand,#2f7cf6)}.rn2-main{min-width:0;flex:1}.rn2-row-title{font-size:16px;font-weight:950;line-height:1.25;margin-bottom:4px}.rn2-row-meta{font-size:12px;font-weight:800;color:var(--ink2);margin-bottom:6px}.rn2-row-preview{font-size:13px;line-height:1.38;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.rn2-empty{border:1px solid var(--bdr);border-radius:20px;background:var(--sur2);padding:24px;text-align:center;color:var(--ink2);font-size:13px;font-weight:800;line-height:1.5}
      .rn2-bottom{position:absolute;left:18px;right:18px;bottom:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;pointer-events:none}.rn2-bottom>*{pointer-events:auto}.rn2-fab{width:54px;height:54px;min-width:54px;border:1px solid var(--bdr);border-radius:18px;background:var(--sur);color:var(--brand,#2f7cf6);display:flex;align-items:center;justify-content:center;box-shadow:0 16px 34px rgba(0,0,0,.10);padding:0}.rn2-fab svg{width:26px;height:26px;stroke-width:2.5}
      .rn2-selection{display:grid;grid-template-columns:1fr 1fr;gap:10px;position:absolute;left:18px;right:18px;bottom:16px}.rn2-selection .btn{height:44px;border-radius:15px;min-width:0}
      .rn2-detail-title{font-size:29px;line-height:1.08;font-weight:950;letter-spacing:-.04em;margin:2px 0 6px}.rn2-meta{color:var(--ink2);font-size:12px;font-weight:850;margin-bottom:10px}.rn2-body{font-size:16px;line-height:1.62;word-break:break-word}.rn2-body mark,.rn2-editor-body mark,.${RICH_CLASS} mark{border-radius:4px;padding:0 2px}
      .rn2-editor{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:0 18px 126px}.rn2-title-input{border:0;outline:0;background:transparent;color:var(--ink);font-size:29px;font-weight:950;letter-spacing:-.04em;line-height:1.08;padding:4px 0 8px;width:100%}.rn2-folder-select{height:34px;border:1px solid var(--bdr);border-radius:12px;background:var(--sur);color:var(--ink2);font-size:12px;font-weight:850;padding:0 10px;max-width:100%;margin-bottom:8px}.rn2-editor-body{flex:1 1 auto;min-height:0;overflow:auto;outline:0;font-size:16px;line-height:1.62;white-space:pre-wrap}.rn2-editor-body:empty:before{content:attr(data-placeholder);color:var(--ink2)}
      .rn2-toolbar{max-width:calc(100% - 66px);display:grid;gap:7px}.rn2-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:5px;border:1px solid var(--bdr);border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 12px 28px rgba(0,0,0,.08)}.rn2-tab{height:29px;border:0;border-radius:11px;background:transparent;color:var(--ink2);font-size:12px;font-weight:950}.rn2-tab.active{background:var(--ink);color:var(--sur)}.rn2-tools{display:flex;gap:10px;align-items:center;overflow-x:auto;border:1px solid var(--bdr);border-radius:18px;background:var(--sur);padding:10px 12px;box-shadow:0 16px 34px rgba(0,0,0,.10);scrollbar-width:none}.rn2-tools::-webkit-scrollbar{display:none}.rn2-tool{height:30px;min-width:30px;border:0;border-radius:10px;background:transparent;color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:950}.rn2-tool:active{background:var(--sur2)}.rn2-tool svg{width:23px;height:23px;stroke-width:2.35}.rn2-swatch{width:28px;height:28px;min-width:28px;border:1px solid var(--bdr);border-radius:999px}.rn2-color{width:30px;height:30px;min-width:30px;border:2px solid var(--bdr);border-radius:999px;overflow:hidden}.rn2-color input{width:38px;height:38px;border:0;padding:0;margin:-4px;background:transparent}
      .rn2-menu{position:absolute;right:18px;top:62px;min-width:210px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur);box-shadow:0 18px 38px rgba(0,0,0,.14);overflow:hidden;z-index:10}.rn2-menu button{width:100%;border:0;background:transparent;color:var(--ink);text-align:left;padding:13px 14px;font-size:14px;font-weight:850}.rn2-menu button+button{border-top:1px solid var(--bdr)}.rn2-menu .danger{color:#e24a4a}
      .reader-rich-badge{display:inline-flex;margin-bottom:10px;padding:7px 10px;border:1px solid var(--bdr);background:var(--sur2);border-radius:999px;color:var(--ink2);font-size:12px;font-weight:850}.${RICH_CLASS}{font-size:17px;line-height:1.85;color:var(--ink)}.${RICH_CLASS} .reader-token{display:inline;border-radius:8px;padding:1px 2px;cursor:pointer}
      @media(max-width:420px){#readerNotesModal.rn2-overlay .modal-card{width:100vw;height:100vh;max-height:100vh;border-radius:0}.rn2-title,.rn2-detail-title,.rn2-title-input{font-size:27px}.rn2-top{padding-top:calc(12px + env(safe-area-inset-top))}.rn2-bottom{bottom:calc(12px + env(safe-area-inset-bottom));left:14px;right:14px}.rn2-selection{bottom:calc(12px + env(safe-area-inset-bottom));left:14px;right:14px}.rn2-toolbar{max-width:calc(100% - 62px)}}
    `;
    document.head.appendChild(s);
  }

  function svg(name){
    const icons={back:'<path d="M15 18l-6-6 6-6"/>',close:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',check:'<path d="M20 6L9 17l-5-5"/>',more:'<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',book:'<path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11z"/><path d="M8 7h8M8 11h8M8 15h5"/>',underline:'<path d="M6 4v6a6 6 0 0012 0V4"/><path d="M4 21h16"/>',strike:'<path d="M17 9a4 4 0 00-4-4H9.5a3.5 3.5 0 000 7H15a3.5 3.5 0 010 7H9a4 4 0 01-4-4"/><path d="M4 12h16"/>',highlight:'<path d="M9 11l6-6 4 4-6 6"/><path d="M4 20h16"/><path d="M13 15l-4 1-1-4"/>',bullet:'<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',number:'<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 5h1v4"/><path d="M4 11h2l-2 3h2"/><path d="M4 17h2v4H4"/>',checklist:'<path d="M9 6l1.5 1.5L14 4"/><path d="M4 6h1"/><path d="M17 6h3"/><path d="M4 12h1"/><path d="M9 12h11"/><path d="M4 18h1"/><path d="M9 18h11"/>',indent:'<path d="M3 6h18"/><path d="M3 12h10"/><path d="M3 18h18"/><path d="M15 10l3 2-3 2"/>',outdent:'<path d="M3 6h18"/><path d="M11 12h10"/><path d="M3 18h18"/><path d="M9 10l-3 2 3 2"/>',link:'<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>'};
    const fill=name==='more'?'currentColor':'none'; const stroke=name==='more'?'none':'currentColor';
    return `<svg viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}">${icons[name]||''}</svg>`;
  }

  function mount(){injectCSS();let m=document.getElementById('readerNotesModal');if(!m){m=document.createElement('div');m.id='readerNotesModal';document.body.appendChild(m);}m.className='overlay rn2-overlay';m.onclick=e=>{if(e.target===m)closeO('readerNotesModal')};m.innerHTML='<div class="modal-card" onclick="event.stopPropagation()"><div id="readerNotesBody"></div></div>';}
  function shell(html){const b=document.getElementById('readerNotesBody');if(b)b.innerHTML=`<div class="rn2">${html}</div>`;}

  function visibleNotes(){ensureData();const q=query.trim().toLowerCase();return D.readerNotes.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).filter(n=>folderId===ALL||String(n.folderId||DEFAULT_FOLDER)===String(folderId)).filter(n=>!q||[n.title,noteText(n),folderName(n.folderId||DEFAULT_FOLDER)].join(' ').toLowerCase().includes(q));}

  function folderChips(){return `<div class="rn2-folders">${folders().map(f=>`<button class="rn2-chip ${String(folderId)===String(f.id)?'active':''}" onclick="setReaderNotesFolder('${escapeHTMLLocal(f.id)}')">${escapeHTMLLocal(f.name)} · ${f.count}</button>`).join('')}</div>`;}

  function renderList(q=query){ensureData();query=q||'';const notes=visibleNotes();const grouped=new Map();notes.forEach(n=>{const g=groupLabel(n.updatedAt||n.createdAt);if(!grouped.has(g))grouped.set(g,[]);grouped.get(g).push(n);});
    const rows=notes.length?['Today','Yesterday','Previous 7 Days','Older'].filter(g=>grouped.has(g)).map(g=>`<div class="rn2-group">${g}</div><div class="rn2-list ${selectMode?'rn2-selecting':''}">${grouped.get(g).map(n=>{const on=selected.has(String(n.id));return `<div class="rn2-row ${on?'selected':''}" onclick="handleReaderNoteRow('${escapeHTMLLocal(n.id)}')"><div class="rn2-check">${on?'✓':''}</div><div class="rn2-main"><div class="rn2-row-title">${escapeHTMLLocal(n.title||'Untitled note')}</div><div class="rn2-row-meta">${escapeHTMLLocal(shortDate(n.updatedAt||n.createdAt))} · ${escapeHTMLLocal(folderName(n.folderId||DEFAULT_FOLDER))} · ${countWords(noteText(n))} words</div><div class="rn2-row-preview">${escapeHTMLLocal(preview(noteText(n)))}</div></div></div>`}).join('')}</div>`).join(''):`<div class="rn2-empty">No notes here yet.<br>Create a note or switch folders.</div>`;
    const bottom=selectMode?`<div class="rn2-selection"><button class="btn btn-s" onclick="selectAllReaderNotes()">${selected.size===notes.length&&notes.length?'Clear All':'Select All'}</button><button class="btn btn-s" onclick="deleteSelectedReaderNotes()" style="color:#e24a4a">Delete (${selected.size})</button></div>`:`<div class="rn2-bottom"><div></div><button class="rn2-fab" onclick="newReaderNoteIOS()">${svg('edit')}</button></div>`;
    shell(`<div class="rn2-top"><div class="rn2-left">${D.readerNotes.length?`<button class="rn2-btn" onclick="toggleReaderNoteSelectMode()">${selectMode?'Cancel':'Select'}</button>`:''}<button class="rn2-btn primary" onclick="newReaderNoteIOS()">New Note</button></div><div class="rn2-right"><button class="rn2-btn" onclick="createReaderNoteFolder()">New Folder</button><button class="rn2-icon" onclick="closeO('readerNotesModal')">${svg('close')}</button></div></div><div class="rn2-head"><div class="rn2-title">${escapeHTMLLocal(folderName(folderId))}</div><div class="rn2-sub">${notes.length} note${notes.length===1?'':'s'}</div></div><div class="rn2-search-wrap"><div class="rn2-search"><span>⌕</span><input value="${escapeHTMLLocal(query)}" placeholder="Search notes" oninput="renderReaderNotesListIOS(this.value)"></div></div>${folderChips()}<div class="rn2-content">${rows}</div>${bottom}`);
  }

  function renderDetail(id){const n=noteById(id);if(!n)return renderList();shell(`<div class="rn2-top"><button class="rn2-icon" onclick="renderReaderNotesListIOS()">${svg('back')}</button><div class="rn2-right"><button class="rn2-btn primary" onclick="openReaderNote('${escapeHTMLLocal(id)}')">Open in Reader</button><button class="rn2-icon" onclick="showReaderNoteManageMenu('${escapeHTMLLocal(id)}')">${svg('more')}</button></div></div><div class="rn2-content"><div class="rn2-detail-title">${escapeHTMLLocal(n.title||'Untitled note')}</div><div class="rn2-meta">${escapeHTMLLocal(shortDate(n.updatedAt||n.createdAt))} · ${countWords(noteText(n))} words</div><div class="rn2-meta">Folder: ${escapeHTMLLocal(folderName(n.folderId||DEFAULT_FOLDER))}</div><div class="rn2-body">${noteHTML(n)}</div></div><div class="rn2-bottom"><div></div><button class="rn2-fab" onclick="editReaderNoteIOS('${escapeHTMLLocal(id)}')">${svg('edit')}</button></div>`);}

  function saveRange(){const sel=window.getSelection();const ed=document.getElementById('rn2EditorBody');if(sel&&ed&&sel.rangeCount){const r=sel.getRangeAt(0);if(ed.contains(r.commonAncestorContainer))savedRange=r.cloneRange();}}
  function restoreRange(){if(!savedRange)return;const sel=window.getSelection();if(!sel)return;sel.removeAllRanges();sel.addRange(savedRange);}
  function foldersSelect(v){return `<select id="rn2Folder" class="rn2-folder-select">${folders().filter(f=>f.id!==ALL).map(f=>`<option value="${escapeHTMLLocal(f.id)}" ${String(v||DEFAULT_FOLDER)===String(f.id)?'selected':''}>${escapeHTMLLocal(f.name)}</option>`).join('')}</select>`;}

  function tools(){const sw=['#fff2a8','#d7f9d2','#cdefff','#ffd6e8','#e6d7ff','#ffd6a5'];const p={format:`<button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('bold')">B</button><button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('italic')"><i>I</i></button><button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('underline')">${svg('underline')}</button><button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('strike')">${svg('strike')}</button><button class="rn2-tool" onmousedown="event.preventDefault();clearReaderNoteFormatting()">Aa</button>`,highlight:`<button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('highlight')">${svg('highlight')}</button>${sw.map(c=>`<button class="rn2-swatch" style="background:${c}" onmousedown="event.preventDefault();setReaderHighlightColor('${c}');formatReaderNote('highlight')"></button>`).join('')}<label class="rn2-color"><input type="color" value="${highlightColor}" onchange="setReaderHighlightColor(this.value);formatReaderNote('highlight')"></label>`,list:`<button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('bullet')">${svg('bullet')}</button><button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('number')">${svg('number')}</button><button class="rn2-tool" onmousedown="event.preventDefault();insertReaderNoteChecklistIOS()">${svg('checklist')}</button><button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('outdent')">${svg('outdent')}</button><button class="rn2-tool" onmousedown="event.preventDefault();formatReaderNote('indent')">${svg('indent')}</button>`,insert:`<button class="rn2-tool" onmousedown="event.preventDefault();createReaderNoteLink()">${svg('link')}</button><button class="rn2-tool" onmousedown="event.preventDefault();openCurrentEditorTextInReaderIOS()">${svg('book')}</button>`};return `<div class="rn2-toolbar"><div class="rn2-tabs">${['format','highlight','list','insert'].map(k=>`<button class="rn2-tab ${activeToolbar===k?'active':''}" onmousedown="event.preventDefault();setReaderToolbar('${k}')">${k==='format'?'Text':k==='highlight'?'Color':k==='list'?'List':'Insert'}</button>`).join('')}</div><div class="rn2-tools">${p[activeToolbar]||p.format}</div></div>`;}

  function renderEditor(id=''){ensureData();editingId=id||'';savedRange=null;const n=id?noteById(id):null;const from=readerText().trim();const title=n?(n.title||''):(from?titleFrom(from):'');const html=n?noteHTML(n):escapeHTMLLocal(from).replace(/\n/g,'<br>');const fid=n?.folderId||(folderId!==ALL?folderId:DEFAULT_FOLDER);shell(`<div class="rn2-top"><button class="rn2-icon" onclick="cancelReaderNoteEditor()">${svg('back')}</button><button class="rn2-btn primary" onclick="saveReaderNoteEditorIOS()">Done</button></div><div class="rn2-editor"><input id="rn2Title" class="rn2-title-input" value="${escapeHTMLLocal(title)}" placeholder="Title">${foldersSelect(fid)}<div id="rn2EditorBody" class="rn2-editor-body" contenteditable="true" data-placeholder="Start writing...">${html}</div></div><div class="rn2-bottom">${tools()}<button class="rn2-fab" onclick="saveReaderNoteEditorIOS()">${svg('check')}</button></div>`);const ed=document.getElementById('rn2EditorBody');if(ed){['keyup','mouseup','touchend'].forEach(e=>ed.addEventListener(e,saveRange));setTimeout(()=>ed.focus({preventScroll:true}),0);}}

  function saveEditor(){ensureData();const title=document.getElementById('rn2Title')?.value||'';const fid=document.getElementById('rn2Folder')?.value||DEFAULT_FOLDER;const html=sanitize(document.getElementById('rn2EditorBody')?.innerHTML||'');const text=plain(html);if(!text)return toast('Note text is empty');let n=editingId?noteById(editingId):null;if(!n){n={id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),createdAt:now(),updatedAt:now(),folderId:fid};D.readerNotes.push(n);editingId=n.id;}n.title=String(title||'').trim()||titleFrom(text);n.text=text;n.html=html;n.folderId=fid;n.updatedAt=now();if(!n.createdAt)n.createdAt=n.updatedAt;D.reader.activeNoteId=n.id;save();toast('Note saved');renderDetail(n.id);}

  window.openReaderNotesModal=function(){ensureData();mount();selectMode=false;selected.clear();query='';renderList();openO('readerNotesModal');};
  window.renderReaderNotesListIOS=window.renderReaderNotesList=renderList; window.openReaderNoteDetailIOS=window.openReaderNoteDetail=renderDetail; window.editReaderNoteIOS=window.editReaderNote=renderEditor; window.newReaderNoteIOS=()=>renderEditor(''); window.cancelReaderNoteEditor=()=>editingId?renderDetail(editingId):renderList(); window.saveReaderNoteEditorIOS=saveEditor;
  window.setReaderNotesFolder=id=>{folderId=id||ALL;selectMode=false;selected.clear();renderList();}; window.setReaderToolbar=t=>{activeToolbar=['format','highlight','list','insert'].includes(t)?t:'format';const id=editingId;const title=document.getElementById('rn2Title')?.value||'';const body=document.getElementById('rn2EditorBody')?.innerHTML||'';const fid=document.getElementById('rn2Folder')?.value||DEFAULT_FOLDER;renderEditor(id);const ti=document.getElementById('rn2Title'), bo=document.getElementById('rn2EditorBody'), fo=document.getElementById('rn2Folder'); if(ti)ti.value=title;if(bo)bo.innerHTML=body;if(fo)fo.value=fid;};
  window.createReaderNoteFolder=function(){ensureData();const name=prompt('Folder name');if(!name||!name.trim())return;const clean=name.trim().slice(0,40);if(D.readerNoteFolders.some(f=>f.name.toLowerCase()===clean.toLowerCase()))return toast('Folder already exists');const f={id:'rnf'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:clean,createdAt:now()};D.readerNoteFolders.push(f);folderId=f.id;save();toast('Folder created');renderList();};
  window.handleReaderNoteRow=id=>{if(selectMode){selected.has(String(id))?selected.delete(String(id)):selected.add(String(id));renderList();}else renderDetail(id);}; window.toggleReaderNoteSelectMode=()=>{selectMode=!selectMode;selected.clear();renderList();}; window.selectAllReaderNotes=()=>{const ids=visibleNotes().map(n=>String(n.id));if(selected.size===ids.length)selected.clear();else ids.forEach(id=>selected.add(id));renderList();}; window.deleteSelectedReaderNotes=()=>{if(!selected.size)return toast('No notes selected');if(!confirm(`Delete ${selected.size} selected note${selected.size===1?'':'s'}?`))return;D.readerNotes=D.readerNotes.filter(n=>!selected.has(String(n.id)));selected.clear();selectMode=false;save();renderList();toast('Selected notes deleted');};
  window.showReaderNoteManageMenu=id=>{document.getElementById('rn2Menu')?.remove();const b=document.getElementById('readerNotesBody');if(!b)return;b.insertAdjacentHTML('beforeend',`<div id="rn2Menu" class="rn2-menu"><button onclick="editReaderNoteIOS('${escapeHTMLLocal(id)}')">Edit Note</button><button onclick="openReaderNote('${escapeHTMLLocal(id)}')">Open in Reader</button><button onclick="moveReaderNoteToFolder('${escapeHTMLLocal(id)}')">Move to Folder</button><button onclick="duplicateReaderNote('${escapeHTMLLocal(id)}')">Duplicate</button><button onclick="shareReaderNoteIOS('${escapeHTMLLocal(id)}')">Share Text</button><button class="danger" onclick="deleteReaderNoteIOS('${escapeHTMLLocal(id)}')">Delete</button></div>`);}; window.showReaderNoteMenuIOS=window.showReaderNoteManageMenu;
  window.moveReaderNoteToFolder=id=>{const n=noteById(id);if(!n)return;const fs=folders().filter(f=>f.id!==ALL);const label=fs.map((f,i)=>`${i+1}. ${f.name}`).join('\n');const ans=prompt(`Move to folder:\n${label}\n\nType folder number or new folder name.`);if(!ans)return;const idx=Number(ans.trim())-1;if(Number.isInteger(idx)&&fs[idx])n.folderId=fs[idx].id;else{const clean=ans.trim().slice(0,40);let f=D.readerNoteFolders.find(x=>x.name.toLowerCase()===clean.toLowerCase());if(!f){f={id:'rnf'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:clean,createdAt:now()};D.readerNoteFolders.push(f);}n.folderId=f.id;}n.updatedAt=now();save();renderDetail(id);};
  window.saveReaderNoteSelection=saveRange; window.setReaderHighlightColor=c=>{highlightColor=cleanColor(c);}; window.formatReaderNote=t=>{const ed=document.getElementById('rn2EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('styleWithCSS',false,true);const map={bold:'bold',italic:'italic',underline:'underline',strike:'strikeThrough',bullet:'insertUnorderedList',number:'insertOrderedList',indent:'indent',outdent:'outdent'};if(t==='highlight')document.execCommand('backColor',false,highlightColor);else if(map[t])document.execCommand(map[t],false,null);saveRange();}; window.insertReaderNoteChecklistIOS=()=>{const ed=document.getElementById('rn2EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('insertHTML',false,'☐&nbsp;');saveRange();}; window.createReaderNoteLink=()=>{const url=prompt('Paste link URL');if(!url)return;if(!/^https?:\/\//i.test(url)&&!/^mailto:/i.test(url))return toast('Use http, https, or mailto links');const ed=document.getElementById('rn2EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('createLink',false,url);saveRange();}; window.clearReaderNoteFormatting=()=>{const ed=document.getElementById('rn2EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('removeFormat',false,null);saveRange();};
  function makeRichInteractive(html){const root=document.createElement('div');root.innerHTML=sanitize(html);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>/[A-Za-z]/.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{const frag=document.createDocumentFragment();(String(node.nodeValue||'').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|[^A-Za-z]+/g)||[]).forEach(p=>{if(/^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(p)){const sp=document.createElement('span');sp.className='reader-token';sp.dataset.word=p;sp.textContent=p;frag.appendChild(sp)}else frag.appendChild(document.createTextNode(p))});node.replaceWith(frag)});return root.innerHTML;}
  function openRichInReader(id, html, text){D.reader.activeNoteId=id||'';D.reader.text=text;D.reader.richHTML=html;D.reader.isRichNote=true;const input=document.getElementById('readerInput');if(input)input.value=text;localStorage.setItem('wordjar_reader_note_v1',text);save();closeO('readerNotesModal');if(typeof renderReader==='function')renderReader();}
  window.openCurrentEditorTextInReaderIOS=()=>{const html=sanitize(document.getElementById('rn2EditorBody')?.innerHTML||'');const text=plain(html);if(!text)return toast('Note text is empty');openRichInReader(editingId,html,text);}; window.openReaderNote=id=>{const n=noteById(id);if(!n)return;openRichInReader(n.id,noteHTML(n),noteText(n));toast('Opened note in Reader');}; window.duplicateReaderNote=id=>{const n=noteById(id);if(!n)return;D.readerNotes.push({...n,id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:(n.title||'Untitled note')+' Copy',createdAt:now(),updatedAt:now()});save();renderList();}; window.shareReaderNoteIOS=id=>{const n=noteById(id);if(!n)return;const text=`${n.title||'Untitled note'}\n\n${noteText(n)}`;if(navigator.share)navigator.share({title:n.title||'Reader note',text}).catch(()=>{});else navigator.clipboard?.writeText(text).then(()=>toast('Copied note text'));}; window.deleteReaderNoteIOS=window.deleteReaderNote=id=>{const n=noteById(id);if(!n)return;if(!confirm(`Delete note "${n.title||'Untitled note'}"?`))return;D.readerNotes=D.readerNotes.filter(x=>String(x.id)!==String(id));save();renderList();};
  window.saveCurrentReaderNoteAsNew=()=>{const text=readerText().trim();if(!text)return newReaderNoteIOS();ensureData();const html=D.reader?.isRichNote&&D.reader?.richHTML?sanitize(D.reader.richHTML):escapeHTMLLocal(text).replace(/\n/g,'<br>');const n={id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:titleFrom(text),text,html,folderId:folderId!==ALL?folderId:DEFAULT_FOLDER,createdAt:now(),updatedAt:now()};D.readerNotes.push(n);D.reader.activeNoteId=n.id;save();toast('Reader note saved');}; window.updateCurrentReaderNote=()=>{const n=noteById(D.reader?.activeNoteId||'');if(!n)return saveCurrentReaderNoteAsNew();const text=readerText().trim();if(!text)return toast('Nothing to save');n.text=text;n.html=D.reader?.isRichNote&&D.reader?.richHTML?sanitize(D.reader.richHTML):escapeHTMLLocal(text).replace(/\n/g,'<br>');n.updatedAt=now();save();toast('Current note updated');};
  const originalRenderReader=window.renderReader; window.renderReader=function(){if(typeof originalRenderReader==='function')originalRenderReader();const input=document.getElementById('readerInput');if(input&&!input.__rn2Clear){input.addEventListener('input',()=>{D.reader.isRichNote=false;D.reader.richHTML=''});input.__rn2Clear=true;}if(D.reader?.isRichNote&&D.reader?.richHTML){const tokens=document.getElementById('readerTokens');if(tokens){tokens.innerHTML=`<div class="reader-rich-badge">Saved note · rich text</div><div class="${RICH_CLASS}">${makeRichInteractive(D.reader.richHTML)}</div>`;if(!tokens.__rn2Click){tokens.addEventListener('click',e=>{const token=e.target.closest('.reader-token');if(token&&typeof window.selectReaderWord==='function')window.selectReaderWord(token)});tokens.__rn2Click=true;}}}const actions=document.getElementById('readerNoteActions');if(actions)actions.innerHTML=`<div class="reader-note-actions"><button class="btn btn-s" type="button" onclick="openReaderNotesModal()">Notes</button><button class="btn btn-p" type="button" onclick="saveCurrentReaderNoteAsNew()">Save as Note</button></div><div id="readerActiveNoteLabel" class="reader-note-active">${D.reader?.activeNoteId?'Current saved note loaded':'Current: unsaved draft'}</div>`;};
})();
