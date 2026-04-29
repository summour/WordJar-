// WordJar Common Utilities
// Shared utility functions used across the application

(function installWordJarUtils() {
  if (window.__wordjarUtilsInstalled) return;
  window.__wordjarUtilsInstalled = true;

  /**
   * Convert a Date-like value into a YYYY-MM-DD ISO date string.
   *
   * @param {Date|string|number} [date=new Date()]
   * @returns {string}
   */
  function todayISO(date = new Date()) {
    return new Date(date).toISOString().split('T')[0];
  }

  /**
   * Convert a Date-like value into the app's study-day key.
   *
   * @param {Date|string|number} [date=new Date()]
   * @returns {string}
   */
  function dateKey(date = new Date()) {
    return new Date(date).toDateString();
  }

  /**
   * Normalize any value into a trimmed string.
   *
   * @param {*} value
   * @returns {string}
   */
  function normalizeText(value) {
    return String(value ?? '').trim();
  }

  /**
   * Normalize a word for duplicate comparison.
   *
   * @param {*} value
   * @returns {string}
   */
  function normalizeWordKey(value) {
    return normalizeText(value).toLowerCase();
  }

  /**
   * Normalize ids before comparison.
   *
   * @param {*} value
   * @returns {string}
   */
  function normalizeId(value) {
    return String(value ?? '');
  }

  /**
   * Detect whether a word should be treated as Japanese or English.
   *
   * @param {string} word
   * @returns {'ja'|'en'}
   */
  function detectWordLanguage(word) {
    return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(word || '')) ? 'ja' : 'en';
  }

  /**
   * Convert selected word types into the app's stored comma-separated string.
   *
   * @param {Set<string>|string[]|string} types
   * @param {string} [fallback='N']
   * @returns {string}
   */
  function getWordTypeString(types, fallback = 'N') {
    if (types instanceof Set) {
      const value = Array.from(types).map(type => normalizeText(type).toUpperCase()).filter(Boolean).join(', ');
      return value || fallback;
    }

    if (Array.isArray(types)) {
      const value = types.map(type => normalizeText(type).toUpperCase()).filter(Boolean).join(', ');
      return value || fallback;
    }

    return normalizeText(types).toUpperCase() || fallback;
  }

  window.WordJarUtils = {
    todayISO,
    dateKey,
    normalizeText,
    normalizeWordKey,
    normalizeId,
    detectWordLanguage,
    getWordTypeString
  };
})();