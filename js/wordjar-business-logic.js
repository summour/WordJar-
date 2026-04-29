// WordJar Business Logic Bridge
// -----------------------------------------------------------------------------
// Purpose:
//   Bridge module that loads all business logic services and provides
//   a unified API for the application.
//
// Rules for this file:
//   1. Do not implement business logic here.
//   2. Load all service modules.
//   3. Provide backward compatibility API.
//   4. Expose functions through window.WordJarBusinessLogic for the current
//      non-module script architecture.
// -----------------------------------------------------------------------------

(function installWordJarBusinessLogic() {
  if (window.__wordjarBusinessLogicInstalled) return;
  window.__wordjarBusinessLogicInstalled = true;

  // Load utility modules
  if (!window.WordJarUtils) {
    const script = document.createElement('script');
    script.src = 'js/utils/common.js';
    script.async = false;
    document.head.appendChild(script);
  }

  if (!window.WordJarDataValidation) {
    const script = document.createElement('script');
    script.src = 'js/utils/data-validation.js';
    script.async = false;
    document.head.appendChild(script);
  }

  // Load service modules
  if (!window.WordJarScheduling) {
    const script = document.createElement('script');
    script.src = 'js/services/scheduling.js';
    script.async = false;
    document.head.appendChild(script);
  }

  if (!window.WordJarWordService) {
    const script = document.createElement('script');
    script.src = 'js/services/word-service.js';
    script.async = false;
    document.head.appendChild(script);
  }

  if (!window.WordJarStudyService) {
    const script = document.createElement('script');
    script.src = 'js/services/study-service.js';
    script.async = false;
    document.head.appendChild(script);
  }

  // Wait for modules to load, then expose unified API
  function exposeBusinessLogicAPI() {
    if (!window.WordJarUtils || !window.WordJarDataValidation ||
        !window.WordJarScheduling || !window.WordJarWordService ||
        !window.WordJarStudyService) {
      setTimeout(exposeBusinessLogicAPI, 10);
      return;
    }

    // Unified API for backward compatibility
    window.WordJarBusinessLogic = {
      // Constants
      DEFAULT_WORD_STATE: WordJarScheduling.DEFAULT_WORD_STATE,
      DEFAULT_PROFILE: WordJarDataValidation.normalizeProfile({}),

      // Utility functions
      todayISO: WordJarUtils.todayISO,
      dateKey: WordJarUtils.dateKey,
      normalizeText: WordJarUtils.normalizeText,
      normalizeWordKey: WordJarUtils.normalizeWordKey,
      normalizeId: WordJarUtils.normalizeId,
      detectWordLanguage: WordJarUtils.detectWordLanguage,
      getWordTypeString: WordJarUtils.getWordTypeString,

      // Validation functions
      validateWordInput: WordJarDataValidation.validateWordInput,
      findDuplicateWords: WordJarDataValidation.findDuplicateWords,
      hasDuplicateInDeck: WordJarDataValidation.hasDuplicateInDeck,
      buildWordData: WordJarDataValidation.buildWordData,
      normalizeProfile: WordJarDataValidation.normalizeProfile,
      normalizeWordJarData: WordJarDataValidation.normalizeWordJarData,

      // Scheduling functions
      applySm2Review: WordJarScheduling.applySm2Review,
      mutateSm2Review: WordJarScheduling.mutateSm2Review,
      isWordDue: WordJarScheduling.isWordDue,

      // Word management functions
      createWordRecord: WordJarWordService.createWordRecord,
      updateWordRecord: WordJarWordService.updateWordRecord,
      deleteWordById: WordJarWordService.deleteWordById,
      deleteWordsByIds: WordJarWordService.deleteWordsByIds,
      moveWordsToDeck: WordJarWordService.moveWordsToDeck,
      getDeckWords: WordJarWordService.getDeckWords,

      // Study functions
      getFlashcardQueue: WordJarStudyService.getFlashcardQueue,
      getFlashcardStats: WordJarStudyService.getFlashcardStats,
      buildLearnList: WordJarStudyService.buildLearnList,
      markStudied: WordJarStudyService.markStudied,
      calculateStreak: WordJarStudyService.calculateStreak
    };
  }

  setTimeout(exposeBusinessLogicAPI, 0);

  // Bridge functions for backward compatibility with existing app.js calls
  const MAX_BOOT_ATTEMPTS = 40;
  let bootAttempts = 0;

  function installBridgeFunctions() {
    if (!window.WordJarBusinessLogic) {
      bootAttempts += 1;
      if (bootAttempts < MAX_BOOT_ATTEMPTS) {
        setTimeout(installBridgeFunctions, 100);
      }
      return;
    }

    const logic = window.WordJarBusinessLogic;

    // Legacy bridge functions that patch existing app.js functions
    // These maintain backward compatibility while using the new service architecture

    /**
     * Mutating scheduler wrapper kept for old `sm2(w, q)` callers.
     */
    window.sm2 = function sm2BusinessWrapper(word, quality) {
      return logic.mutateSm2Review(word, quality);
    };

    /**
     * Due-card wrapper kept for old `isDue(w)` callers.
     */
    window.isDue = function isDueBusinessWrapper(word) {
      const currentDate = typeof today === 'function' ? today() : logic.todayISO();
      return logic.isWordDue(word, currentDate);
    };

    /**
     * Study streak wrapper kept for old `streak()` callers.
     */
    window.streak = function streakBusinessWrapper() {
      return logic.calculateStreak(D?.studyDays || {});
    };

    // Additional bridge functions can be added here as needed
  }

  setTimeout(installBridgeFunctions, 100);
})();
