/**
 * js/utils/helpers.js
 * ──────────────────────────────────────────────────────────
 * Pure, side-effect-free utility functions. Every function
 * here takes inputs and returns a value — no DOM, no state.
 */

import { ACTIVE_STATUSES } from '../constants/config.js';

// ── ID generation ────────────────────────────────────────

/**
 * Generate a unique ID for a new job entry.
 * Uses Date.now() + a small random suffix for collision safety.
 *
 * @returns {string}  e.g. "jt_1718200000000_a3k9z"
 */
export function generateId() {
  return `jt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Date helpers ─────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format a YYYY-MM-DD date string into a human-readable label.
 *
 * @param   {string} dateStr  e.g. "2025-06-10"
 * @returns {string}          e.g. "Jun 10, 2025"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * Return a relative label like "Today", "1d ago", "14d ago".
 *
 * @param   {string} dateStr
 * @returns {string|null}
 */
export function getDaysAgo(dateStr) {
  if (!dateStr) return null;
  const applied = new Date(dateStr + 'T00:00:00');
  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - applied) / 86_400_000);
  if (diff < 0)  return 'Upcoming';
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}

// ── Stats calculation ─────────────────────────────────────

/**
 * Derive dashboard statistics from the full jobs array.
 *
 * @param   {Object[]} jobs
 * @returns {Object}
 */
export function computeStats(jobs) {
  const total      = jobs.length;
  const active     = jobs.filter(j => ACTIVE_STATUSES.has(j.status)).length;
  const interviews = jobs.filter(j =>
    ['Interview', 'Technical Round', 'HR Round'].includes(j.status)).length;
  const offers     = jobs.filter(j => j.status === 'Offer').length;
  const rejected   = jobs.filter(j => j.status === 'Rejected').length;

  // Response rate: company responded (moved beyond "Applied") / total
  const responded  = jobs.filter(j => j.status !== 'Applied' && j.status !== 'Withdrawn').length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  return { total, active, interviews, offers, rejected, responseRate };
}

// ── Filtering & sorting ───────────────────────────────────

/**
 * Filter a jobs array by search text, status, and platform.
 *
 * @param {Object[]} jobs
 * @param {Object}   filters  { search, status, platform }
 * @returns {Object[]}
 */
export function filterJobs(jobs, { search, status, platform }) {
  return jobs.filter(job => {
    if (search) {
      const q = search.toLowerCase();
      const hit =
        job.company.toLowerCase().includes(q) ||
        job.role.toLowerCase().includes(q)    ||
        (job.location || '').toLowerCase().includes(q) ||
        (job.notes    || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (status   && job.status   !== status)   return false;
    if (platform && job.platform !== platform) return false;
    return true;
  });
}

/**
 * Return a sorted copy of jobs (does not mutate the original).
 *
 * @param {Object[]} jobs
 * @param {string}   field   Property name to sort by
 * @param {string}   dir     'asc' | 'desc'
 * @returns {Object[]}
 */
export function sortJobs(jobs, field, dir) {
  return [...jobs].sort((a, b) => {
    const va = (a[field] ?? '').toString().toLowerCase();
    const vb = (b[field] ?? '').toString().toLowerCase();
    if (va < vb) return dir === 'asc' ? -1 :  1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}

// ── HTML safety ───────────────────────────────────────────

/**
 * Escape a string so it is safe to embed in innerHTML.
 *
 * @param   {*} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
