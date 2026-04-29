// WordJar Deck Cards Performance V1
// Disabled intentionally.
//
// Reason:
// This file used to override renderDeckCards(), toggleCardSelection(), and viewDeckCards().
// Those same deck-card actions are now owned by js/autofill.js because that file also owns
// selected-card bulk actions: Delete, Fill, and Move.
//
// Keeping two runtime owners for the same functions caused unstable behavior: one script could
// silently replace the other depending on load order, making deck-card selection and action buttons
// appear broken.
//
// Do not add runtime overrides here. If pagination is needed later, merge it into the single
// deck-card owner in js/autofill.js instead.

window.__wordjarDeckCardsPerformanceDisabled = true;
