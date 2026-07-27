# Joining portal release checklist

Do not deploy until the user types `DEPLOY`.

## Completed checks

- Recruitment families, bookings, attendance, joining codes, staff notes, Open Night preparation, settings and email history use isolated Firestore collections.
- Staff records refresh from Firestore every five seconds and changes made on another device appear automatically.
- Parent return links use secure random tokens. Email return access uses a six-digit code which expires after 15 minutes.
- Staff access and settings changes are protected by the shared four-digit staff PIN.
- Completed 3822 data remains in session storage only. It is emailed as a PDF and must send successfully before the record can be completed.
- The completed-form recipient is selected server-side from the shared staff setting. A public browser cannot supply a different recipient.
- Immediate email functions use the staff-editable template once and return the delivered subject, body and provider ID for the family record.
- Scheduled reminders run hourly and suppress duplicate sends per family, cadet and template.
- Active applications are flagged in red 14 days after their intended start date. A single missed-intake alert is emailed to `1330squadronops@gmail.com`; staff review and remove records manually.
- Open Nights use 50 places as a planning figure. It is not a booking limit and does not block further registrations.
- Multi-cadet family records have separate staff controls for each cadet.
- The joining fee is £1 and the monthly Direct Debit is £1 for the approved limited live test.
- Both Signal invitation links respond with a valid Signal Group page.
- Lint, Vite production build and Netlify production build pass.
- Firestore contains no test families.

## Production configuration

Configured and verified on 26 July 2026:

- `FIREBASE_SERVICE_ACCOUNT_BASE64` is stored as an encrypted production function variable.
- `STAFF_PIN` is stored as an encrypted production function variable.
- Existing `RESEND_API_KEY`, `RESEND_FROM` and `GOCARDLESS_ACCESS_TOKEN` variables remain present and unchanged.
- The local function health check connected to the isolated `sqn-ops` Firestore project.

## Stabilisation pass (branch `stabilise-joining`, 27 July 2026)

- All recruitment saves are Firebase-authoritative: the UI waits for Firestore and shows an error on failure instead of continuing with an unsaved change. `write()` syncs only the family that changed (no more whole-list re-sync / stale overwrite).
- Interest submit, Open Night booking and attendance actions are locked against double taps.
- All emails render through one branded layout (`_email-layout.mjs`) with a prominent code box and real next-step buttons. Signal links are single-sourced in `src/lib/signalGroups.js`.
- Payments use a single browser tab (no second tab); GoCardless owns any bank/QR handover and returns to the same tab.
- `LOCAL_TEST_MODE` has been removed entirely, so validation cannot be disabled in production.
- Offline test suite added (`npm test`, Vitest + fake DB, 17 tests). Lint and Vite build pass.

## Must verify before opening to real families

1. **Firestore rules**: confirm the `joiningPortal*` collections are locked to server-only access (deny public client read/write) in the Firebase console. The public sqn-ops client config must not be able to read family PII or health data. HIGHEST PRIORITY.
2. **Netlify env**: `RESEND_API_KEY`, `RESEND_FROM`, `GOCARDLESS_ACCESS_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `STAFF_PIN` all present. `GOCARDLESS_API` is optional and defaults to live (leave unset for production).

## Controlled first live test (do with one real journey)

- Start the joining fee on a laptop, choose Monzo, scan the QR on a phone, approve, and confirm the laptop tab returns and advances to the subs step by itself with no leftover tab. Repeat for the monthly subs.
- Run the whole payment step on a phone only (single device) and confirm it returns and continues.
- Confirm the recurring subscription (not just a mandate) is created in GoCardless.
- Send one of each key email to yourself; check the code box and buttons render on phone and desktop (Gmail and Outlook).
- Complete one full journey end to end and confirm the record reaches Firestore and the "Ready to start" status holds.

## Final deployment

- Prices are £1/£1 for the controlled test. After the test passes, set the real prices as a separate, final deployment.
- Deploy only after the above, and only after the user types `DEPLOY`.
