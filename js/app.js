/**
 * js/app.js
 * ──────────────────────────────────────────────────────────
 * Application entry point.
 *
 * Responsibilities:
 *   1. Subscribe the render function to state changes
 *   2. Bootstrap the store (loads persisted jobs)
 *   3. Set up ALL event listeners exactly once via delegation
 *
 * No UI logic lives here — components handle rendering,
 * the store handles state. This file is only the glue.
 */

// ── State layer ───────────────────────────────────────────
import {
  initStore, getState, getFilteredJobs, subscribe,
  openAddModal, openEditModal, closeModal,
  addJob, updateJob, deleteJob,
  setFilter, setSort, clearFilters,
  confirmDelete, cancelDelete,
  setModalErrors,
} from './state/store.js';

// ── Components ────────────────────────────────────────────
import { renderStats }       from './components/stats.js';
import { renderFilterBar }   from './components/filterBar.js';
import { renderJobTable }    from './components/jobTable.js';
import {
  renderJobForm, renderDeleteConfirm,
  validateJobForm, extractFormData,
} from './components/jobForm.js';
import {
  renderGmailImportModal, checkGmailAuth, connectGmail,
  scanEmails, disconnectGmail, getImportState, resetImportState,
  toggleJobSelection, toggleAllSelections, getSelectedJobs,
} from './components/gmailImport.js';
import { renderResumeCheckerModal, getCheckerState, resetCheckerState, submitResumeCheck } from './components/resumeChecker.js';
import { renderInterviewPrepModal, getPrepState, resetPrepState, submitInterviewPrep } from './components/interviewPrep.js';

// ── Utilities ─────────────────────────────────────────────
import { generateId } from './utils/helpers.js';
import { exportJobsToCSV } from './utils/export.js';

// ── Persistent DOM references ─────────────────────────────
// These elements are always in the DOM (they never get replaced).
const statsEl        = document.getElementById('stats-container');
const filterEl       = document.getElementById('filter-container');
const tableEl        = document.getElementById('table-container');
const modalOverlay   = document.getElementById('modal-overlay');
const modalEl        = document.getElementById('job-modal');
const deleteOverlay  = document.getElementById('delete-overlay');
const deleteEl       = document.getElementById('delete-modal');
const gmailOverlay   = document.getElementById('gmail-overlay');
const gmailEl        = document.getElementById('gmail-modal');
const resumeOverlay  = document.getElementById('resume-overlay');
const resumeEl       = document.getElementById('resume-modal');
const prepOverlay    = document.getElementById('prep-overlay');
const prepEl         = document.getElementById('prep-modal');

// ── Toast helper ──────────────────────────────────────────

let toastTimer;

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Render ────────────────────────────────────────────────

/**
 * Called every time state changes.
 * Rebuilds the UI from the current state snapshot.
 *
 * @param {Object} state  Current state from the store
 */
function render(state) {
  const { jobs, filters, modal, deleteConfirm } = state;
  const filteredJobs = getFilteredJobs();

  // Stats cards
  statsEl.innerHTML = renderStats(jobs);

  // Filter bar
  filterEl.innerHTML = renderFilterBar(filters, jobs.length, filteredJobs.length);

  // Jobs table
  tableEl.innerHTML = renderJobTable(filteredJobs, filters);

  // Add/Edit modal
  if (modal.open) {
    const editingJob = modal.mode === 'edit'
      ? jobs.find(j => j.id === modal.editId) ?? null
      : null;
    modalEl.innerHTML    = renderJobForm(editingJob, modal.errors);
    modalOverlay.style.display = 'flex';
  } else {
    modalOverlay.style.display = 'none';
  }

  // Delete confirmation modal
  if (deleteConfirm) {
    const job = jobs.find(j => j.id === deleteConfirm) ?? null;
    deleteEl.innerHTML        = renderDeleteConfirm(job);
    deleteOverlay.style.display = 'flex';
  } else {
    deleteOverlay.style.display = 'none';
  }
}

// ── Save handler ──────────────────────────────────────────

function handleSaveJob() {
  const btn      = document.getElementById('btn-save-job');
  const formData = extractFormData(modalEl);
  const errors   = validateJobForm(formData);

  // If validation fails, push errors into state → triggers re-render with error hints
  if (Object.keys(errors).length > 0) {
    setModalErrors(errors);
    return;
  }

  if (btn.dataset.mode === 'edit') {
    updateJob(btn.dataset.id, formData);
    showToast('Application updated.');
  } else {
    addJob({ id: generateId(), ...formData });
    showToast('Application added.');
  }
}

// ── Event delegation ──────────────────────────────────────
//
// All click, input, and change events are handled from the
// document root — no re-attachment needed after re-renders.

document.addEventListener('click', e => {
  const t  = e.target;
  const id = t.dataset?.id;

  // Header
  if (t.id === 'btn-add-job') { openAddModal(); return; }
  if (t.id === 'btn-gmail-import') { openGmailModal(); return; }
  if (t.id === 'btn-ai-resume') { openResumeModal(); return; }
  if (t.id === 'btn-ai-prep') { openPrepModal(); return; }
  
  if (t.id === 'btn-export-csv') { 
    const currentJobs = getFilteredJobs();
    if (currentJobs.length === 0) {
      showToast('No jobs to export.');
      return;
    }
    exportJobsToCSV(currentJobs);
    showToast(`Exported ${currentJobs.length} application(s) to CSV!`);
    return;
  }

  // Table: sort and row actions
  if (t.dataset?.sort)                 { setSort(t.dataset.sort); return; }
  if (t.dataset?.action === 'edit')    { openEditModal(id);       return; }
  if (t.dataset?.action === 'delete')  { confirmDelete(id);       return; }

  // Add/Edit modal
  if (t.id === 'btn-close-modal'  ) { closeModal(); return; }
  if (t.id === 'btn-cancel-modal' ) { closeModal(); return; }
  if (t.id === 'btn-save-job'     ) { handleSaveJob(); return; }

  // Delete modal
  if (t.id === 'btn-close-delete'   ) { cancelDelete();    return; }
  if (t.id === 'btn-cancel-delete'  ) { cancelDelete();    return; }
  if (t.id === 'btn-confirm-delete' ) { deleteJob(id); showToast('Application deleted.'); return; }

  // Filter bar
  if (t.id === 'btn-clear-filters') { clearFilters(); return; }

  // Gmail import modal
  if (t.id === 'btn-gmail-connect') { connectGmail(); return; }
  if (t.id === 'btn-gmail-disconnect') { handleGmailDisconnect(); return; }
  if (t.id === 'btn-gmail-scan') { handleGmailScan(); return; }
  if (t.id === 'btn-gmail-do-import') { handleGmailBulkImport(); return; }
  if (t.id === 'btn-close-gmail-modal') { closeGmailModal(); return; }
  if (t.id === 'gmail-select-all') { toggleAllSelections(); renderGmailModal(); return; }
  if (t.classList?.contains('gmail-job-check')) {
    toggleJobSelection(Number(t.dataset.index));
    renderGmailModal();
    return;
  }

  // Resume Checker Modal
  if (t.id === 'btn-close-resume-modal' || t.id === 'btn-close-resume-modal-x') { closeResumeModal(); return; }
  if (t.id === 'btn-reset-resume-check') { resetCheckerState(); renderResumeModal(); return; }
  if (t.id === 'btn-submit-resume-check') {
    const fileInput = document.getElementById('resume-file');
    const jDesc = document.getElementById('resume-job-desc').value.trim();
    const file = fileInput?.files[0];
    
    if (!file) { showToast('Please select a PDF file first.'); return; }
    if (file.type !== 'application/pdf') { showToast('Please upload a valid PDF file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('File is too large. Max 5MB allowed.'); return; }
    
    submitResumeCheck(file, jDesc, renderResumeModal);
    return;
  }

  // Interview Prep Modal
  if (t.id === 'btn-close-prep-modal' || t.id === 'btn-close-prep-modal-x') { closePrepModal(); return; }
  if (t.id === 'btn-reset-prep') { resetPrepState(); renderPrepModal(); return; }
  if (t.id === 'btn-submit-prep') {
    const role = document.getElementById('prep-role').value.trim();
    const company = document.getElementById('prep-company').value.trim();
    if (!role || !company) { showToast('Please enter both role and company.'); return; }
    submitInterviewPrep(role, company, renderPrepModal);
    return;
  }

  // Close modals when clicking the dim overlay backdrop directly
  if (t.id === 'modal-overlay' ) { closeModal();    return; }
  if (t.id === 'delete-overlay') { cancelDelete();  return; }
  if (t.id === 'gmail-overlay' ) { closeGmailModal(); return; }
  if (t.id === 'resume-overlay') { closeResumeModal(); return; }
  if (t.id === 'prep-overlay'  ) { closePrepModal(); return; }
});

// Search input (debounced)
let searchTimer;
document.addEventListener('input', e => {
  if (e.target.id !== 'search-input') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => setFilter('search', e.target.value), 180);
});

// Select dropdowns
document.addEventListener('change', e => {
  if (e.target.id === 'status-filter')   { setFilter('status',   e.target.value); return; }
  if (e.target.id === 'platform-filter') { setFilter('platform', e.target.value); return; }
});

// Close modals with Escape key
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (getImportState().open)         { closeGmailModal(); return; }
  if (getState().modal.open)         { closeModal();      return; }
  if (getState().deleteConfirm)      { cancelDelete();    return; }
});

// ── Bootstrap ─────────────────────────────────────────────
subscribe(render);
initStore();   // loads localStorage → triggers first render

// ── Gmail import helpers ──────────────────────────────────

function renderGmailModal() {
  gmailEl.innerHTML = renderGmailImportModal();
  gmailOverlay.style.display = 'flex';
}

async function openGmailModal() {
  const state = getImportState();
  state.open = true;
  state.status = 'checking';
  renderGmailModal();

  const connected = await checkGmailAuth();
  state.status = 'idle';
  renderGmailModal();
}

function closeGmailModal() {
  gmailOverlay.style.display = 'none';
  resetImportState();
}

async function handleGmailScan() {
  const daysEl = document.getElementById('gmail-days');
  const days = daysEl ? Number(daysEl.value) : 30;
  await scanEmails(days, renderGmailModal);
}

async function handleGmailDisconnect() {
  await disconnectGmail();
  const state = getImportState();
  state.status = 'idle';
  renderGmailModal();
  showToast('Gmail disconnected.');
}

function handleGmailBulkImport() {
  const jobs = getSelectedJobs();
  if (jobs.length === 0) return;

  for (const job of jobs) {
    addJob({ id: generateId(), ...job });
  }

  showToast(`Imported ${jobs.length} application${jobs.length !== 1 ? 's' : ''} from Gmail.`);
  closeGmailModal();
}

// Auto-check for Gmail OAuth redirect
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('gmail_connected') === '1') {
  // Clean up the URL
  window.history.replaceState({}, '', window.location.pathname);
  // Auto-open the Gmail modal
  setTimeout(() => openGmailModal(), 300);
}

// ── AI Tools helpers ──────────────────────────────────────

function renderResumeModal() {
  resumeEl.innerHTML = renderResumeCheckerModal();
  resumeOverlay.style.display = 'flex';
}

function openResumeModal() {
  const state = getCheckerState();
  state.open = true;
  state.status = 'idle';
  renderResumeModal();
}

function closeResumeModal() {
  resumeOverlay.style.display = 'none';
  resetCheckerState();
}

function renderPrepModal() {
  prepEl.innerHTML = renderInterviewPrepModal();
  prepOverlay.style.display = 'flex';
}

function openPrepModal() {
  const state = getPrepState();
  state.open = true;
  state.status = 'idle';
  renderPrepModal();
}

function closePrepModal() {
  prepOverlay.style.display = 'none';
  resetPrepState();
}
