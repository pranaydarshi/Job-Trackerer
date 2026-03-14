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
- **Keyboard shortcut**: press `Escape` to close any open modal

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

```
job-tracker/
│
├── index.html                  Entry point — app shell + modal containers
│
├── css/
│   └── styles.css              All styles: tokens, layout, components, responsive
│
└── js/
    ├── app.js                  Glue layer: subscribe → render, one-time event delegation
    │
    ├── constants/
    │   └── config.js           Platforms, statuses, badge classes, column defs, storage key
    │
    ├── state/
    │   └── store.js            State management — single source of truth, named actions
    │
    ├── utils/
    │   ├── helpers.js          Pure functions: generateId, formatDate, computeStats, filterJobs, sortJobs, esc
    │   └── storage.js          localStorage wrapper: loadJobs / saveJobs
    │
    └── components/
        ├── stats.js            Dashboard stat cards  (jobs) → HTML
        ├── filterBar.js        Search + filter bar   (filters, counts) → HTML
        ├── jobTable.js         Applications table    (jobs, filters) → HTML
        └── jobForm.js          Add/Edit modal + Delete confirm + validateJobForm + extractFormData
```

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
