# WordJar Sync Implementation Plan

This document defines the safe implementation plan for adding backup and cross-device sync without replacing the existing WordJar app.

## Chosen Architecture

Use a local-first sync model.

- The existing `localStorage` data remains the main source of truth.
- The app must work without login.
- Users can export/import a full JSON backup manually.
- Optional Firebase Auth + Firestore cloud backup can be enabled later for cross-device use.
- Cloud sync is manual first: `Save to Cloud` and `Load from Cloud`.

This avoids accidental overwrites and keeps the current prototype simple.

## Data to Back Up

The JSON backup must include the full WordJar data object, not only words:

- `words`
- `decks`
- `profile`
- `todayDone`
- `lastDate`
- `studyDays`
- deck options
- voice settings
- spaced repetition fields such as `interval`, `reps`, `ef`, and `nextReview`

## GitHub Safety Rule

Do not push directly to `main` for this feature.

Implementation must happen on branch:

`feature/local-first-backup-sync`

Only merge after confirming that existing features are intact.

## UI Placement

Add the new controls under Account > Data Management, below the existing CSV import/export controls.

Recommended controls:

- Export JSON Backup
- Import JSON Restore
- Cloud Sync status
- Sign in with Google
- Sign out
- Save to Cloud
- Load from Cloud

## Firebase Setup Placeholder

Add a placeholder config in the script area:

```js
const FIREBASE_CONFIG = {
  apiKey: 'PASTE_API_KEY_HERE',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  appId: 'PASTE_APP_ID_HERE'
};
```

Cloud sync must stay disabled until real config values are inserted.

## Test Checklist

- Existing app loads.
- Dashboard still works.
- Decks still work.
- Dictionary still works.
- Add/edit/delete word still works.
- Study Mode still works.
- Flashcard review still works.
- TTS still works.
- CSV import/export still works.
- Export JSON downloads a complete backup file.
- Import JSON restores a backup only after confirmation.
- Invalid JSON does not break the app.
- Cloud sync shows a safe disabled state before Firebase setup.
- After Firebase setup, Save to Cloud and Load from Cloud require login.

## Non-Negotiable Rule

Do not replace `index.html` with a smaller version of the app. Only patch the existing app.
