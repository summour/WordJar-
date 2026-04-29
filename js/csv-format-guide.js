// WordJar CSV Format Guide V4
// Standard word field order: Word, Type, Pronunciation, Meaning, Synonyms, Example, Notes.

(function installCSVFormatGuide() {
  if (window.__wordjarCSVFormatGuideInstalledV4) return;
  window.__wordjarCSVFormatGuideInstalledV4 = true;

  const CSV_COLUMNS = [
    'Word',
    'Type',
    'Pronunciation',
    'Meaning',
    'Synonyms',
    'Example',
    'Notes',
    'Deck',
    'Language',
    'Starred',
    'Interval',
    'EaseFactor',
    'Reps',
    'NextReview',
    'AddedDate'
  ];

  function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function parseSynonyms(value) {
    const parts = Array.isArray(value) ? value : [value];
    return [...new Set(parts
      .flatMap(item => String(item || '').split(/[,;|/]+/))
      .map(item => item.trim())
      .filter(Boolean))];
  }

  function synonymsToCSV(value) {
    return parseSynonyms(value).join('; ');
  }

  function deckNameFor(deckId) {
    if (typeof isSystemNoDeckId === 'function' && isSystemNoDeckId(deckId)) return SYSTEM_NO_DECK_NAME || 'No Deck';
    const d = (D.decks || []).find(deck => String(deck.id) === String(deckId));
    return d ? d.name : '';
  }

  function langFor(word) {
    if (word.lang) return word.lang;
    return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(word.word || '')) ? 'ja' : 'en';
  }

  window.exportCSV = function exportCSVCurrent(filterDeckId) {
    const listToExport = filterDeckId
      ? (D.words || []).filter(w => String(w.deckId) === String(filterDeckId))
      : (D.words || []);

    if (!listToExport.length) return toast('No words to export');

    const rows = listToExport.map(w => [
      w.word || '',
      w.type || '',
      w.pronunciation || '',
      w.meaning || '',
      synonymsToCSV(w.synonyms || w.synonym || ''),
      w.example || '',
      w.notes || '',
      deckNameFor(w.deckId),
      langFor(w),
      w.starred ? '1' : '0',
      w.interval ?? w.scheduledDays ?? '',
      w.ef ?? '',
      w.reps ?? 0,
      w.nextReview || w.dueAt || '',
      w.addedDate || ''
    ].map(csvEscape));

    const csv = '\uFEFF' + [CSV_COLUMNS.map(csvEscape), ...rows].map(row => row.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'wordjar_export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Exported!');
  };

  window.makeImportedWord = function makeImportedWordCurrent(cols, targetDeckId, index) {
    const wordStr = String(cols[0] || '').trim();
    const meaning = String(cols[3] || '').trim();
    if (!wordStr || cols.length < 4) return null;

    const lang = String(cols[8] || '').trim() || (/[\u3040-\u30ff\u3400-\u9fff]/.test(wordStr) ? 'ja' : 'en');
    const interval = Number(cols[10] || 1) || 1;
    const ef = Number(cols[11] || 2.5) || 2.5;
    const reps = Number(cols[12] || 0) || 0;
    const nextReview = String(cols[13] || '').trim() || null;
    const addedDate = String(cols[14] || '').trim() || (typeof today === 'function' ? today() : new Date().toISOString().split('T')[0]);

    return {
      id: 'w' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 6),
      word: wordStr,
      type: cols[1] || 'N',
      pronunciation: cols[2] || '',
      meaning,
      synonyms: parseSynonyms(cols[4] || ''),
      example: cols[5] || '',
      notes: cols[6] || '',
      deckId: targetDeckId || (typeof SYSTEM_NO_DECK_ID !== 'undefined' ? SYSTEM_NO_DECK_ID : '__wordjar_system_no_deck__'),
      lang,
      starred: ['1', 'true', 'yes', 'y', 'starred'].includes(String(cols[9] || '').trim().toLowerCase()),
      addedDate,
      interval,
      scheduledDays: interval,
      reps,
      ef,
      nextReview,
      srsState: reps > 0 || nextReview ? 'review' : 'new',
      lapses: 0
    };
  };

  function updateCSVHelpText() {
    const account = document.getElementById('pg-account');
    if (!account) return;
    const labels = Array.from(account.querySelectorAll('.format-label'));
    const csvLabel = labels.find(el => /CSV Format/i.test(el.textContent || ''));
    if (!csvLabel) return;

    csvLabel.innerHTML = `
      <span style="font-weight:700; color:var(--ink);">CSV Format:</span><br>
      Required: <b>Word, Type, Pronunciation, Meaning</b><br>
      Optional order: Synonyms, Example, Notes<br>
      Synonyms can be separated with comma or semicolon.
    `;
  }

  const originalUpdateAccount = window.__wordjarOriginalUpdateAccountForCSVGuide || window.updateAccount;
  window.__wordjarOriginalUpdateAccountForCSVGuide = originalUpdateAccount;
  window.updateAccount = function updateAccountWithCSVGuide() {
    if (typeof originalUpdateAccount === 'function') originalUpdateAccount();
    updateCSVHelpText();
  };

  setTimeout(updateCSVHelpText, 0);
  window.WordJarCSVFormat = { columns: CSV_COLUMNS, updateCSVHelpText, parseSynonyms };
})();
