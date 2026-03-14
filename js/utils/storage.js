/**
 * js/utils/storage.js
 * ──────────────────────────────────────────────────────────
 * Thin wrapper around localStorage so the rest of the app
 * never calls localStorage directly. Swap this module to use
 * IndexedDB or a remote API without touching anything else.
 */

import { STORAGE_KEY } from '../constants/config.js';

/**
 * Load the saved job list from localStorage.
 * Returns an empty array if nothing is stored or parsing fails.
 *
 * @returns {Object[]}
 */
export function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[storage] Failed to load jobs:', err);
    return [];
  }
}

/**
 * Persist the current job list to localStorage.
 *
 * @param {Object[]} jobs
 */
export function saveJobs(jobs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (err) {
    console.error('[storage] Failed to save jobs:', err);
  }
}
