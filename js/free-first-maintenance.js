// WordJar Free-first Maintenance V2
// Keeps the app local-first/free-friendly by limiting browser cache growth.
// No paid APIs, no background server dependency, no user data upload.

(function installFreeFirstMaintenance() {
  if (window.__wordjarFreeFirstMaintenanceInstalled) return;
  window.__wordjarFreeFirstMaintenanceInstalled = true;

  const CACHE_LIMITS = {
    wordjar_reader_lookup_cache_v1: 250,
    wordjar_reader_quality_cache_v1: 250
  };

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch {}
  }

  function trimObjectCache(key, limit) {
    const obj = readJSON(key);
    const entries = Object.entries(obj);
    if (entries.length <= limit) return false;

    const trimmed = Object.fromEntries(entries.slice(entries.length - limit));
    writeJSON(key, trimmed);
    return true;
  }

  function ensureArchive() {
    D.statsArchive = D.statsArchive || {};
    D.statsArchive.reviewLog = D.statsArchive.reviewLog || {
      totalReviews: 0,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
      firstReviewAt: '',
      lastArchivedAt: '',
      archivedBatches: 0
    };
    return D.statsArchive.reviewLog;
  }

  function archiveReviewLogs(logs) {
    if (!Array.isArray(logs) || !logs.length) return;
    const archive = ensureArchive();
    archive.totalReviews += logs.length;
    archive.archivedBatches += 1;

    logs.forEach(log => {
      const rating = String(log.rating || '').toLowerCase();
      if (rating === 'again') archive.again += 1;
      else if (rating === 'hard') archive.hard += 1;
      else if (rating === 'good') archive.good += 1;
      else if (rating === 'easy') archive.easy += 1;

      const date = log.reviewedAt || log.review || log.date || '';
      if (date && (!archive.firstReviewAt || String(date) < String(archive.firstReviewAt))) archive.firstReviewAt = date;
      if (date && (!archive.lastArchivedAt || String(date) > String(archive.lastArchivedAt))) archive.lastArchivedAt = date;
    });
  }

  function trimReviewLog() {
    if (!Array.isArray(D.reviewLog)) return false;
    const limit = 5000;
    const keepBuffer = 1000;
    const trimAt = limit + keepBuffer;
    if (D.reviewLog.length <= trimAt) return false;

    const keepFrom = D.reviewLog.length - limit;
    const archived = D.reviewLog.slice(0, keepFrom);
    archiveReviewLogs(archived);
    D.reviewLog = D.reviewLog.slice(keepFrom);
    save();
    return true;
  }

  function runMaintenance() {
    Object.entries(CACHE_LIMITS).forEach(([key, limit]) => trimObjectCache(key, limit));
    trimReviewLog();
  }

  function scheduleMaintenance() {
    if ('requestIdleCallback' in window) requestIdleCallback(runMaintenance, { timeout: 2500 });
    else setTimeout(runMaintenance, 1200);
  }

  window.WordJarFreeFirstMaintenance = {
    run: runMaintenance,
    trimObjectCache,
    trimReviewLog,
    archiveReviewLogs
  };

  scheduleMaintenance();
})();
