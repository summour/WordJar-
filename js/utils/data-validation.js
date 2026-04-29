// WordJar Data Validation and Normalization Service
// Handles data validation, normalization, and type checking

(function installWordJarDataValidation() {
  if (window.__wordjarDataValidationInstalled) return;
  window.__wordjarDataValidationInstalled = true;

  /**
   * Validate the minimum fields needed to create or update a word.
   *
   * @param {{word?: string, meaning?: string, [key: string]: *}} [input={}]
   * @returns {ValidationResult}
   */
  function validateWordInput(input = {}) {
    const word = WordJarUtils.normalizeText(input.word);
    const meaning = WordJarUtils.normalizeText(input.meaning);

    if (!word || !meaning) {
      return {
        ok: false,
        message: 'Please fill in required fields',
        data: { ...input, word, meaning }
      };
    }

    return {
      ok: true,
      message: '',
      data: { ...input, word, meaning }
    };
  }

  /**
   * Find words that duplicate the given word text.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {string} word
   * @param {?string} [excludeId=null]
   * @returns {WordJarWord[]}
   */
  function findDuplicateWords(words = [], word, excludeId = null) {
    const key = WordJarUtils.normalizeWordKey(word);
    const excluded = WordJarUtils.normalizeId(excludeId);

    if (!key) return [];

    return words.filter(item => {
      const sameWord = WordJarUtils.normalizeWordKey(item?.word) === key;
      const sameId = excluded && WordJarUtils.normalizeId(item?.id) === excluded;
      return sameWord && !sameId;
    });
  }

  /**
   * Check whether a duplicate word already exists in a specific deck.
   *
   * @param {WordJarWord[]} [words=[]]
   * @param {string} word
   * @param {string} deckId
   * @param {?string} [excludeId=null]
   * @returns {boolean}
   */
  function hasDuplicateInDeck(words = [], word, deckId, excludeId = null) {
    const targetDeckId = WordJarUtils.normalizeId(deckId);
    return findDuplicateWords(words, word, excludeId).some(item => WordJarUtils.normalizeId(item?.deckId) === targetDeckId);
  }

  /**
   * Build the editable data part of a word record from form/API input.
   *
   * @param {Object} [input={}]
   * @returns {Pick<WordJarWord, 'word'|'meaning'|'type'|'deckId'|'lang'|'pronunciation'|'example'|'notes'>}
   */
  function buildWordData(input = {}) {
    const word = WordJarUtils.normalizeText(input.word);

    return {
      word,
      meaning: WordJarUtils.normalizeText(input.meaning),
      type: WordJarUtils.getWordTypeString(input.type || input.types || 'N'),
      deckId: input.deckId,
      lang: input.lang || WordJarUtils.detectWordLanguage(word),
      pronunciation: WordJarUtils.normalizeText(input.pronunciation),
      example: WordJarUtils.normalizeText(input.example),
      notes: WordJarUtils.normalizeText(input.notes)
    };
  }

  /**
   * Normalize a profile object after load/import.
   *
   * @param {Partial<WordJarProfile>} [profile={}]
   * @returns {WordJarProfile}
   */
  function normalizeProfile(profile = {}) {
    return {
      ...DEFAULT_PROFILE,
      id: profile.id || `wj-${Math.random().toString(36).slice(2, 8)}`,
      ...profile
    };
  }

  /**
   * Normalize imported/restored WordJar data into the expected app shape.
   *
   * @param {Partial<WordJarData>} [data={}]
   * @returns {WordJarData}
   */
  function normalizeWordJarData(data = {}) {
    return {
      words: Array.isArray(data.words) ? data.words : [],
      decks: Array.isArray(data.decks) ? data.decks : [],
      profile: normalizeProfile(data.profile),
      todayDone: Number(data.todayDone || 0),
      lastDate: data.lastDate || '',
      studyDays: data.studyDays && typeof data.studyDays === 'object' ? data.studyDays : {},
      reader: data.reader && typeof data.reader === 'object' ? data.reader : undefined
    };
  }

  window.WordJarDataValidation = {
    validateWordInput,
    findDuplicateWords,
    hasDuplicateInDeck,
    buildWordData,
    normalizeProfile,
    normalizeWordJarData
  };
})();