# Morey's Home Services — Nextdoor OAuth starter

This is a starter backend for the Nextdoor **Publishing API OAuth connection**. It creates a real callback endpoint after deployment. It does not pretend to have Nextdoor approval or enable search/automatic commenting by itself.

## What it does

- `/api/auth/start` sends the account owner to Nextdoor's authorization page.
- `/api/auth/callback` validates OAuth `state`, exchanges the authorization code, encrypts the returned token, and stores it in Supabase.
- `/api/status` reports whether a connection record exists without returning tokens.\n- `/api/login` protects the dashboard and connection actions with a password.
- Tokens are encrypted with AES-256-GCM before being written to Supabase.

## Important before deployment

1. You must have Nextdoor approval and the `client_id` and `client_secret` issued by Nextdoor.
2. The exact deployed callback URL must be submitted in the Nextdoor Publishing API request form and must match `NEXTDOOR_REDIRECT_URI`.
3. This starter uses the documented authorization URL, token endpoint, `authorization_code` grant, `comment:write` and `profile` scopes. Nextdoor may require changes to scopes or authentication details for your approved integration. Confirm those details against your approval instructions.
4. This does **not** implement the Displaying/Search API. That uses a separate API access flow and client-credentials token as documented by Nextdoor.
5. This does **not** automatically post comments. Add that only after Nextdoor approves the integration and you have confirmed the allowed use case, endpoints, profile selection and content policies.

## 1. Create Supabase storage

1. Create a project at https://supabase.com/.
2. Open **SQL Editor**.
3. Run the contents of `supabase/schema.sql`.
4. In Supabase project settings, copy the Project URL and the `service_role` key. Keep the service-role key private.

## 2. Create Vercel project

1. Create an account at https://vercel.com/.
2. Put this project folder in a private GitHub repository, then import that repository into Vercel. (Do not commit `.env` files or credentials.)
3. Deploy once. Vercel will assign a URL such as `https://your-project.vercel.app`.
4. Your callback URL will be:

   `https://your-project.vercel.app/api/auth/callback`

5. Submit that exact callback URL to Nextdoor. Do not submit the example URL from this README.

## 3. Configure Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add:

- `APP_BASE_URL` — your deployed Vercel URL.
- `NEXTDOOR_CLIENT_ID` — provided by Nextdoor after approval.
- `NEXTDOOR_CLIENT_SECRET` — provided by Nextdoor after approval.
- `NEXTDOOR_REDIRECT_URI` — exact callback URL submitted to Nextdoor.
- `NEXTDOOR_SCOPES` — start with `openid comment:write profile` unless Nextdoor tells you otherwise.
- `SUPABASE_URL` — your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key.
- `TOKEN_ENCRYPTION_KEY_BASE64` — generate using the command below.
- `APP_PASSWORD` — a strong, unique password for the private dashboard.\n- `AUTH_SESSION_SECRET` — a separate long random secret for the admin session cookie.\n- `OAUTH_STATE_SECRET` — a separate long random secret.

Generate the encryption key locally with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generate the state secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not send these secrets to anyone or put them in source code.

## 4. Deploy again and submit the Redirect URI

After environment variables are added, redeploy. Submit the deployed callback URL to Nextdoor:

`https://YOUR-VERCEL-PROJECT.vercel.app/api/auth/callback`

The URL must match exactly, including path and HTTPS.

## 5. Connect

After Nextdoor has approved the application and issued credentials:

1. Open your deployed Vercel URL.
2. Tap **Connect Nextdoor account**.
3. Sign in to the intended Nextdoor account.
4. Review and approve the requested permissions.
5. Log in to the Morey’s dashboard, then tap Connect Nextdoor account.\n6. You should return to a confirmation page.
7. The dashboard should show **Nextdoor authorization saved**.

## 6. Security notes

- Keep the GitHub repository private.
- Never put secrets in `index.html` or other browser-side code.
- Never share the Supabase service-role key, Nextdoor client secret, access token, refresh token or encryption key.
- Restrict access to the Vercel and Supabase dashboards with strong passwords and MFA.
- If a credential is exposed, rotate it with the provider.
- The admin session cookie is HttpOnly, Secure and SameSite=Lax, and expires after seven days.\n- The OAuth state cookie is short-lived (10 minutes), HttpOnly, Secure and SameSite=Lax.
- This starter stores one connection record for the Morey's primary account.

## Next development phase

After Nextdoor approves both APIs, the next phase should implement:
- Displaying API token acquisition and public-post search using the exact approved Search API endpoint and scopes.
- Profile lookup/selection using Nextdoor's `/me/profiles` endpoint.
- A lead review queue with duplicate prevention and relevance checks.
- Comment drafting and an approval-first publish flow using `comment:write`.
- Audit logging and per-post rate limits.

Do not switch on automatic posting until Nextdoor confirms the integration's permitted use and the test flow is verified.
