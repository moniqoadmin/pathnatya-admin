# Pathnatya Admin

Web admin console for Pathnatya. Operators sign in with a phone number, then manage accounts, teams, and organisation details for the Pathnatya platform.

Built with React 19, TypeScript, Vite, and React Router. It talks to the Pathnatya backend over encrypted API payloads.

## Features

### Authentication

- **Two-step login** — enter a 10-digit phone number, then a password.
- **Phone check** — verifies the number exists before asking for a password.
- **First-time password setup** — if the account has no password yet, the operator is sent to Set Password. The password must be at least 6 characters, confirmed, and cannot be reset later from this flow.
- **Role gate** — only Admin, Super Admin, and Developer accounts can enter the console. User accounts are blocked with a clear error.
- **Rate-limit handling** — login shows a retry countdown on 429, and a busy-service message on 503.
- **Session persistence** — JWT and account profile are stored in local storage.
- **Device ID** — a stable browser device identifier is generated and sent with login and set-password requests.
- **Auto logout** — a 401 from the API clears the session and returns to login.
- **Public-route redirect** — already signed-in operators are sent to the dashboard.

### Layout and navigation

- Sidebar with Pathnatya branding, role-based nav, signed-in name, and logout.
- Mobile menu with hamburger toggle and backdrop.
- Nav items change by role (see [Roles](#roles-and-permissions)).

### Dashboard

- Signed-in profile: phone, role, status, sanchalak name, country, sanghat, jilha, taluka, group, kendra, and last login.

### Creation (Super Admin and Developer)

- **Create account** — add one account with:
  - Country extension (91 India, 44 UK, 1 US) and 10-digit mobile number
  - Role (User, Admin, Super Admin, Developer)
  - Sanchalak name
  - Country, sanghat, jilha, taluka, group, kendra
- **Bulk upload** — import many accounts from an Excel `.xlsx` file (nivedan / accounts template):
  - Max file size 20 MB
  - Background job with live progress (queued / processing / completed / failed)
  - Job survives closing the dialog; reopen Creation to continue watching
  - Summary of total, created, and failed rows
  - Paginated failed-row table (row, mobile, kendra, sanghat, error)
  - Download all failed rows as a CSV
  - Handles 413 (file too large), 429, and 503 from the import API

### List users

- Paginated account table (20 per page) with phone, name, role, status, sanghat, jilha, kendra, team count, logged-in team count, and last login.
- Search by phone number or kendra (debounced).
- Super Admin can filter by role (User, Admin, SuperAdmin, Developer). Search and role live in the URL so the view can be shared or refreshed.
- Click a row (or press Enter / Space) to open account details.
- Status pills for account status, or Online / Offline when status is missing.

### Account details

- Team overview: logged-in vs configured team count.
- Team cards with last login, reset password, and enable/disable login (with confirmation).
- Empty team slots listed as waiting to log in.
- Edit organisation fields (jilha, taluka, group, kendra).
- Toggles for **Offline** and **Logout button**.
- Super Admin and Developer also get **More details**:
  - Role, sanchalak name, country, sanghat
  - Number of teams, number of reboot, app configuration
  - Created / updated timestamps, account ID, metadata
  - Set a new account password (leave blank to keep the current one)
- Admins can edit flags; privileged fields (role, location, teams, password) are Super Admin / Developer only.

### Solutions

- Searchable help page of common Pathnatya account and team fixes.
- Each solution expands to a numbered list of steps.
- Content lives in `src/data/solutions.ts` and can be extended there.

### Security and API

- Requests send `X-App-Key` and `admin=true`.
- JSON bodies are encrypted (JWE, A256GCM) and responses are decrypted the same way.
- Bearer token on authenticated calls.
- Password fields have a show/hide toggle.

## Roles and permissions

| Role | Dashboard | List users | Creation | Solutions | Edit accounts | Privileged fields | Role filter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User | No access | No access | No access | No access | — | — | — |
| Admin | Yes | Yes | No | Yes | Yes | No | No |
| Super Admin | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Developer | Yes | Yes | Yes | Yes | Yes | Yes | No |

Privileged fields include role, sanchalak name, country, sanghat, number of teams, reboot count, app configuration, and account password.

## Getting started

**Requirements:** Node.js 20+ and npm.

```bash
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173). Sign in with an Admin, Super Admin, or Developer phone number.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview the production build |
| `npm start` | Serve the preview build on `0.0.0.0:3000` |
| `npm run lint` | Run Oxlint |

## Project structure

```
src/
  api/           Backend client, encrypted payloads, account endpoints
  components/    Layout, dialogs, account details, password input
  data/          Solutions content
  lib/           Session, roles, CSV export, device ID, error codes
  pages/         Login, set password, dashboard, creation, users, solutions
```

API base URL is configured in `src/api/config.ts`.
