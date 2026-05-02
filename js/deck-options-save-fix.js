// Fix deck Learning Settings numeric save/load behavior.
// Keeps deck option keys compatible with the FSRS scheduler.
(function installDeckOptionsSaveFix() {
  function defaults() {
    return {
      newPerDay: 25,
      revPerDay: 999,
      ignoreRev: false,
      limitsTop: false,
      learnSteps: '1m 10m',
      insertOrder: 'seq',
      reLearnSteps: '10m',
      leechThresh: 8,
      leechAction: 'tag'
    };
  }

  function readNumber(id, fallback) {
    const input = document.getElementById(id);
    const value = Number.parseInt(input?.value, 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }

  function setInputChecked(id, value) {
    const input = document.getElementById(id);
    if (input) input.checked = !!value;
  }

  window.openDeckOptionsModal = function openDeckOptionsModal(id) {
    const d = D.decks.find(x => String(x.id) === String(id));
    if (!d) return;

    editDeckId = id;
    const opt = { ...defaults(), ...(d.options || {}) };

    document.getElementById('optDeckTitle').textContent = `Options: ${d.name}`;
    setInputValue('optNewPerDay', opt.newPerDay ?? 25);
    setInputValue('optRevPerDay', opt.revPerDay ?? 999);
    setInputChecked('optIgnoreRev', opt.ignoreRev);
    setInputChecked('optLimitsTop', opt.limitsTop);
    setInputValue('optLearnSteps', opt.learnSteps || '1m 10m');
    setInputValue('optOrder', opt.insertOrder || 'seq');
    setInputValue('optReLearnSteps', opt.reLearnSteps || '10m');
    setInputValue('optLeechThresh', opt.leechThresh ?? 8);
    setInputValue('optLeechAction', opt.leechAction || 'tag');
    openO('deckOptionsModal');
  };

  window.saveDeckOptions = function saveDeckOptions() {
    const d = D.decks.find(x => String(x.id) === String(editDeckId));
    if (!d) return;

    const prev = { ...defaults(), ...(d.options || {}) };
    d.options = {
      ...prev,
      newPerDay: readNumber('optNewPerDay', prev.newPerDay),
      revPerDay: readNumber('optRevPerDay', prev.revPerDay),
      ignoreRev: !!document.getElementById('optIgnoreRev')?.checked,
      limitsTop: !!document.getElementById('optLimitsTop')?.checked,
      learnSteps: document.getElementById('optLearnSteps')?.value.trim() || prev.learnSteps,
      insertOrder: document.getElementById('optOrder')?.value || prev.insertOrder,
      reLearnSteps: document.getElementById('optReLearnSteps')?.value.trim() || prev.reLearnSteps,
      leechThresh: readNumber('optLeechThresh', prev.leechThresh),
      leechAction: document.getElementById('optLeechAction')?.value || prev.leechAction
    };

    save();
    closeO('deckOptionsModal');

    if (currentStudyDeckId && String(currentStudyDeckId) === String(editDeckId) && typeof showDeckOverview === 'function') {
      showDeckOverview(editDeckId);
    }

    if (typeof renderDecks === 'function') renderDecks();
    toast('Settings saved');
  };
})();
