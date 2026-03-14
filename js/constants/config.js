/**
 * js/constants/config.js
 * ──────────────────────────────────────────────────────────
 * All app-wide constants live here. To add a new platform or
 * status, update only this file — the rest of the app picks
 * up the change automatically.
 */

export const PLATFORMS = [
  'LinkedIn',
  'Naukri',
  'Indeed',
  'Glassdoor',
  'Company Website',
  'Referral',
  'AngelList',
  'Internshala',
  'Hirist',
  'Wellfound',
  'Other',
];

export const STATUSES = [
  'Applied',
  'Screening',
  'Interview',
  'Technical Round',
  'HR Round',
  'Offer',
  'Rejected',
  'Withdrawn',
];

/**
 * Maps each status to the CSS class used for the status badge.
 * The class names are defined in css/styles.css.
 */
export const STATUS_BADGE_CLASS = {
  'Applied':         's-applied',
  'Screening':       's-screening',
  'Interview':       's-interview',
  'Technical Round': 's-technical',
  'HR Round':        's-hr',
  'Offer':           's-offer',
  'Rejected':        's-rejected',
  'Withdrawn':       's-withdrawn',
};

/** Statuses that mean the application is still active / in-progress. */
export const ACTIVE_STATUSES = new Set([
  'Applied',
  'Screening',
  'Interview',
  'Technical Round',
  'HR Round',
]);

/** Column definitions for the jobs table. */
export const COLUMNS = [
  { field: 'company',     label: 'Company / Role',  sortable: true  },
  { field: 'platform',    label: 'Platform',         sortable: true  },
  { field: 'status',      label: 'Status',           sortable: true  },
  { field: 'appliedDate', label: 'Applied On',       sortable: true  },
  { field: 'location',    label: 'Location',         sortable: false },
  { field: 'salary',      label: 'Salary / CTC',     sortable: false },
  { field: null,          label: 'Actions',          sortable: false },
];

/** localStorage key for persisting job data. */
export const STORAGE_KEY = 'jt_jobs_v1';
