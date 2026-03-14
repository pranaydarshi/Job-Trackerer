# Job Application Tracker

A clean, browser-based application to track all your job applications
across multiple platforms — no account, no server, no build step required.

---

## Features

- **Add, edit, delete** job applications with a clean modal form
- **Multi-platform tracking**: LinkedIn, Naukri, Indeed, Glassdoor, Company Website, Referral, AngelList, Internshala, Hirist, Wellfound, Other
- **Status pipeline**: Applied → Screening → Interview → Technical Round → HR Round → Offer / Rejected / Withdrawn
- **Dashboard stats**: Total, Active, Interviews, Offers, Rejected, Response Rate
- **Search & filter**: by keyword, status, or platform — all instant
- **Sort** by any column (click header to toggle asc/desc)
- **Persistent storage**: data saved in browser localStorage automatically
- **Toast notifications**: feedback on add / edit / delete actions
- **Gmail Integration**: Connect your Gmail account to securely scan your inbox for confirmation emails from major portals (Naukri, LinkedIn, Indeed, Glassdoor, etc.) and auto-import them into the dashboard.

---

## How to Run Locally

### 1. Run the Backend (Required for Gmail Import)
Navigate to the `server/` directory and create a `.env` file with your Google Cloud OAuth credentials (see `server/.env.example`).
```bash
cd server
npm install
node index.js
```
The backend API and Google OAuth handler will run on `http://localhost:3001`.

### 2. Run the Frontend UI
Because this project uses ES Modules (`type="module"`), it must be served via HTTP to avoid CORS restrictions on local files.
```bash
npx -y http-server -p 3000 -c-1
```
Open your browser to `http://127.0.0.1:3000` to view the app.

---

## How to Use

1. Open `index.html` directly in your browser (no server needed)
2. Click **Add Application** to log a new job
3. Fill in at least Company, Role, Platform, and Status (marked with `*`)
4. Use the filter bar to search or narrow down by status / platform
5. Click any column header to sort
6. Click **Edit** to update an application; **Delete** to remove it

---

## Project Structure

This project is divided into a lightweight vanilla HTML/JS frontend and a Node.js backend (which is only required for the Gmail integration).

```text
job-tracker/
│
├── index.html                  Entry point — app shell + modal containers
├── css/
│   └── styles.css              All styles: tokens, layout, components, responsive
├── js/
│   ├── app.js                  Glue layer: subscribe → render, one-time event delegation
│   ├── constants/
│   │   └── config.js           Platforms, statuses, badge classes, column defs, storage key
│   ├── state/
│   │   └── store.js            State management — single source of truth, named actions
│   ├── utils/
│   │   ├── helpers.js          Pure functions: generateId, formatDate, computeStats, filterJobs, sortJobs, esc
│   │   └── storage.js          localStorage wrapper: loadJobs / saveJobs
│   └── components/
│       ├── stats.js            Dashboard stat cards  (jobs) → HTML
│       ├── filterBar.js        Search + filter bar   (filters, counts) → HTML
│       ├── jobTable.js         Applications table    (jobs, filters) → HTML
│       ├── jobForm.js          Add/Edit modal + Delete confirm + validateJobForm + extractFormData
│       └── gmailImport.js      Gmail OAuth connection, email scanning, and parsing UI
│
└── server/                     (Backend for Gmail API)
    ├── package.json            Dependencies: express, googleapis, express-session, cors, dotenv
    ├── .env                    OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
    ├── index.js                Express server: /auth/google, /auth/status, /api/scan-emails
    └── emailParser.js          Regex patterns to parse Job Platform emails (Naukri, LinkedIn, etc.)
```

---

## Tech Stack (For AI Context)

### Frontend (Client-Side)
*   **Architecture:** Vanilla Single Page Application (SPA). No frameworks (React/Vue/Angular) and no build steps (Webpack/Vite).
*   **HTML5/CSS3:** Semantic HTML, Flexbox/Grid for layout, native CSS variables for centralized token management.
*   **JavaScript (ES6):** Pure native ES Modules.
*   **State Management:** Unidirectional data flow (similar to Redux). Events trigger `store.js` actions -> updates state -> calls `render()` -> pure functions generate new HTML strings -> inject via `innerHTML`.
*   **Event Handling:** Heavy use of **Event Delegation**. All click/input handlers live on the global `document` node in `app.js` to avoid re-attaching listeners after DOM updates.
*   **Storage:** Browser `localStorage`.

### Backend (Server-Side)
*   **Runtime:** Node.js + Express.js
*   **Authentication:** Google OAuth 2.0 via `googleapis`.
*   **Session Management:** `express-session` keeps access/refresh tokens in server memory, preventing token leakage to the frontend browser.
*   **CORS:** Configured to allow `http://localhost:3000` to hit backend endpoints (`http://localhost:3001`).

---

## Data Model

Each application is stored as a plain JSON object:

| Field         | Type   | Description                          |
|---------------|--------|--------------------------------------|
| `id`          | string | Unique identifier (auto-generated)   |
| `company`     | string | Company name *(required)*            |
| `role`        | string | Job title / role *(required)*        |
| `platform`    | string | Platform applied via *(required)*    |
| `status`      | string | Current status *(required)*          |
| `appliedDate` | string | YYYY-MM-DD — defaults to today       |
| `location`    | string | City / Remote / Hybrid               |
| `salary`      | string | Expected or offered CTC              |
| `link`        | string | URL to the job posting               |
| `notes`       | string | Free-text notes                      |

---

## Architecture Notes

- **No framework, no build step** — plain ES modules, works in any modern browser
- **Unidirectional data flow**: actions → store → render (like a mini Redux)
- **Event delegation**: all click/input/change handlers live on `document` — no re-attachment after re-renders
- **Component model**: each component is a pure function `(data) => HTML string`
- **localStorage key**: `jt_jobs_v1` — rename `STORAGE_KEY` in `config.js` if needed

---

## To Add a New Platform or Status

Open `js/constants/config.js` and add your entry to the `PLATFORMS` or `STATUSES` array.
Add a matching CSS class to `css/styles.css` (under the "Badges" section) for new statuses.
No other file needs to change.
