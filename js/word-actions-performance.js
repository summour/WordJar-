// WordJar Word Actions Performance V1
// Avoids full Dictionary rerender when toggling a single star.

(function installWordActionsPerformance() {
  if (window.__wordjarWordActionsPerformanceInstalled) return;
  window.__wordjarWordActionsPerformanceInstalled = true;

  function findWord(id) {
    return (D.words || []).find(w => String(w.id) === String(id));
  }

  function safeSelector(value) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
  }

  function updateVisibleStarButton(id, on) {
    const row = document.querySelector(`#wordList .wr[onclick*="${safeSelector(id)}"]`);
    if (!row) return false;

    const btn = row.querySelector('.star-btn');
    if (!btn) return false;

    btn.classList.toggle('on', !!on);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', on ? 'currentColor' : 'none');
    return true;
  }

  window.toggleStar = function toggleStarFast(id) {
    const w = findWord(id);
    if (!w) return;

    w.starred = !w.starred;
    if (window.WordJarDictionaryPerformance?.clearCache) WordJarDictionaryPerformance.clearCache();
    save();

    const onlyStarred = !!(wordFilters && wordFilters.starred);
    const updated = updateVisibleStarButton(id, w.starred);

    if (!updated || onlyStarred) {
      if (typeof renderWords === 'function') renderWords();
    }
  };
})();
