# BirrPulse

Smart money tracking for students, employees and business owners in Ethiopia. It reads supported bank/wallet SMS on the
phone, turns them into transactions, and adds budgets, savings goals, debts, bills, reports and a business workspace.

```
birrpulse/
  mobile/    React Native (Expo, TypeScript, Reanimated) - Android first, English + Amharic
    modules/birrpulse-sms/   Android native module: instant SMS capture + background task
  backend/   Go REST API + MongoDB (auth, email codes, sync, reports, push, parser config)
```

## What is in the box
| Feature | How it works |
|---|---|
| Instant SMS capture | An Android `BroadcastReceiver` (`modules/birrpulse-sms`) keeps allow-listed bank SMS the moment they arrive, even with the app closed, and wakes a headless JS task that parses them, stores the transaction and shows a notification. The app also re-scans the inbox on open and every 5 minutes. Duplicates are removed. |
| Parser templates from the server | `GET /api/v1/config/parsers` (public, cached, throttled to every 6 h). Banks, sender IDs and exact regex templates are validated on the phone, saved for offline use and pushed to the native receiver. Fix a changed bank format with one API call, no app release. |
| Email sign-in codes | `POST /auth/otp/request` and `/auth/otp/verify`: 6 digit code, HMAC-hashed, 5 min expiry, single use, 5 attempts, 60 s resend gap, 3 per 15 min. SMTP delivery. Password sign-in and guest mode still work. |
| Amharic | Full UI in English and አማርኛ (422 translations), switch in Profile, on sign-in and on the first onboarding slide. Dates, months and the currency follow the language. PDFs stay English. |
| Real push | Backend sends through Firebase Cloud Messaging HTTP v1 with a service account (no SDK). The app registers its FCM token after sign-in. Unregistered tokens are removed automatically. |
| Everything from the plan | Verified vs calculated balances, budgets with safe-to-spend, savings goals, debts (customers/suppliers in business mode), bills, reports and CSV/PDF export, sync, business workspace. |

## Run the backend
```bash
cd backend
cp .env.example .env            # set JWT_SECRET (openssl rand -hex 32); see the sections below
go mod tidy                     # first run: creates go.sum
docker compose up --build       # API + MongoDB on :8080  (needs ./secrets/fcm.json, an empty file is fine)
make seed                       # inserts the default bank list (run once)
go test ./...
```
In development leave `SMTP_HOST` empty: sign-in codes are printed in the server log instead of emailed.
In production set `APP_ENV=production` and the SMTP settings, otherwise email sign-in is disabled on purpose.

### Email (SMTP)
Any SMTP server works (Brevo, Mailgun, Amazon SES SMTP, Gmail with an app password, your own). Set `SMTP_HOST`,
`SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Credentials are only sent over TLS.

### Push (Firebase)
1. Create a Firebase project, add an Android app with package `com.birrpulse.app`.
2. Download `google-services.json` into `mobile/` (the app builds without it; push is then off).
3. Project settings > Service accounts > Generate new private key. Save it as `backend/secrets/fcm.json`
   (or set `FCM_CREDENTIALS_FILE` / `FCM_CREDENTIALS_JSON`). The server logs "Firebase Cloud Messaging enabled" on start.
4. Reminders for due bills and debts are then pushed even when the app is closed.

### Fixing bank formats without an app update
Set `ADMIN_TOKEN` (24+ characters) on the server, then:
```bash
API=https://your-api   # and export ADMIN_TOKEN
# 1. try a pattern against a real SMS (RE2 syntax, named groups: amount fee vat balance ref counterparty tail)
curl -X POST $API/api/v1/admin/parsers-test -H "X-Admin-Token: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"flags":"i","pattern":"debited with ETB\\s*(?<amount>[\\d,]+\\.\\d{2})","body":"...paste the SMS..."}'
# 2. publish it (see backend/examples/cbe-bank.json)
curl -X PUT $API/api/v1/admin/parsers/CBE -H "X-Admin-Token: $ADMIN_TOKEN" -H 'Content-Type: application/json' -d @backend/examples/cbe-bank.json
```
Phones pick the change up within 6 hours (or at once in Profile > Scan messages now). The example templates are
illustrations: confirm them against real messages before publishing.

## Run the mobile app
```bash
cd mobile
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL
npm run typecheck && npm run test:parser && npx tsx scripts/test-i18n.ts
npx expo start                  # Expo Go: every screen works; no real SMS, no push, no background capture
```
Real SMS, background capture and push need a development build on an Android phone:
```bash
npx expo run:android            # or: npx eas-cli build --profile development --platform android
```
After installing: grant the SMS permission in onboarding, then open Profile > Background capture and exempt BirrPulse
from battery optimisation (some phone brands otherwise stop the receiver).

## Status and honest limits
- **Verified here:** the mobile app type-checks, bundles for Android and passes its parser/template/translation tests;
  `expo prebuild` succeeds and the module is discovered by autolinking; the backend compiles, passes `go vet` and its
  unit tests (OTP, SMTP against a fake server, FCM against a fake Google, parser validation, sync validation).
- **Not verified here:** the Kotlin module has not been compiled or run (no Android SDK or device was available);
  nothing has run on a physical phone; the backend has not run against a live MongoDB, a real SMTP server or real Firebase.
  Expect a short fix-up round on first device test, mainly around the background task on different phone brands.
- **Bank SMS templates are illustrative.** Sender IDs and message shapes were not verified against real messages.
  Collect 15-30 anonymised samples per bank, add them to `scripts/test-parser.ts`, and publish templates through the admin API.
- **Amharic should be reviewed by a native speaker** before release; Gregorian dates are shown (no Ethiopian calendar yet).
- Google Play restricts SMS permissions (a permission declaration is required). Verify the current policy early;
  direct APK distribution and manual entry are the fallbacks.
- Remote templates run as JavaScript regexes on the phone. The server only accepts RE2-safe syntax and caps length,
  and only an admin can publish, but review templates before publishing.
- Local storage is a persisted Zustand store (fine for thousands of transactions). iOS cannot read SMS.
