/**
 * js/state/store.js
 * ──────────────────────────────────────────────────────────
 * Lightweight state container (no framework dependency).
 *
 * Architecture:
 *   • One immutable state object (replaced, never mutated)
 *   • Named action functions are the only way to change state
 *   • Subscribers (render functions) are notified after every change
 *
 * Usage:
 *   import { getState, subscribe, initStore, addJob } from './store.js';
 *   subscribe(state => renderApp(state));
 *   initStore();
 */

import { loadJobs, saveJobs }        from '../utils/storage.js';
import { filterJobs, sortJobs }       from '../utils/helpers.js';

// ── Initial state shape ──────────────────────────────────

const DEFAULT_FILTERS = {
  search:   '',
  status:   '',
  platform: '',
  sortBy:   'appliedDate',
  sortDir:  'desc',
};

let state = {
  jobs:    [],

  filters: { ...DEFAULT_FILTERS },

  modal: {
    open:   false,
    mode:   'add',     // 'add' | 'edit'
    editId: null,
    errors: {},
  },

  deleteConfirm: null,   // job id awaiting confirmation
};

// ── Subscribers ──────────────────────────────────────────

const listeners = new Set();

/** Register a callback that receives the new state after every change. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);  // returns unsubscribe function
}

function notify() {
  listeners.forEach(fn => fn(state));
}

function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

// ── Bootstrap ────────────────────────────────────────────

/** Load persisted jobs and trigger initial render. */
export function initStore() {
  state = { ...state, jobs: loadJobs() };
  notify();
}

/** Read-only access to the current state snapshot. */
export function getState() {
  return state;
}

// ── Derived data ─────────────────────────────────────────

/**
 * Return the filtered + sorted view of jobs based on
 * current filter settings. Used by the render layer.
 *
 * @returns {Object[]}
 */
export function getFilteredJobs() {
  const { jobs, filters } = state;
  const filtered = filterJobs(jobs, filters);
  return sortJobs(filtered, filters.sortBy, filters.sortDir);
}

// ── Job actions ──────────────────────────────────────────

/**
 * Persist a brand-new job (already has an id assigned).
 * Prepends to the list so the newest entry appears first.
 *
 * @param {Object} job
 */
export function addJob(job) {
  const jobs = [job, ...state.jobs];
  saveJobs(jobs);
  setState({ jobs });
  closeModal();
}

/**
 * Overwrite the fields of an existing job by id.
 *
 * @param {string} id
 * @param {Object} updates  Partial job fields
 */
export function updateJob(id, updates) {
  const jobs = state.jobs.map(j => j.id === id ? { ...j, ...updates } : j);
  saveJobs(jobs);
  setState({ jobs });
  closeModal();
}

/**
 * Permanently remove a job by id.
 *
 * @param {string} id
 */
export function deleteJob(id) {
  const jobs = state.jobs.filter(j => j.id !== id);
  saveJobs(jobs);
  setState({ jobs, deleteConfirm: null });
}

// ── Filter actions ───────────────────────────────────────

/** Update a single filter key. */
export function setFilter(key, value) {
  setState({ filters: { ...state.filters, [key]: value } });
}

/** Toggle sort direction if already sorting by this field; otherwise switch to it descending. */
export function setSort(field) {
  const { sortBy, sortDir } = state.filters;
  const newDir = (sortBy === field && sortDir === 'desc') ? 'asc' : 'desc';
  setState({ filters: { ...state.filters, sortBy: field, sortDir: newDir } });
}

/** Reset all filters to their defaults. */
export function clearFilters() {
  setState({ filters: { ...DEFAULT_FILTERS } });
}

// ── Modal actions ─────────────────────────────────────────

export function openAddModal() {
  setState({ modal: { open: true, mode: 'add', editId: null, errors: {} } });
}

export function openEditModal(id) {
  setState({ modal: { open: true, mode: 'edit', editId: id, errors: {} } });
}

export function closeModal() {
  setState({ modal: { open: false, mode: 'add', editId: null, errors: {} } });
}

/** Inject validation errors into the modal state (re-renders the form with error hints). */
export function setModalErrors(errors) {
  setState({ modal: { ...state.modal, errors } });
}

// ── Delete confirmation actions ───────────────────────────

export function confirmDelete(id) {
  setState({ deleteConfirm: id });
}

export function cancelDelete() {
  setState({ deleteConfirm: null });
}
