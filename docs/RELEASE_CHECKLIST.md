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

## Deployment gate

Only after the manual configuration has been verified, and only after the user types `DEPLOY`, run the production deployment.
