# Invitation registration — go-live steps

Pages
- `/ix/<token>`      alumnus' personal invite (free entry, pre-order food)
- `/ix/g/<token>`    guest link the alumnus shares (₦10k entry + food, max 2 per alumnus)
- `/ix/done`         Paystack returns here; confirms the seat
- `/host/ix`         host panel: Invites · Room · Kitchen · Setup

Without Supabase settings the site runs in preview mode with dummy data
(try `/ix/demo`, `/ix/g/demo`, `/host/ix`).

## 1. Database
Restore the Supabase project, then in SQL Editor run, in order:
1. `migrations/20261104000000_edition_registration.sql`
2. `seed_dummy.sql` (dummy alumni + placeholder menu — replace via the host panel)

## 2. Paystack
Settings → API Keys & Webhooks:
- Webhook URL: `https://fhguzgtaxhytqftjprzq.supabase.co/functions/v1/paystack-webhook`
- Copy the **secret key** (test key first, live key once verified)

## 3. Edge Function secrets
```
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx \
  SITE_URL=https://maisondeslesnobles.com \
  HOST_EMAILS=you@example.com
supabase functions deploy registration registration-host paystack-webhook
```

## 4. Host login
Supabase → Authentication → Users → Add user (the email in HOST_EMAILS, with a password).

## 5. Test end-to-end with the Paystack test key
Paystack test card: 4084 0840 8408 4081 · any future expiry · CVV 408 · PIN 0000 · OTP 123456.
Then switch to the live key.
