// WordJar Save Safety V5
// Local data must survive JSON imports, reloads, iOS page closes, and temporary storage pressure.
// This version also blocks accidental empty/sample startup saves from overwriting a larger local backup.

(function installSavePerformance() {
  if (window.__wordjarSavePerformanceInstalled) return;
  window.__wordjarSavePerformanceInstalled = true;

  const originalSave = window.save;
  const originalClearAll = window.clearAll;
  const DURABLE_BACKUP_KEY = `${SK}_last_good_local_backup`;
  const LAST_IMPORTED_BACKUP_KEY = `${SK}_last_imported_json_backup`;

  if (typeof originalSave !== 'function') return;

  function safeNow() {
    try { return new Date().toISOString(); }
    catch (err) { return String(Date.now()); }
  }

  function stampLocalChange(reason = 'local-save') {
    try {
      D.meta = D.meta || {};
      D.meta.updatedAt = safeNow();
      D.meta.updatedBy = reason;
    } catch (err) {}
  }

  function clearTransientStorage() {
    const clearableKeys = [
      'wordjar_reader_lookup_cache_v1',
      'wordjar_reader_quality_cache_v1'
    ];

    clearableKeys.forEach(key => localStorage.removeItem(key));

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('wordjar_reader_') && key !== 'wordjar_reader_note_v1') {
        localStorage.removeItem(key);
      }
    });
  }

  function writeLocalStorageWithRetry(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (firstError) {
      clearTransientStorage();
      localStorage.setItem(key, value);
      return true;
    }
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function countWords(data) {
    return Array.isArray(data?.words) ? data.words.length : 0;
  }

  function countDecks(data) {
    return Array.isArray(data?.decks) ? data.decks.length : 0;
  }

  function getUpdatedAtMs(data) {
    const value = data?.meta?.updatedAt || data?.exportedAt || data?.updatedAt || data?.updatedAtClient;
    const ms = value ? Date.parse(value) : 0;
    return Number.isFinite(ms) ? ms : 0;
  }

  function looksLikeWordJarData(data) {
    return !!data && typeof data === 'object' && Array.isArray(data.words);
  }

  function parsePossiblyStringified(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) throw new Error('Empty backup value');
    return JSON.parse(trimmed);
  }

  function extractWordJarData(parsed, depth = 0) {
    if (depth > 4) throw new Error('Backup nesting is too deep');
    const value = parsePossiblyStringified(parsed);

    if (!value || typeof value !== 'object') throw new Error('Invalid backup file');
    if (looksLikeWordJarData(value.data)) return value.data;
    if (looksLikeWordJarData(value)) return value;
    if (value[SK]) return extractWordJarData(value[SK], depth + 1);
    if (value.wordjar_v4) return extractWordJarData(value.wordjar_v4, depth + 1);
    if (value.localStorage?.[SK]) return extractWordJarData(value.localStorage[SK], depth + 1);
    if (value.storage?.[SK]) return extractWordJarData(value.storage[SK], depth + 1);

    if (Array.isArray(value.cards)) {
      return {
        ...value,
        words: value.cards,
        decks: Array.isArray(value.decks) ? value.decks : []
      };
    }

    throw new Error('This JSON does not contain WordJar words data');
  }

  function normalizeImportedWordJarData(parsed) {
    const data = extractWordJarData(parsed);
    const normalized = typeof normalizeWordJarData === 'function'
      ? normalizeWordJarData(data)
      : { ...data };

    if (!Array.isArray(normalized.words)) throw new Error('Invalid backup: words must be an array');
    if (!Array.isArray(normalized.decks)) normalized.decks = [];
    normalized.profile = normalized.profile || {};
    normalized.studyDays = normalized.studyDays || {};
    normalized.settings = normalized.settings || {};
    normalized.meta = normalized.meta || {};
    normalized.meta.updatedAt = safeNow();
    normalized.meta.updatedBy = 'json-import';
    return normalized;
  }

  window.normalizeWordJarImportedBackup = normalizeImportedWordJarData;

  function chooseRecoveryCandidate() {
    const mainData = readJSON(SK);
    const durableData = readJSON(DURABLE_BACKUP_KEY);
    const importedData = readJSON(LAST_IMPORTED_BACKUP_KEY);

    const candidates = [
      { source: 'main', data: mainData, priority: 1 },
      { source: 'last-good', data: durableData, priority: 2 },
      { source: 'last-imported-json', data: importedData, priority: 3 }
    ].filter(item => item.data && Array.isArray(item.data.words));

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const wordDiff = countWords(b.data) - countWords(a.data);
      if (wordDiff) return wordDiff;
      const deckDiff = countDecks(b.data) - countDecks(a.data);
      if (deckDiff) return deckDiff;
      const timeDiff = getUpdatedAtMs(b.data) - getUpdatedAtMs(a.data);
      if (timeDiff) return timeDiff;
      return b.priority - a.priority;
    });

    return candidates[0];
  }

  function shouldBlockEmptyOrSampleSave(reason) {
    const explicitReplaceReasons = new Set([
      'json-import',
      'cloud-load',
      'restore-last-good',
      'restore-last-imported-json',
      'restore-last-good-local-backup'
    ]);

    if (explicitReplaceReasons.has(reason)) return false;

    const currentWords = countWords(D);
    const best = chooseRecoveryCandidate();
    if (!best || best.source === 'main') return false;

    const bestWords = countWords(best.data);
    if (bestWords <= 0) return false;

    // Startup can briefly create the 3 demo cards or an empty state before late modules finish loading.
    // Do not let that state overwrite a larger last-good/imported backup.
    return currentWords === 0 || (currentWords <= 3 && bestWords > currentWords);
  }

  function applyRecoveredData(best, toastUser = false) {
    if (!best?.data) return false;
    D = best.data;
    if (typeof normalizeWordDeckIds === 'function') normalizeWordDeckIds();
    stampLocalChange(`restore-${best.source}`);

    const payload = JSON.stringify(D);
    writeLocalStorageWithRetry(SK, payload);
    try {
      localStorage.setItem(DURABLE_BACKUP_KEY, payload);
      if (best.source === 'last-imported-json') localStorage.setItem(LAST_IMPORTED_BACKUP_KEY, payload);
    } catch (err) {}

    if (typeof refreshAllVisibleUI === 'function') refreshAllVisibleUI();
    else {
      if (typeof updateHome === 'function') updateHome();
      if (typeof renderWords === 'function') renderWords();
      if (typeof renderDecks === 'function') renderDecks();
      if (typeof updateAccount === 'function') updateAccount();
    }

    if (toastUser && typeof toast === 'function') toast(`Restored ${countWords(D)} words from local backup`);
    return true;
  }

  function persistWordJarData(reason = 'local-save') {
    if (shouldBlockEmptyOrSampleSave(reason)) {
      const best = chooseRecoveryCandidate();
      if (applyRecoveredData(best, true)) return;
    }

    stampLocalChange(reason);

    const payload = JSON.stringify(D);
    writeLocalStorageWithRetry(SK, payload);

    const savedPayload = localStorage.getItem(SK);
    if (savedPayload !== payload) throw new Error('Local save verification failed');

    try {
      // Do not replace a larger last-good mirror with empty/demo startup data.
      const mirror = readJSON(DURABLE_BACKUP_KEY);
      const shouldUpdateMirror = countWords(D) > 0 && countWords(D) >= countWords(mirror);
      if (shouldUpdateMirror) localStorage.setItem(DURABLE_BACKUP_KEY, payload);
      if (reason === 'json-import' || reason === 'cloud-load') localStorage.setItem(LAST_IMPORTED_BACKUP_KEY, payload);
    } catch (mirrorError) {}
  }

  function restoreLastGoodBackupIfNeeded(toastUser = false) {
    const currentWords = countWords(D);
    const mainData = readJSON(SK);
    const mainWords = countWords(mainData);
    const best = chooseRecoveryCandidate();

    if (!best || best.source === 'main') return false;

    const bestWords = countWords(best.data);
    const shouldRestore =
      bestWords > Math.max(currentWords, mainWords) ||
      (best.source === 'last-imported-json' && bestWords > 0 && mainWords <= 3 && bestWords >= mainWords) ||
      (!mainData && bestWords > 0) ||
      (mainData && mainWords === 0 && bestWords > 0) ||
      (currentWords === 0 && bestWords > 0) ||
      (currentWords <= 3 && bestWords > currentWords);

    if (!shouldRestore) return false;
    return applyRecoveredData(best, toastUser);
  }

  window.flushWordJarSave = function flushWordJarSave() {
    persistWordJarData('flush-save');
  };

  window.save = function saveImmediate() {
    persistWordJarData('local-save');
  };

  window.restoreWordJarLocalBackup = function restoreWordJarLocalBackup() {
    return restoreLastGoodBackupIfNeeded(true);
  };

  window.handleJSONImport = function handleJSONImportDurable(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        const restored = normalizeImportedWordJarData(parsed);
        const restoredWordCount = countWords(restored);
        const restoredDeckCount = countDecks(restored);
        const currentWordCount = countWords(D);

        if (restoredWordCount === 0 && currentWordCount > 0) {
          const allowEmpty = confirm('This JSON backup has 0 words. Restoring it will erase the current local words. Continue?');
          if (!allowEmpty) return;
        }

        const confirmed = confirm(`Restore this JSON backup?\n\nWords: ${restoredWordCount}\nDecks: ${restoredDeckCount}\n\nThis will replace current local WordJar data.`);
        if (!confirmed) return;

        D = restored;
        if (typeof normalizeWordDeckIds === 'function') normalizeWordDeckIds();
        if (window.WordJarFSRS?.migrateAllCards) WordJarFSRS.migrateAllCards();
        if (window.WordJarAppIntegrity?.run) WordJarAppIntegrity.run({ silent: true });

        persistWordJarData('json-import');

        const verified = readJSON(SK);
        if (countWords(verified) !== countWords(D) || countDecks(verified) !== countDecks(D)) {
          throw new Error('Imported data was not written correctly');
        }

        if (typeof refreshAllVisibleUI === 'function') refreshAllVisibleUI();
        else {
          if (typeof updateHome === 'function') updateHome();
          if (typeof renderWords === 'function') renderWords();
          if (typeof renderDecks === 'function') renderDecks();
          if (typeof updateAccount === 'function') updateAccount();
        }

        toast(`JSON backup restored · ${countWords(D)} words saved locally`);
      } catch (err) {
        console.error('WordJar JSON import failed:', err);
        alert(`Import failed. No data was changed.\n\n${err?.message || 'Invalid WordJar JSON backup.'}`);
      } finally {
        if (event?.target) event.target.value = '';
      }
    };

    reader.onerror = () => {
      alert('Could not read this JSON file. No data was changed.');
      if (event?.target) event.target.value = '';
    };

    reader.readAsText(file, 'UTF-8');
  };

  if (typeof originalClearAll === 'function') {
    window.clearAll = function clearAllWithDurableCleanup() {
      const result = originalClearAll.apply(this, arguments);
      try {
        const mainData = readJSON(SK);
        if (!mainData || countWords(mainData) === 0) {
          localStorage.removeItem(DURABLE_BACKUP_KEY);
          localStorage.removeItem(LAST_IMPORTED_BACKUP_KEY);
        }
      } catch (err) {}
      return result;
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    try { persistWordJarData('page-hidden'); } catch (err) { console.warn('WordJar page-hidden save failed', err); }
  });

  window.addEventListener('pagehide', () => {
    try { persistWordJarData('page-hide'); } catch (err) { console.warn('WordJar page-hide save failed', err); }
  });

  window.addEventListener('pageshow', () => {
    try { restoreLastGoodBackupIfNeeded(true); } catch (err) { console.warn('WordJar pageshow restore failed', err); }
  });

  window.addEventListener('beforeunload', () => {
    try { persistWordJarData('before-unload'); } catch (err) { console.warn('WordJar before-unload save failed', err); }
  });

  setTimeout(() => restoreLastGoodBackupIfNeeded(true), 0);
  setTimeout(() => restoreLastGoodBackupIfNeeded(true), 1200);
})();
