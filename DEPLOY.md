# Deploying AeroGrid to Zoho Catalyst

## Prerequisites
- Node.js 20+ and npm
- Zoho Catalyst CLI (`npm install -g zcatalyst-cli`)
- PostgreSQL / Neon PostGIS database with migrations `001`–`014` applied (`npm run migrate`)

## Environment Variable Names (configure in Catalyst Console — do not commit values)

### Backend Function (`functions/aerogrid_api`)
- `DATABASE_URL` — pooled PostgreSQL connection string used at runtime
- `DIRECT_URL` — direct (non-pooled) PostgreSQL connection string for running migrations
- `JWT_SECRET` — HS256 signing secret (minimum 32 characters; required in production)
- `NODE_ENV` — set to `production`
- `ALLOW_FALLBACK` — set to `false` in production
- `GOOGLE_CLIENT_ID` — Google OAuth 2.0 Web Client ID (required in production)
- `ADMIN_EMAILS` — comma-separated allowlist of emails granted the `admin` role on Google sign-in
- `CORS_ORIGIN` — hosted frontend origin(s) allowed by CORS (single origin or comma-separated)

### Frontend Client (`client/`, build-time Vite variables)
- `VITE_API_BASE` — base URL for the deployed `aerogrid_api` function (defaults to `/api` for same-origin hosting)
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth 2.0 Web Client ID for `@react-oauth/google`

## Deployment Steps

1. **Authenticate and select your Catalyst project:**
   ```bash
   catalyst login
   catalyst project:use
   ```

2. **Install function dependencies (self-contained inside `functions/aerogrid_api`):**
   ```bash
   cd functions/aerogrid_api && npm ci --omit=dev && cd ../..
   ```

3. **Set the backend environment variables** listed above on the `aerogrid_api` Advanced I/O function in the Zoho Catalyst Console (or via `catalyst deploy` environment configuration).

4. **Build the frontend client** with the hosted API base and Google Client ID:
   ```bash
   cd client
   npm ci
   VITE_API_BASE=<your-function-base-url> VITE_GOOGLE_CLIENT_ID=<your-google-client-id> npm run build
   cd ..
   ```

5. **Deploy the function (and client hosting if configured):**
   ```bash
   catalyst deploy --only functions:aerogrid_api
   # Or deploy both function and Catalyst Web Client Hosting:
   catalyst deploy
   ```

6. **Verify live deployment:**
   - Call `GET <function-base-url>/health` and confirm HTTP `200` with `database: "connected"` and `data_source: "database"`.
   - Open the hosted frontend URL, sign in via Google or email/password, and confirm the header/sidebar display your user name and role.
