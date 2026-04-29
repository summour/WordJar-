// WordJar Reader Clean Modal Size Fix V1
// Matches Reader Text Clean modal size with the rest of Settings modals.

(function installWordJarReaderCleanModalSizeFix() {
  if (window.__wordjarReaderCleanModalSizeFixInstalled) return;
  window.__wordjarReaderCleanModalSizeFixInstalled = true;

  const STYLE_ID = 'wordjarReaderCleanModalSizeFixStyle';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #readerCleanSettingsModal.reader-clean-modal-backdrop {
        padding: 20px;
      }

      #readerCleanSettingsModal .reader-clean-modal {
        width: min(100%, 400px);
        max-height: min(82vh, 640px);
        border-radius: 22px;
      }

      #readerCleanSettingsModal .reader-clean-modal-top {
        padding: 18px 18px 13px;
        gap: 12px;
      }

      #readerCleanSettingsModal .reader-clean-modal-title {
        font-size: 22px;
        line-height: 1.08;
      }

      #readerCleanSettingsModal .reader-clean-modal-sub {
        font-size: 12px;
        line-height: 1.38;
      }

      #readerCleanSettingsModal .reader-clean-close {
        width: 36px;
        height: 36px;
        min-width: 36px;
        font-size: 22px;
      }

      #readerCleanSettingsModal .reader-clean-modal-content {
        padding: 12px 14px 14px;
      }

      #readerCleanSettingsModal .reader-clean-row {
        min-height: 58px;
        padding: 11px 12px;
        gap: 12px;
      }

      #readerCleanSettingsModal .reader-clean-label {
        font-size: 13px;
        line-height: 1.22;
      }

      #readerCleanSettingsModal .reader-clean-note {
        font-size: 11px;
        line-height: 1.32;
      }

      #readerCleanSettingsModal .reader-clean-switch {
        width: 44px;
        height: 26px;
        min-width: 44px;
      }

      #readerCleanSettingsModal .reader-clean-switch:before {
        width: 18px;
        height: 18px;
      }

      #readerCleanSettingsModal .reader-clean-switch.on:before {
        transform: translateX(18px);
      }

      #readerCleanSettingsModal .reader-clean-preview {
        border-radius: 16px;
        padding: 11px 12px;
        font-size: 11px;
        line-height: 1.4;
      }

      @media (max-width: 420px) {
        #readerCleanSettingsModal.reader-clean-modal-backdrop {
          align-items: center;
          padding: 14px;
        }

        #readerCleanSettingsModal .reader-clean-modal {
          width: 100%;
          max-height: 84vh;
          border-radius: 22px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
  }

  boot();
  setTimeout(boot, 0);
  setTimeout(boot, 250);
})();
