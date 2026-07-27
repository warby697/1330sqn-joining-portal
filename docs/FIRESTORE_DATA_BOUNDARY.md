# Joining portal Firestore boundary

The joining portal uses the existing `sqn-ops` Firebase project but does not read or write Squadron Ops collections.

Its collections are:

- `joiningPortalFamilies`
- `joiningPortalOpenNights`
- `joiningPortalMessages`
- `joiningPortalSettings`
- `joiningPortalTemporaryPaperwork`
- `joiningPortalRateLimits`

All database access is made by Netlify server functions using Firebase Admin. Firebase administrator credentials must never be included in the browser bundle.

The temporary paperwork collection is not part of the permanent recruitment record. Completed 3822 data must be deleted after the form has been delivered successfully. Failed and abandoned working copies require an automatic expiry policy.

Production requires `FIREBASE_SERVICE_ACCOUNT_BASE64`, containing a base64 encoded service account JSON file for the `sqn-ops` Firebase project. Local development may use Application Default Credentials.
