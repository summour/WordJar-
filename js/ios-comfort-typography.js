// WordJar iOS Comfort Typography V1
// Softens option rows and dense controls for a calmer iOS-style reading experience.

(function installWordJarIOSComfortTypography() {
  if (window.__wordjarIOSComfortTypographyInstalled) return;
  window.__wordjarIOSComfortTypographyInstalled = true;

  const STYLE_ID = 'wordjarIOSComfortTypographyStyle';

  function injectStyles() {
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --wordjar-font-title: clamp(26px, 7vw, 34px);
        --wordjar-font-heading: clamp(20px, 5.4vw, 26px);
        --wordjar-font-row: clamp(15px, 4.1vw, 17px);
        --wordjar-font-caption: clamp(12px, 3.2vw, 14px);
      }

      .modal-card .mr,
      .modal-card .opt-row,
      .modal-card .deck-options-btn,
      .modal-card .wordjar-clean-option,
      .modal-card .wordjar-share-extra-option,
      .settings-card .mr,
      .settings-card .opt-row,
      .menu-sec .mr {
        font-weight: 500;
        letter-spacing: -0.015em;
      }

      .modal-card .ml,
      .modal-card .opt-label,
      .modal-card .deck-options-btn,
      .modal-card .wordjar-clean-option span,
      .modal-card .wordjar-share-extra-option span,
      .settings-card .ml,
      .settings-card .opt-label,
      .menu-sec .ml {
        font-weight: 500;
        font-size: var(--wordjar-font-row);
        line-height: 1.28;
      }

      .modal-card .sh-title,
      .deck-options-title,
      .settings-card-title,
      .ph-title,
      .home-title {
        letter-spacing: -0.035em;
        line-height: 1.08;
      }

      .modal-card .sh-title,
      .deck-options-title {
        font-weight: 700;
        font-size: var(--wordjar-font-heading);
      }

      .settings-card-title,
      .sec-lbl,
      .format-label,
      .modal-subtitle,
      .deck-options-subtitle,
      .wordjar-clean-modal-sub,
      .wordjar-user-level-help {
        font-weight: 500;
        line-height: 1.4;
      }

      .sec-lbl,
      .wordjar-share-section-label,
      .settings-card-title {
        letter-spacing: .08em;
      }

      .btn,
      .btn-s,
      .btn-p,
      .btn-full,
      button {
        letter-spacing: -0.015em;
      }

      .modal-card .btn,
      .modal-card .btn-s,
      .modal-card .btn-p,
      .wordjar-user-level-btn,
      #typePills .tp {
        font-weight: 600;
      }

      .wordjar-clean-option,
      .wordjar-share-extra-option,
      .opt-row,
      .mr {
        -webkit-tap-highlight-color: transparent;
      }

      .wordjar-clean-option:active,
      .wordjar-share-extra-option:active,
      .opt-row:active,
      .mr:active {
        background: rgba(0,0,0,.035);
      }

      .wen {
        font-weight: 700;
        letter-spacing: -0.025em;
      }

      .wth,
      .wpn,
      .format-label,
      .empty-sub {
        font-weight: 400;
        letter-spacing: -0.01em;
      }

      .tt {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: .015em;
      }
    `;

    document.head.appendChild(style);
  }

  injectStyles();
  setTimeout(injectStyles, 0);
  setTimeout(injectStyles, 500);
})();
