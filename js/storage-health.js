// WordJar Storage Health V3
// Local-first helper: shows storage use, clears non-essential caches, and repairs app data safely.
// Clearing cache must never delete cards, decks, saved notes, or current Reader text.

(function installStorageHealth() {
  if (window.__wordjarStorageHealthInstalled) return;
  window.__wordjarStorageHealthInstalled = true;

  const CLEARABLE_CACHE_KEYS = [
    'wordjar_reader_lookup_cache_v1',
    'wordjar_reader_quality_cache_v1'
  ];

  const PROTECTED_KEYS = new Set([
    'wordjar_reader_note_v1'
  ]);

  function bytesOf(value) {
    return new Blob([String(value || '')]).size;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function storageBreakdown() {
    let appBytes = 0;
    let cacheBytes = 0;
    let readerDraftBytes = 0;
    let otherBytes = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      const size = bytesOf(key) + bytesOf(value);
      if (key === SK) appBytes += size;
      else if (CLEARABLE_CACHE_KEYS.includes(key) || (key.startsWith('wordjar_reader_') && !PROTECTED_KEYS.has(key))) cacheBytes += size;
      else if (PROTECTED_KEYS.has(key)) readerDraftBytes += size;
      else otherBytes += size;
    }

    const archive = D.statsArchive?.reviewLog || {};
    return {
      appBytes,
      cacheBytes,
      readerDraftBytes,
      otherBytes,
      totalBytes: appBytes + cacheBytes + readerDraftBytes + otherBytes,
      words: Array.isArray(D.words) ? D.words.length : 0,
      decks: Array.isArray(D.decks) ? D.decks.length : 0,
      reviewLogs: Array.isArray(D.reviewLog) ? D.reviewLog.length : 0,
      archivedReviews: Number(archive.totalReviews || 0)
    };
  }

  function clearNonEssentialCaches() {
    CLEARABLE_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('wordjar_reader_') && !PROTECTED_KEYS.has(key)) localStorage.removeItem(key);
    });
    if (window.WordJarDictionaryPerformance?.clearCache) WordJarDictionaryPerformance.clearCache();
    if (window.WordJarDeckPerformance?.clearCache) WordJarDeckPerformance.clearCache();
    if (window.WordJarDashboardStats?.clearStatsCache) WordJarDashboardStats.clearStatsCache();
    if (window.WordJarHomePerformance?.clearCache) WordJarHomePerformance.clearCache();
    if (window.WordJarCalendarPerformance?.clearCache) WordJarCalendarPerformance.clearCache();
  }

  function injectStyles() {
    if (document.getElementById('storageHealthStyle')) return;
    const style = document.createElement('style');
    style.id = 'storageHealthStyle';
    style.textContent = `
      .storage-health-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; margin:12px 0; }
      .storage-health-card { border:1px solid var(--bdr); background:var(--sur2); border-radius:16px; padding:12px; min-width:0; }
      .storage-health-label { color:var(--ink2); font-size:11px; font-weight:850; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .storage-health-value { color:var(--ink); font-size:20px; font-weight:950; margin-top:4px; letter-spacing:-.03em; }
      .storage-health-note { color:var(--ink2); font-size:12px; line-height:1.4; margin-top:8px; }
      .storage-health-actions { display:grid; gap:8px; margin-top:12px; }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById('storageHealthModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'storageHealthModal';
    modal.className = 'overlay';
    modal.addEventListener('click', e => {
      if (e.target === modal) closeO('storageHealthModal');
    });
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-header" style="margin-bottom:14px;">
          <div>
            <div class="sh-title">Storage Health</div>
            <div class="modal-subtitle" style="margin-top:4px; color:var(--ink2); font-size:13px; line-height:1.4;">Local-first storage status.</div>
          </div>
          <button class="btn-close" type="button" onclick="closeO('storageHealthModal')" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div id="storageHealthBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderBody() {
    const b = storageBreakdown();
    const body = document.getElementById('storageHealthBody');
    if (!body) return;
    body.innerHTML = `
      <div class="storage-health-grid">
        <div class="storage-health-card"><div class="storage-health-label">Total local storage</div><div class="storage-health-value">${formatBytes(b.totalBytes)}</div></div>
        <div class="storage-health-card"><div class="storage-health-label">Main app data</div><div class="storage-health-value">${formatBytes(b.appBytes)}</div></div>
        <div class="storage-health-card"><div class="storage-health-label">Temporary caches</div><div class="storage-health-value">${formatBytes(b.cacheBytes)}</div></div>
        <div class="storage-health-card"><div class="storage-health-label">Reader draft</div><div class="storage-health-value">${formatBytes(b.readerDraftBytes)}</div></div>
        <div class="storage-health-card"><div class="storage-health-label">Review logs</div><div class="storage-health-value">${b.reviewLogs}</div></div>
        <div class="storage-health-card"><div class="storage-health-label">Archived reviews</div><div class="storage-health-value">${b.archivedReviews}</div></div>
      </div>
      <div class="storage-health-note">Clearing temporary caches does not delete decks, cards, review history summaries, or Reader draft text.</div>
      <div class="storage-health-actions">
        <button class="btn btn-s btn-full" type="button" onclick="clearWordJarCachesFromSettings()">Clear temporary caches</button>
        <button class="btn btn-s btn-full" type="button" onclick="repairWordJarDataFromSettings()">Repair app data</button>
      </div>
    `;
  }

  window.openStorageHealthModal = function openStorageHealthModal() {
    injectStyles();
    ensureModal();
    renderBody();
    openO('storageHealthModal');
  };

  window.clearWordJarCachesFromSettings = function clearWordJarCachesFromSettings() {
    clearNonEssentialCaches();
    if (window.WordJarFreeFirstMaintenance?.run) WordJarFreeFirstMaintenance.run();
    renderBody();
    if (typeof toast === 'function') toast('Temporary caches cleared');
  };

  window.repairWordJarDataFromSettings = function repairWordJarDataFromSettings() {
    const result = window.WordJarAppIntegrity?.run ? WordJarAppIntegrity.run({ silent: false }) : { changed: false };
    clearNonEssentialCaches();
    renderBody();
    if (!result.changed && typeof toast === 'function') toast('No repair needed');
    if (typeof refreshAllVisibleUI === 'function') refreshAllVisibleUI();
  };

  function injectSettingsRow() {
    const account = document.getElementById('pg-account');
    const menu = account?.querySelector('.menu-sec');
    if (!menu || document.getElementById('storageHealthRow')) return;
    const row = document.createElement('div');
    row.className = 'mr';
    row.id = 'storageHealthRow';
    row.onclick = () => openStorageHealthModal();
    row.innerHTML = `<div class="ml">Storage Health</div><div class="ma"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6"/></svg></div>`;
    menu.appendChild(row);
  }

  const originalUpdateAccount = window.__wordjarOriginalUpdateAccountForStorageHealth || window.updateAccount;
  window.__wordjarOriginalUpdateAccountForStorageHealth = originalUpdateAccount;
  window.updateAccount = function updateAccountWithStorageHealth() {
    if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
    injectSettingsRow();
  };

  setTimeout(injectSettingsRow, 0);
  window.WordJarStorageHealth = { storageBreakdown, clearNonEssentialCaches, formatBytes };
})();
