// WordJar Scheduling Service
// Handles spaced repetition scheduling using SM-2 algorithm

(function installWordJarScheduling() {
  if (window.__wordjarSchedulingInstalled) return;
  window.__wordjarSchedulingInstalled = true;

  /**
   * Default scheduling values for a newly created word/card.
   */
  const DEFAULT_WORD_STATE = Object.freeze({
    starred: false,
    interval: 1,
    reps: 0,
    ef: 2.5,
    nextReview: null
  });

  /**
   * Apply WordJar's current SM-2-style review rule and return a copied word.
   *
   * @param {WordJarWord} [word={}]
   * @param {0|3|4|5|number} quality
   * @param {{date?: Date|string|number}} [options={}]
   * @returns {WordJarWord}
   */
  function applySm2Review(word = {}, quality, options = {}) {
    const q = Number(quality);
    let interval = Number(word.interval || DEFAULT_WORD_STATE.interval);
    let reps = Number(word.reps || DEFAULT_WORD_STATE.reps);
    let ef = Number(word.ef || DEFAULT_WORD_STATE.ef);

    if (q === 0) {
      interval = 1;
      reps = 0;
    } else if (q === 3) {
      interval = Math.max(1, Math.round(interval * 1.2));
      ef = Math.max(1.3, ef - 0.15);
    } else if (q === 4) {
      interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(interval * ef);
      reps += 1;
    } else if (q === 5) {
      interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(interval * ef * 1.3);
      reps += 1;
      ef = Math.min(3, ef + 0.1);
    }

    const nextDate = new Date(options.date || new Date());
    nextDate.setDate(nextDate.getDate() + interval);

    return {
      ...word,
      interval,
      reps,
      ef: Number(ef.toFixed(2)),
      nextReview: WordJarUtils.todayISO(nextDate)
    };
  }

  /**
   * Apply the SM-2-style rule by mutating the existing word object.
   *
   * @param {WordJarWord} word
   * @param {0|3|4|5|number} quality
   * @param {{date?: Date|string|number}} [options={}]
   * @returns {WordJarWord|undefined|null}
   */
  function mutateSm2Review(word, quality, options = {}) {
    if (!word) return word;
    const reviewed = applySm2Review(word, quality, options);
    Object.assign(word, {
      interval: reviewed.interval,
      reps: reviewed.reps,
      ef: reviewed.ef,
      nextReview: reviewed.nextReview
    });
    return word;
  }

  /**
   * Check whether a word/card is due for review.
   *
   * @param {WordJarWord} [word={}]
   * @param {string} [currentDate=todayISO()]
   * @returns {boolean}
   */
  function isWordDue(word = {}, currentDate = WordJarUtils.todayISO()) {
    return !word.nextReview || String(word.nextReview) <= String(currentDate);
  }

  window.WordJarScheduling = {
    DEFAULT_WORD_STATE,
    applySm2Review,
    mutateSm2Review,
    isWordDue
  };
})();