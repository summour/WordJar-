// WordJar Reader TTS Gloss Position Fix V3
// Positions the mini gloss above the currently spoken Reader token, like a compact subtitle dictionary bubble.

(function installWordJarReaderTTSGlossPositionFix() {
  if (window.__wordjarReaderTTSGlossPositionFixInstalledV3) return;
  window.__wordjarReaderTTSGlossPositionFixInstalledV3 = true;

  const STYLE_ID = 'wordjarReaderTTSGlossPositionStyleV3';
  const MINI_GLOSS_ID = 'wordjarReaderMiniGloss';
  const TTS_BUTTON_ID = 'wordjarReaderTTSButton';
  let pinTimer = null;
  let observer = null;

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #wordjarReaderMiniGloss.wordjar-reader-token-gloss {
        width: auto;
        min-width: 190px;
        max-width: min(340px, calc(100vw - 28px));
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 22px;
        background: rgba(28, 28, 31, 0.92);
        color: #ffffff;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        padding: 13px 16px 14px;
        pointer-events: none;
        transform: translateY(0) scale(1);
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss.open {
        transform: translateY(0) scale(1);
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss::after {
        content: "";
        position: absolute;
        left: var(--wordjar-gloss-arrow-left, 50%);
        bottom: -8px;
        width: 16px;
        height: 16px;
        background: rgba(28, 28, 31, 0.92);
        border-right: 1px solid rgba(255, 255, 255, 0.14);
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
        transform: translateX(-50%) rotate(45deg);
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss.wordjar-gloss-below::after {
        top: -8px;
        bottom: auto;
        border-right: 0;
        border-bottom: 0;
        border-left: 1px solid rgba(255, 255, 255, 0.14);
        border-top: 1px solid rgba(255, 255, 255, 0.14);
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-word {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 7px;
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-word b {
        color: #ffffff;
        font-size: 21px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-pron {
        color: rgba(255, 255, 255, 0.66);
        font-size: 13px;
        line-height: 1.2;
        font-weight: 700;
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-meaning {
        color: rgba(255, 255, 255, 0.95);
        font-size: 16px;
        line-height: 1.35;
        font-weight: 650;
      }

      #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-hint {
        display: none;
      }

      #readerTokens .reader-token.wordjar-reader-speaking-token,
      #readerTokens .reader-token.wordjar-reader-mini-active {
        background: rgba(18, 18, 18, 0.08);
        box-shadow: 0 0 0 1px rgba(18, 18, 18, 0.12) inset;
        border-radius: 7px;
      }

      @media (max-width: 430px) {
        #wordjarReaderMiniGloss.wordjar-reader-token-gloss {
          min-width: 172px;
          max-width: min(300px, calc(100vw - 22px));
          padding: 12px 14px 13px;
          border-radius: 20px;
        }

        #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-word b {
          font-size: 19px;
        }

        #wordjarReaderMiniGloss.wordjar-reader-token-gloss .wordjar-reader-mini-meaning {
          font-size: 15px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isReaderTTSActive() {
    const btn = document.getElementById(TTS_BUTTON_ID);
    return !!btn?.classList.contains('is-reading') ||
      !!btn?.classList.contains('is-paused') ||
      !!window.speechSynthesis?.speaking ||
      !!window.speechSynthesis?.paused;
  }

  function activeSpokenToken() {
    return document.querySelector('#readerTokens .reader-token.wordjar-reader-speaking-token') ||
      document.querySelector('#readerTokens .reader-token.wordjar-reader-mini-active');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function positionGlossNearToken(gloss, token) {
    if (!gloss || !token) return;

    gloss.classList.add('open', 'wordjar-reader-token-gloss');
    gloss.classList.remove('wordjar-gloss-below');

    const tokenRect = token.getBoundingClientRect();
    const glossRect = gloss.getBoundingClientRect();
    const gap = 14;
    const sidePad = 12;

    let left = tokenRect.left + tokenRect.width / 2 - glossRect.width / 2;
    left = clamp(left, sidePad, window.innerWidth - glossRect.width - sidePad);

    let top = tokenRect.top - glossRect.height - gap;
    if (top < 10) {
      top = tokenRect.bottom + gap;
      gloss.classList.add('wordjar-gloss-below');
    }

    const arrowLeft = clamp(
      tokenRect.left + tokenRect.width / 2 - left,
      22,
      glossRect.width - 22
    );

    gloss.style.left = `${left}px`;
    gloss.style.top = `${top}px`;
    gloss.style.setProperty('--wordjar-gloss-arrow-left', `${arrowLeft}px`);
  }

  function keepGlossPinnedToToken() {
    if (!isReaderTTSActive()) return;

    const token = activeSpokenToken();
    const gloss = document.getElementById(MINI_GLOSS_ID);
    if (!token || !gloss || !gloss.innerHTML.trim()) return;

    token.classList.add('wordjar-reader-mini-active');
    positionGlossNearToken(gloss, token);
  }

  function schedulePin() {
    clearTimeout(pinTimer);
    requestAnimationFrame(keepGlossPinnedToToken);
    pinTimer = setTimeout(keepGlossPinnedToToken, 70);
    setTimeout(keepGlossPinnedToToken, 160);
    setTimeout(keepGlossPinnedToToken, 300);
  }

  function startObserver() {
    if (observer) return;
    const tokens = document.getElementById('readerTokens');
    if (!tokens) return;

    observer = new MutationObserver(mutations => {
      const shouldPin = mutations.some(mutation => {
        const target = mutation.target;
        return target?.classList?.contains('reader-token') || target?.id === MINI_GLOSS_ID;
      });
      if (shouldPin) schedulePin();
    });

    observer.observe(tokens, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function bindEvents() {
    if (document.__wordjarReaderTTSGlossPinBoundV3) return;
    document.__wordjarReaderTTSGlossPinBoundV3 = true;

    document.addEventListener('scroll', schedulePin, true);
    window.addEventListener('resize', schedulePin);
    window.addEventListener('orientationchange', schedulePin);
  }

  function boot() {
    injectStyles();
    bindEvents();
    startObserver();
    schedulePin();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 300);
})();
