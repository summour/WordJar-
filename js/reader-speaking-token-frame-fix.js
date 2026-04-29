// WordJar Reader Speaking Token Frame Fix V1
// Makes the currently spoken Reader word look like a soft rounded word frame.

(function installWordJarReaderSpeakingTokenFrameFix() {
  if (window.__wordjarReaderSpeakingTokenFrameFixInstalled) return;
  window.__wordjarReaderSpeakingTokenFrameFixInstalled = true;

  const STYLE_ID = 'wordjarReaderSpeakingTokenFrameFixStyle';

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #readerTokens .reader-token.wordjar-reader-speaking-token,
      #readerTokens .reader-token.wordjar-reader-mini-active {
        display: inline-block;
        padding: 3px 10px;
        margin: 0 2px;
        border-radius: 18px;
        background: #fafafa;
        box-shadow:
          0 0 0 1.5px #d8d8d8 inset,
          0 1px 2px rgba(0, 0, 0, 0.04);
        vertical-align: baseline;
        line-height: inherit;
      }

      #readerTokens .reader-token.wordjar-reader-paused-token {
        display: inline-block;
        padding: 3px 10px;
        margin: 0 2px;
        border-radius: 18px;
        background: #f7f7f7;
        box-shadow:
          0 0 0 1.5px #bdbdbd inset,
          0 1px 2px rgba(0, 0, 0, 0.05);
        vertical-align: baseline;
        line-height: inherit;
      }
    `;

    document.head.appendChild(style);
  }

  injectStyles();
  setTimeout(injectStyles, 0);
  setTimeout(injectStyles, 250);
})();
