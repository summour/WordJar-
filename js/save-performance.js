// WordJar Save Safety V3
// Local data must survive API quota issues, reloads, and iOS page closes.
// Saves immediately to the main key, keeps a last-good local mirror, and verifies writes.

(function installSavePerformance() {
  if (window.__wordjarSavePerformanceInstalled) return;
  window.__wordjarSavePerformanceInstalled = true;

  const originalSave = window.save;
  const originalHandleJSONImport = window.handleJSONImport;
  const originalClearAll = window.clearAll;
  const DURABLE_BACKUP_KEY = `${SK}_last_good_local_backup`;

  if (typeof originalSave !== 'function') return;

  function stampLocalChange(reason = 'local-save') {
    try {
      D.meta = D.meta || {};
      D.meta.updatedAt = new Date().toISOString();
      D.meta.updatedBy = reason;
    } catch (err) {
      // D is not ready yet. Let the save flow continue.
    }
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

  function persistWordJarData(reason = 'local-save') {
    stampLocalChange(reason);

    const payload = JSON.stringify(D);
    writeLocalStorageWithRetry(SK, payload);

    const savedPayload = localStorage.getItem(SK);
    if (savedPayload !== payload) {
      throw new Error('Local save verification failed');
    }

    try {
      localStorage.setItem(DURABLE_BACKUP_KEY, payload);
    } catch (mirrorError) {
      // The main app save already succeeded. The mirror is best-effort only.
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

  function restoreLastGoodBackupIfNeeded() {
    const mainData = readJSON(SK);
    const mirrorData = readJSON(DURABLE_BACKUP_KEY);

    if (!mirrorData) return;

    const currentWordCount = countWords(D);
    const mainWordCount = countWords(mainData);
    const mirrorWordCount = countWords(mirrorData);

    if (mirrorWordCount > Math.max(currentWordCount, mainWordCount)) {
      D = mirrorData;
      if (typeof normalizeWordDeckIds === 'function') normalizeWordDeckIds();
      persistWordJarData('restore-last-good-local-backup');

      if (typeof refreshAllVisibleUI === 'function') refreshAllVisibleUI();
      else {
        if (typeof updateHome === 'function') updateHome();
        if (typeof renderWords === 'function') renderWords();
        if (typeof renderDecks === 'function') renderDecks();
        if (typeof updateAccount === 'function') updateAccount();
      }

      if (typeof toast === 'function') toast('Restored local backup');
    }
  }

  window.flushWordJarSave = function flushWordJarSave() {
    persistWordJarData('flush-save');
  };

  window.save = function saveImmediate() {
    persistWordJarData('local-save');
  };

  window.handleJSONImport = function handleJSONImportDurable(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        const restored = normalizeWordJarData(parsed.data || parsed);

        if (!Array.isArray(restored.words) || !Array.isArray(restored.decks)) {
          throw new Error('Invalid structure');
        }

        const confirmed = confirm('Restore this JSON backup? This will replace current local WordJar data.');
        if (!confirmed) return;

        D = restored;
        if (typeof normalizeWordDeckIds === 'function') normalizeWordDeckIds();
        if (window.WordJarFSRS?.migrateAllCards) WordJarFSRS.migrateAllCards();
        if (window.WordJarAppIntegrity?.run) WordJarAppIntegrity.run({ silent: true });

        persistWordJarData('json-import');

        const verified = readJSON(SK);
        if (countWords(verified) !== countWords(D)) {
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
        alert('Import failed or could not be saved locally. No data was changed. Try Export JSON again, then clear temporary caches from Storage Health.');
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
        if (!mainData || countWords(mainData) === 0) localStorage.removeItem(DURABLE_BACKUP_KEY);
      } catch (err) {}
      return result;
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistWordJarData('page-hidden');
  });

  window.addEventListener('pagehide', () => persistWordJarData('page-hide'));
  window.addEventListener('beforeunload', () => persistWordJarData('before-unload'));

  setTimeout(restoreLastGoodBackupIfNeeded, 0);
})();
