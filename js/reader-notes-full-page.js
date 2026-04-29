// WordJar Reader Notes Full Page V1
// Replaces the notes popup with a real full-page mobile view.

(function installReaderNotesFullPage() {
  if (window.__wordjarReaderNotesFullPageInstalled) return;
  window.__wordjarReaderNotesFullPageInstalled = true;

  const ALL = 'all';
  const DEFAULT_FOLDER = 'uncategorized';
  const RICH_CLASS = 'reader-rich-note-view';
  let folderId = ALL;
  let query = '';
  let selectMode = false;
  let selected = new Set();
  let editingId = '';
  let toolbarTab = 'text';
  let highlightColor = '#fff2a8';
  let savedRange = null;

  function esc(v) {
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    if (typeof escHTML === 'function') return escHTML(v);
    return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function now() { return new Date().toISOString().slice(0,16).replace('T',' '); }
  function plain(html) { const d = document.createElement('div'); d.innerHTML = String(html || ''); return (d.textContent || '').replace(/\u00a0/g,' ').trim(); }
  function noteText(n) { return String(n?.text || plain(n?.html || '') || '').trim(); }
  function titleFrom(text) { return String(text || '').replace(/\s+/g,' ').trim().slice(0,60) || 'Untitled note'; }
  function words(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
  function preview(text) { const s = String(text || '').replace(/\s+/g,' ').trim(); return s.length > 120 ? s.slice(0,120) + '…' : s; }
  function validColor(v) { return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : '#fff2a8'; }

  function ensureData() {
    D.reader = D.reader || {};
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

  function folders() {
    ensureData();
    return [
      { id: ALL, name: 'All Notes', count: D.readerNotes.length },
      { id: DEFAULT_FOLDER, name: 'Notes', count: D.readerNotes.filter(n => (n.folderId || DEFAULT_FOLDER) === DEFAULT_FOLDER).length },
      ...D.readerNoteFolders.map(f => ({ ...f, count: D.readerNotes.filter(n => String(n.folderId) === String(f.id)).length }))
    ];
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

  function sanitize(html) {
    const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','BR','DIV','P','SPAN','MARK','UL','OL','LI','A','BLOCKQUOTE']);
    const box = document.createElement('div');
    box.innerHTML = String(html || '');
    function walk(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (!allowed.has(child.tagName)) { child.replaceWith(document.createTextNode(child.textContent || '')); return; }
        [...child.attributes].forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name === 'href' && child.tagName === 'A') {
            if (/^(https?:|mailto:)/i.test(attr.value || '')) { child.setAttribute('target','_blank'); child.setAttribute('rel','noopener noreferrer'); }
            else child.removeAttribute(attr.name);
            return;
          }
          if (name !== 'style') child.removeAttribute(attr.name);
        });
        const style = child.getAttribute('style') || '';
        const safe = [];
        const bg = style.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{6})/i);
        if (/text-decoration[^;]*underline/i.test(style)) safe.push('text-decoration:underline');
        if (/text-decoration[^;]*line-through/i.test(style)) safe.push('text-decoration:line-through');
        if (bg) safe.push(`background-color:${validColor(bg[1])}`);
        if (safe.length) child.setAttribute('style', safe.join(';'));
        else child.removeAttribute('style');
        walk(child);
      });
    }
    walk(box);
    return box.innerHTML;
  }

  function noteHTML(n) { return n?.html ? sanitize(n.html) : esc(noteText(n)).replace(/\n/g,'<br>'); }

  function readerText() { return document.getElementById('readerInput')?.value || ''; }

  function injectCSS() {
    if (document.getElementById('readerNotesFullPageStyle')) return;
    const s = document.createElement('style');
    s.id = 'readerNotesFullPageStyle';
    s.textContent = `
      #readerNotesModal{display:none!important}
      .rn4-page{position:fixed;inset:0;z-index:99999;background:var(--bg);color:var(--ink);display:none;flex-direction:column;box-sizing:border-box;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);overflow:hidden}
      .rn4-page.active{display:flex}
      .rn4-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px 8px;box-sizing:border-box}.rn4-left,.rn4-right{display:flex;align-items:center;gap:8px;min-width:0}.rn4-right{justify-content:flex-end}
      .rn4-btn,.rn4-icon{height:38px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);color:var(--ink);font-size:13px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.rn4-btn{padding:0 13px;white-space:nowrap}.rn4-btn.primary{color:var(--brand,#2f7cf6)}.rn4-icon{width:38px;min-width:38px;padding:0;font-size:24px;line-height:1}.rn4-icon svg{width:20px;height:20px;stroke-width:2.5}
      .rn4-head{padding:2px 18px 10px}.rn4-title{font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.045em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rn4-sub{margin-top:5px;color:var(--ink2);font-size:13px;font-weight:800}
      .rn4-search-wrap{padding:0 18px 10px}.rn4-search{height:42px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur);display:flex;align-items:center;gap:9px;padding:0 12px}.rn4-search span{font-size:15px;color:var(--ink2)}.rn4-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:750}
      .rn4-folders{display:flex;gap:8px;overflow-x:auto;padding:0 18px 10px;scrollbar-width:none}.rn4-folders::-webkit-scrollbar{display:none}.rn4-chip{height:34px;border:1px solid var(--bdr);border-radius:999px;background:var(--sur);color:var(--ink2);padding:0 12px;font-size:12px;font-weight:900;white-space:nowrap}.rn4-chip.active{background:var(--sur2);color:var(--ink);box-shadow:0 0 0 1px var(--ink) inset}
      .rn4-content{flex:1 1 auto;min-height:0;overflow:auto;padding:0 18px 18px}.rn4-group{font-size:15px;font-weight:950;margin:12px 2px 8px}.rn4-list{border:1px solid var(--bdr);border-radius:20px;background:var(--sur2);overflow:hidden}.rn4-row{min-height:72px;display:flex;gap:11px;align-items:flex-start;padding:13px 14px;border-bottom:1px solid var(--bdr)}.rn4-row:last-child{border-bottom:0}.rn4-row:active{background:rgba(0,0,0,.035)}.rn4-check{display:none;width:23px;height:23px;min-width:23px;border:2px solid var(--bdr);border-radius:999px;margin-top:2px;color:white;align-items:center;justify-content:center;font-size:14px}.rn4-selecting .rn4-check{display:flex}.rn4-row.selected .rn4-check{background:var(--brand,#2f7cf6);border-color:var(--brand,#2f7cf6)}.rn4-main{min-width:0;flex:1}.rn4-row-title{font-size:16px;font-weight:950;line-height:1.25;margin-bottom:4px}.rn4-row-meta{font-size:12px;font-weight:800;color:var(--ink2);margin-bottom:6px}.rn4-row-preview{font-size:13px;line-height:1.38;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.rn4-empty{border:1px solid var(--bdr);border-radius:20px;background:var(--sur2);padding:24px;text-align:center;color:var(--ink2);font-size:13px;font-weight:800;line-height:1.5}
      .rn4-detail-title{font-size:29px;line-height:1.08;font-weight:950;letter-spacing:-.04em;margin:2px 0 6px}.rn4-meta{color:var(--ink2);font-size:12px;font-weight:850;margin-bottom:10px}.rn4-body{font-size:16px;line-height:1.62;word-break:break-word}.rn4-body mark,.rn4-editor-body mark,.${RICH_CLASS} mark{border-radius:4px;padding:0 2px}
      .rn4-editor{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:0 18px}.rn4-title-input{border:0;outline:0;background:transparent;color:var(--ink);font-size:29px;font-weight:950;letter-spacing:-.04em;line-height:1.08;padding:4px 0 8px;width:100%}.rn4-folder-select{height:34px;border:1px solid var(--bdr);border-radius:12px;background:var(--sur);color:var(--ink2);font-size:12px;font-weight:850;padding:0 10px;max-width:100%;margin-bottom:8px}.rn4-editor-body{flex:1 1 auto;min-height:0;overflow:auto;outline:0;font-size:16px;line-height:1.62;white-space:pre-wrap}.rn4-editor-body:empty:before{content:attr(data-placeholder);color:var(--ink2)}
      .rn4-toolbar{flex:0 0 auto;padding:8px 14px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(to top,var(--bg) 85%,rgba(255,255,255,0));display:grid;gap:7px}.rn4-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:5px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur)}.rn4-tab{height:29px;border:0;border-radius:11px;background:transparent;color:var(--ink2);font-size:12px;font-weight:950}.rn4-tab.active{background:var(--ink);color:var(--sur)}.rn4-tools{display:flex;gap:10px;align-items:center;overflow-x:auto;border:1px solid var(--bdr);border-radius:18px;background:var(--sur);padding:10px 12px;scrollbar-width:none}.rn4-tools::-webkit-scrollbar{display:none}.rn4-tool{height:30px;min-width:30px;border:0;border-radius:10px;background:transparent;color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:950}.rn4-swatch{width:28px;height:28px;min-width:28px;border:1px solid var(--bdr);border-radius:999px}.rn4-color{width:30px;height:30px;min-width:30px;border:2px solid var(--bdr);border-radius:999px;overflow:hidden}.rn4-color input{width:38px;height:38px;border:0;padding:0;margin:-4px;background:transparent}
      .rn4-selection{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 18px 16px}.rn4-selection .btn{height:44px;border-radius:15px;min-width:0}.rn4-menu{position:absolute;right:16px;top:calc(62px + env(safe-area-inset-top));min-width:210px;border:1px solid var(--bdr);border-radius:16px;background:var(--sur);box-shadow:0 18px 38px rgba(0,0,0,.14);overflow:hidden;z-index:10}.rn4-menu button{width:100%;border:0;background:transparent;color:var(--ink);text-align:left;padding:13px 14px;font-size:14px;font-weight:850}.rn4-menu button+button{border-top:1px solid var(--bdr)}.rn4-menu .danger{color:#e24a4a}
      .reader-rich-badge{display:inline-flex;margin-bottom:10px;padding:7px 10px;border:1px solid var(--bdr);background:var(--sur2);border-radius:999px;color:var(--ink2);font-size:12px;font-weight:850}.${RICH_CLASS}{font-size:17px;line-height:1.85;color:var(--ink)}.${RICH_CLASS} .reader-token{display:inline;border-radius:8px;padding:1px 2px;cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  function svg(name){const icons={back:'<path d="M15 18l-6-6 6-6"/>',book:'<path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11z"/><path d="M8 7h8M8 11h8M8 15h5"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${icons[name]||''}</svg>`;}
  function page() { injectCSS(); let p = document.getElementById('readerNotesFullPage'); if (!p) { p = document.createElement('div'); p.id = 'readerNotesFullPage'; p.className = 'rn4-page'; document.body.appendChild(p); } return p; }
  function shell(html){ const p = page(); p.innerHTML = html; p.classList.add('active'); document.body.style.overflow = 'hidden'; }
  function closePage(){ const p = document.getElementById('readerNotesFullPage'); if (p) p.classList.remove('active'); document.body.style.overflow = ''; }

  function visibleNotes(){ensureData();const q=query.trim().toLowerCase();return D.readerNotes.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).filter(n=>folderId===ALL||String(n.folderId||DEFAULT_FOLDER)===String(folderId)).filter(n=>!q||[n.title,noteText(n),folderName(n.folderId||DEFAULT_FOLDER)].join(' ').toLowerCase().includes(q));}
  function chips(){return `<div class="rn4-folders">${folders().map(f=>`<button class="rn4-chip ${String(folderId)===String(f.id)?'active':''}" onclick="setReaderNotesFolder('${esc(f.id)}')">${esc(f.name)} · ${f.count}</button>`).join('')}</div>`;}

  function renderList(q=query){ensureData();query=q||'';const notes=visibleNotes();const grouped=new Map();notes.forEach(n=>{const g=groupLabel(n.updatedAt||n.createdAt);if(!grouped.has(g))grouped.set(g,[]);grouped.get(g).push(n)});const rows=notes.length?['Today','Yesterday','Previous 7 Days','Older'].filter(g=>grouped.has(g)).map(g=>`<div class="rn4-group">${g}</div><div class="rn4-list ${selectMode?'rn4-selecting':''}">${grouped.get(g).map(n=>{const on=selected.has(String(n.id));return `<div class="rn4-row ${on?'selected':''}" onclick="handleReaderNoteRow('${esc(n.id)}')"><div class="rn4-check">${on?'✓':''}</div><div class="rn4-main"><div class="rn4-row-title">${esc(n.title||'Untitled note')}</div><div class="rn4-row-meta">${esc(shortDate(n.updatedAt||n.createdAt))} · ${esc(folderName(n.folderId||DEFAULT_FOLDER))} · ${words(noteText(n))} words</div><div class="rn4-row-preview">${esc(preview(noteText(n)))}</div></div></div>`}).join('')}</div>`).join(''):`<div class="rn4-empty">No notes here yet.<br>Tap New Note to create one.</div>`;shell(`<div class="rn4-top"><div class="rn4-left">${D.readerNotes.length?`<button class="rn4-btn" onclick="toggleReaderNoteSelectMode()">${selectMode?'Cancel':'Select'}</button>`:''}<button class="rn4-btn primary" onclick="newReaderNoteIOS()">New Note</button></div><div class="rn4-right"><button class="rn4-btn" onclick="createReaderNoteFolder()">New Folder</button><button class="rn4-icon" onclick="closeReaderNotesPage()">×</button></div></div><div class="rn4-head"><div class="rn4-title">${esc(folderName(folderId))}</div><div class="rn4-sub">${notes.length} note${notes.length===1?'':'s'}</div></div><div class="rn4-search-wrap"><div class="rn4-search"><span>⌕</span><input value="${esc(query)}" placeholder="Search notes" oninput="renderReaderNotesListIOS(this.value)"></div></div>${chips()}<div class="rn4-content">${rows}</div>${selectMode?`<div class="rn4-selection"><button class="btn btn-s" onclick="selectAllReaderNotes()">${selected.size===notes.length&&notes.length?'Clear All':'Select All'}</button><button class="btn btn-s" onclick="deleteSelectedReaderNotes()" style="color:#e24a4a">Delete (${selected.size})</button></div>`:''}`);}
  function renderDetail(id){const n=noteById(id);if(!n)return renderList();shell(`<div class="rn4-top"><button class="rn4-icon" onclick="renderReaderNotesListIOS()">${svg('back')}</button><div class="rn4-right"><button class="rn4-btn primary" onclick="openReaderNote('${esc(id)}')">Open in Reader</button><button class="rn4-icon" onclick="showReaderNoteManageMenu('${esc(id)}')">⋯</button></div></div><div class="rn4-content"><div class="rn4-detail-title">${esc(n.title||'Untitled note')}</div><div class="rn4-meta">${esc(shortDate(n.updatedAt||n.createdAt))} · ${words(noteText(n))} words</div><div class="rn4-meta">Folder: ${esc(folderName(n.folderId||DEFAULT_FOLDER))}</div><div class="rn4-body">${noteHTML(n)}</div></div><div class="rn4-toolbar"><button class="rn4-btn primary" onclick="editReaderNoteIOS('${esc(id)}')">Edit Note</button></div>`)}

  function saveRange(){const sel=window.getSelection();const ed=document.getElementById('rn4EditorBody');if(sel&&ed&&sel.rangeCount){const r=sel.getRangeAt(0);if(ed.contains(r.commonAncestorContainer))savedRange=r.cloneRange()}}function restoreRange(){if(!savedRange)return;const sel=window.getSelection();if(sel){sel.removeAllRanges();sel.addRange(savedRange)}}
  function folderSelect(v){return `<select id="rn4Folder" class="rn4-folder-select">${folders().filter(f=>f.id!==ALL).map(f=>`<option value="${esc(f.id)}" ${String(v||DEFAULT_FOLDER)===String(f.id)?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`}
  function tools(){const sw=['#fff2a8','#d7f9d2','#cdefff','#ffd6e8','#e6d7ff','#ffd6a5'];const panels={text:`<button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('bold')">B</button><button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('italic')"><i>I</i></button><button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('underline')">U</button><button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('strike')">S</button><button class="rn4-tool" onmousedown="event.preventDefault();clearReaderNoteFormatting()">Aa</button>`,color:`<button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('highlight')">▰</button>${sw.map(c=>`<button class="rn4-swatch" style="background:${c}" onmousedown="event.preventDefault();setReaderHighlightColor('${c}');formatReaderNote('highlight')"></button>`).join('')}<label class="rn4-color"><input type="color" value="${highlightColor}" onchange="setReaderHighlightColor(this.value);formatReaderNote('highlight')"></label>`,list:`<button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('bullet')">•</button><button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('number')">1.</button><button class="rn4-tool" onmousedown="event.preventDefault();insertReaderNoteChecklistIOS()">☐</button><button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('outdent')">⇤</button><button class="rn4-tool" onmousedown="event.preventDefault();formatReaderNote('indent')">⇥</button>`,insert:`<button class="rn4-tool" onmousedown="event.preventDefault();createReaderNoteLink()">🔗</button><button class="rn4-tool" onmousedown="event.preventDefault();openCurrentEditorTextInReaderIOS()">Reader</button>`};return `<div class="rn4-tabs">${['text','color','list','insert'].map(k=>`<button class="rn4-tab ${toolbarTab===k?'active':''}" onmousedown="event.preventDefault();setReaderToolbar('${k}')">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div><div class="rn4-tools">${panels[toolbarTab]||panels.text}</div>`}
  function renderEditor(id=''){ensureData();editingId=id||'';const n=id?noteById(id):null;const from=readerText().trim();const title=n?(n.title||''):(from?titleFrom(from):'');const html=n?noteHTML(n):esc(from).replace(/\n/g,'<br>');const fid=n?.folderId||(folderId!==ALL?folderId:DEFAULT_FOLDER);shell(`<div class="rn4-top"><button class="rn4-icon" onclick="cancelReaderNoteEditor()">${svg('back')}</button><button class="rn4-btn primary" onclick="saveReaderNoteEditorIOS()">Done</button></div><div class="rn4-editor"><input id="rn4Title" class="rn4-title-input" value="${esc(title)}" placeholder="Title">${folderSelect(fid)}<div id="rn4EditorBody" class="rn4-editor-body" contenteditable="true" data-placeholder="Start writing..."></div></div><div class="rn4-toolbar">${tools()}</div>`);const ed=document.getElementById('rn4EditorBody');if(ed){ed.innerHTML=html;['keyup','mouseup','touchend'].forEach(e=>ed.addEventListener(e,saveRange));setTimeout(()=>ed.focus({preventScroll:true}),50)}}
  function saveEditor(){ensureData();const title=document.getElementById('rn4Title')?.value||'';const fid=document.getElementById('rn4Folder')?.value||DEFAULT_FOLDER;const html=sanitize(document.getElementById('rn4EditorBody')?.innerHTML||'');const text=plain(html);if(!text)return toast('Note text is empty');let n=editingId?noteById(editingId):null;if(!n){n={id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),createdAt:now(),updatedAt:now(),folderId:fid};D.readerNotes.push(n);editingId=n.id}n.title=String(title||'').trim()||titleFrom(text);n.text=text;n.html=html;n.folderId=fid;n.updatedAt=now();D.reader.activeNoteId=n.id;save();toast('Note saved');renderDetail(n.id)}

  window.openReaderNotesModal=function(){ensureData();folderId = folderId || ALL;selectMode=false;selected.clear();query='';renderList()};
  window.closeReaderNotesPage=closePage;window.renderReaderNotesListIOS=window.renderReaderNotesList=renderList;window.openReaderNoteDetailIOS=window.openReaderNoteDetail=renderDetail;window.editReaderNoteIOS=window.editReaderNote=renderEditor;window.newReaderNoteIOS=function(){renderEditor('')};window.cancelReaderNoteEditor=function(){editingId?renderDetail(editingId):renderList()};window.saveReaderNoteEditorIOS=saveEditor;
  window.setReaderNotesFolder=id=>{folderId=id||ALL;selectMode=false;selected.clear();renderList()};window.createReaderNoteFolder=function(){const name=prompt('Folder name');if(!name||!name.trim())return;const clean=name.trim().slice(0,40);if(D.readerNoteFolders.some(f=>f.name.toLowerCase()===clean.toLowerCase()))return toast('Folder already exists');const f={id:'rnf'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:clean,createdAt:now()};D.readerNoteFolders.push(f);folderId=f.id;save();renderList()};
  window.handleReaderNoteRow=id=>{if(selectMode){selected.has(String(id))?selected.delete(String(id)):selected.add(String(id));renderList()}else renderDetail(id)};window.toggleReaderNoteSelectMode=()=>{selectMode=!selectMode;selected.clear();renderList()};window.selectAllReaderNotes=()=>{const ids=visibleNotes().map(n=>String(n.id));if(selected.size===ids.length)selected.clear();else ids.forEach(id=>selected.add(id));renderList()};window.deleteSelectedReaderNotes=()=>{if(!selected.size)return toast('No notes selected');if(!confirm(`Delete ${selected.size} selected note${selected.size===1?'':'s'}?`))return;D.readerNotes=D.readerNotes.filter(n=>!selected.has(String(n.id)));selected.clear();selectMode=false;save();renderList()};
  window.showReaderNoteManageMenu=id=>{document.getElementById('rn4Menu')?.remove();const p=page();p.insertAdjacentHTML('beforeend',`<div id="rn4Menu" class="rn4-menu"><button onclick="editReaderNoteIOS('${esc(id)}')">Edit Note</button><button onclick="openReaderNote('${esc(id)}')">Open in Reader</button><button onclick="moveReaderNoteToFolder('${esc(id)}')">Move to Folder</button><button onclick="duplicateReaderNote('${esc(id)}')">Duplicate</button><button onclick="shareReaderNoteIOS('${esc(id)}')">Share Text</button><button class="danger" onclick="deleteReaderNoteIOS('${esc(id)}')">Delete</button></div>`)};window.showReaderNoteMenuIOS=window.showReaderNoteManageMenu;
  window.setReaderToolbar=t=>{toolbarTab=['text','color','list','insert'].includes(t)?t:'text';const id=editingId,title=document.getElementById('rn4Title')?.value||'',body=document.getElementById('rn4EditorBody')?.innerHTML||'',fid=document.getElementById('rn4Folder')?.value||DEFAULT_FOLDER;renderEditor(id);document.getElementById('rn4Title').value=title;document.getElementById('rn4EditorBody').innerHTML=body;document.getElementById('rn4Folder').value=fid};window.setReaderHighlightColor=c=>{highlightColor=validColor(c)};
  window.formatReaderNote=t=>{const ed=document.getElementById('rn4EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('styleWithCSS',false,true);const map={bold:'bold',italic:'italic',underline:'underline',strike:'strikeThrough',bullet:'insertUnorderedList',number:'insertOrderedList',indent:'indent',outdent:'outdent'};if(t==='highlight')document.execCommand('backColor',false,highlightColor);else if(map[t])document.execCommand(map[t],false,null);saveRange()};window.insertReaderNoteChecklistIOS=()=>{const ed=document.getElementById('rn4EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('insertHTML',false,'☐&nbsp;');saveRange()};window.createReaderNoteLink=()=>{const url=prompt('Paste link URL');if(!url)return;if(!/^https?:\/\//i.test(url)&&!/^mailto:/i.test(url))return toast('Use http, https, or mailto links');const ed=document.getElementById('rn4EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('createLink',false,url)};window.clearReaderNoteFormatting=()=>{const ed=document.getElementById('rn4EditorBody');if(!ed)return;ed.focus();restoreRange();document.execCommand('removeFormat',false,null)};
  function makeRich(html){const root=document.createElement('div');root.innerHTML=sanitize(html);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>/[A-Za-z]/.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{const frag=document.createDocumentFragment();(String(node.nodeValue||'').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|[^A-Za-z]+/g)||[]).forEach(p=>{if(/^[A-Za-z]+(?:['’-][A-Za-z]+)?$/.test(p)){const sp=document.createElement('span');sp.className='reader-token';sp.dataset.word=p;sp.textContent=p;frag.appendChild(sp)}else frag.appendChild(document.createTextNode(p))});node.replaceWith(frag)});return root.innerHTML}
  function openRich(id,html,text){D.reader.activeNoteId=id||'';D.reader.text=text;D.reader.richHTML=html;D.reader.isRichNote=true;const input=document.getElementById('readerInput');if(input)input.value=text;localStorage.setItem('wordjar_reader_note_v1',text);save();closePage();if(typeof renderReader==='function')renderReader()}
  window.openCurrentEditorTextInReaderIOS=()=>{const html=sanitize(document.getElementById('rn4EditorBody')?.innerHTML||'');const text=plain(html);if(!text)return toast('Note text is empty');openRich(editingId,html,text)};window.openReaderNote=id=>{const n=noteById(id);if(!n)return;openRich(n.id,noteHTML(n),noteText(n))};window.moveReaderNoteToFolder=id=>{const n=noteById(id);if(!n)return;const fs=folders().filter(f=>f.id!==ALL);const ans=prompt(`Move to folder:\n${fs.map((f,i)=>`${i+1}. ${f.name}`).join('\n')}\n\nType folder number or new folder name.`);if(!ans)return;const idx=Number(ans.trim())-1;if(Number.isInteger(idx)&&fs[idx])n.folderId=fs[idx].id;else{let f=D.readerNoteFolders.find(x=>x.name.toLowerCase()===ans.trim().toLowerCase());if(!f){f={id:'rnf'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:ans.trim().slice(0,40),createdAt:now()};D.readerNoteFolders.push(f)}n.folderId=f.id}save();renderDetail(id)};window.duplicateReaderNote=id=>{const n=noteById(id);if(!n)return;D.readerNotes.push({...n,id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:(n.title||'Untitled note')+' Copy',createdAt:now(),updatedAt:now()});save();renderList()};window.shareReaderNoteIOS=id=>{const n=noteById(id);if(!n)return;const text=`${n.title||'Untitled note'}\n\n${noteText(n)}`;if(navigator.share)navigator.share({title:n.title||'Reader note',text}).catch(()=>{});else navigator.clipboard?.writeText(text).then(()=>toast('Copied note text'))};window.deleteReaderNoteIOS=window.deleteReaderNote=id=>{if(!confirm('Delete this note?'))return;D.readerNotes=D.readerNotes.filter(n=>String(n.id)!==String(id));save();renderList()};
  window.saveCurrentReaderNoteAsNew=()=>{const text=readerText().trim();if(!text)return newReaderNoteIOS();const html=D.reader?.isRichNote&&D.reader?.richHTML?sanitize(D.reader.richHTML):esc(text).replace(/\n/g,'<br>');ensureData();const n={id:'rn'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:titleFrom(text),text,html,folderId:folderId!==ALL?folderId:DEFAULT_FOLDER,createdAt:now(),updatedAt:now()};D.readerNotes.push(n);D.reader.activeNoteId=n.id;save();toast('Reader note saved')};window.updateCurrentReaderNote=()=>window.saveCurrentReaderNoteAsNew();
  const oldRender=window.renderReader;window.renderReader=function(){if(typeof oldRender==='function')oldRender();if(D.reader?.isRichNote&&D.reader?.richHTML){const tokens=document.getElementById('readerTokens');if(tokens){tokens.innerHTML=`<div class="reader-rich-badge">Saved note · rich text</div><div class="${RICH_CLASS}">${makeRich(D.reader.richHTML)}</div>`;if(!tokens.__rn4Click){tokens.addEventListener('click',e=>{const token=e.target.closest('.reader-token');if(token&&typeof window.selectReaderWord==='function')window.selectReaderWord(token)});tokens.__rn4Click=true}}}const actions=document.getElementById('readerNoteActions');if(actions)actions.innerHTML=`<div class="reader-note-actions"><button class="btn btn-s" type="button" onclick="openReaderNotesModal()">Notes</button><button class="btn btn-p" type="button" onclick="saveCurrentReaderNoteAsNew()">Save as Note</button></div><div id="readerActiveNoteLabel" class="reader-note-active">${D.reader?.activeNoteId?'Current saved note loaded':'Current: unsaved draft'}</div>`};
})();
