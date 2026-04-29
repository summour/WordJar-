// WordJar Word Service
// Handles word CRUD operations and management

(function installWordJarWordService() {
  if (window.__wordjarWordServiceInstalled) return;
  window.__wordjarWordServiceInstalled = true;

  /**
   * Create a full new WordJar word/card record.
   *
   * @param {Object} [input={}]
   * @param {{now?: number, date?: Date|string|number, addedDate?: string}} [options={}]
   * @returns {WordJarWord}
   */
  function createWordRecord(input = {}, options = {}) {
    const now = options.now || Date.now();
    const addedDate = options.addedDate || WordJarUtils.todayISO(options.date || new Date());

    return {
      id: input.id || `w${now}`,
      ...WordJarDataValidation.buildWordData(input),
      starred: input.starred ?? WordJarScheduling.DEFAULT_WORD_STATE.starred,
      addedDate: input.addedDate || addedDate,
      interval: Number(input.interval || WordJarScheduling.DEFAULT_WORD_STATE.interval),
      reps: Number(input.reps || WordJarScheduling.DEFAULT_WORD_STATE.reps),
      ef: Number(input.ef || WordJarScheduling.DEFAULT_WORD_STATE.ef),
      nextReview: input.nextReview ?? WordJarScheduling.DEFAULT_WORD_STATE.nextReview
    };
  }

  /**
   * Return a copied words array with one word updated.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {string} wordId
   * @param {Object} [input={}]
   * @returns {{words: WordJarWord[], updated: boolean, data: Object}}
   */
  function updateWordRecord(words = [], wordId, input = {}) {
    const id = WordJarUtils.normalizeId(wordId);
    const data = WordJarDataValidation.buildWordData(input);
    let updated = false;

    const nextWords = words.map(item => {
      if (WordJarUtils.normalizeId(item?.id) !== id) return item;
      updated = true;
      return { ...item, ...data };
    });

    return { words: nextWords, updated, data };
  }

  /**
   * Delete one word by id.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {string} wordId
   * @returns {WordJarWord[]}
   */
  function deleteWordById(words = [], wordId) {
    const id = WordJarUtils.normalizeId(wordId);
    return words.filter(item => WordJarUtils.normalizeId(item?.id) !== id);
  }

  /**
   * Delete many words by id.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {Iterable<string|number>} [ids=[]]
   * @returns {WordJarWord[]}
   */
  function deleteWordsByIds(words = [], ids = []) {
    const selected = new Set(Array.from(ids).map(WordJarUtils.normalizeId));
    return words.filter(item => !selected.has(WordJarUtils.normalizeId(item?.id)));
  }

  /**
   * Move many words into another deck.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {Iterable<string|number>} [ids=[]]
   * @param {string} targetDeckId
   * @returns {{words: WordJarWord[], count: number}}
   */
  function moveWordsToDeck(words = [], ids = [], targetDeckId) {
    const selected = new Set(Array.from(ids).map(WordJarUtils.normalizeId));
    let count = 0;

    const nextWords = words.map(item => {
      if (!selected.has(WordJarUtils.normalizeId(item?.id))) return item;
      count += 1;
      return { ...item, deckId: targetDeckId };
    });

    return { words: nextWords, count };
  }

  /**
   * Get all words that belong to a deck.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {string} deckId
   * @returns {WordJarWord[]}
   */
  function getDeckWords(words = [], deckId) {
    const targetDeckId = WordJarUtils.normalizeId(deckId);
    return words.filter(item => WordJarUtils.normalizeId(item?.deckId) === targetDeckId);
  }

  window.WordJarWordService = {
    createWordRecord,
    updateWordRecord,
    deleteWordById,
    deleteWordsByIds,
    moveWordsToDeck,
    getDeckWords
  };
})();