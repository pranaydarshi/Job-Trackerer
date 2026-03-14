/**
 * js/components/gmailImport.js
 * ──────────────────────────────────────────────────────────
 * Gmail import modal component.
 *
 * Renders:
 *   • Connection status / connect button
 *   • Scanning progress
 *   • Results table with checkboxes for selective import
 */

import { esc } from '../utils/helpers.js';

const API_BASE = 'http://localhost:3001';

// ── State for the import flow ────────────────────────────

let importState = {
  open: false,
  status: 'idle',       // 'idle' | 'checking' | 'scanning' | 'done' | 'error'
  connected: false,
  jobs: [],
  selected: new Set(),
  error: null,
  totalEmails: 0,
  days: 30,
};

/** Get current import state (read-only). */
export function getImportState() {
  return importState;
}

/** Reset import state. */
export function resetImportState() {
  importState = {
    open: false,
    status: 'idle',
    connected: false,
    jobs: [],
    selected: new Set(),
    error: null,
    totalEmails: 0,
    days: 30,
  };
}

// ── API calls ────────────────────────────────────────────

/** Check if user has an active Gmail session. */
export async function checkGmailAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'include' });
    const data = await res.json();
    importState.connected = data.authenticated;
    return data.authenticated;
  } catch {
    importState.connected = false;
    return false;
  }
}

/** Redirect to Google OAuth consent screen. */
export function connectGmail() {
  window.location.href = `${API_BASE}/auth/google`;
}

/** Scan Gmail for job application emails. */
export async function scanEmails(days = 30, onUpdate) {
  importState.status = 'scanning';
  importState.error = null;
  importState.days = days;
  if (onUpdate) onUpdate();

  try {
    const res = await fetch(`${API_BASE}/api/scan-emails?days=${days}`, {
      credentials: 'include',
    });

    if (res.status === 401) {
      importState.connected = false;
      importState.status = 'error';
      importState.error = 'Gmail session expired. Please reconnect.';
      if (onUpdate) onUpdate();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to scan emails.');
    }

    const data = await res.json();
    importState.jobs = data.jobs || [];
    importState.totalEmails = data.totalEmails || 0;
    importState.selected = new Set(importState.jobs.map((_, i) => i)); // select all by default
    importState.status = 'done';
    if (onUpdate) onUpdate();
  } catch (err) {
    importState.status = 'error';
    importState.error = err.message;
    if (onUpdate) onUpdate();
  }
}

/** Disconnect Gmail (clear server session). */
export async function disconnectGmail() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch { /* ignore */ }
  importState.connected = false;
}

/** Toggle selection of a job by index. */
export function toggleJobSelection(index) {
  if (importState.selected.has(index)) {
    importState.selected.delete(index);
  } else {
    importState.selected.add(index);
  }
}

/** Toggle all job selections. */
export function toggleAllSelections() {
  if (importState.selected.size === importState.jobs.length) {
    importState.selected.clear();
  } else {
    importState.selected = new Set(importState.jobs.map((_, i) => i));
  }
}

/** Get the selected jobs ready for import. */
export function getSelectedJobs() {
  return importState.jobs.filter((_, i) => importState.selected.has(i)).map(job => {
    // Remove internal fields
    const { _emailId, _subject, ...cleanJob } = job;
    return cleanJob;
  });
}

// ── Render functions ─────────────────────────────────────

/**
 * Render the Gmail import modal content.
 * @returns {string} HTML string
 */
export function renderGmailImportModal() {
  const { status, connected, jobs, selected, error, totalEmails, days } = importState;

  let body;

  if (status === 'idle' || status === 'checking') {
    body = renderConnectStep(connected);
  } else if (status === 'scanning') {
    body = renderScanningStep();
  } else if (status === 'error') {
    body = renderErrorStep(error, connected);
  } else if (status === 'done') {
    body = renderResultsStep(jobs, selected, totalEmails, days);
  }

  return `
    <div class="modal-header">
      <h2 class="modal-title">
        <span style="margin-right:8px">📧</span> Import from Gmail
      </h2>
      <button class="modal-close" id="btn-close-gmail-modal">&#x2715;</button>
    </div>
    <div class="modal-body">
      ${body}
    </div>
  `;
}

function renderConnectStep(connected) {
  if (connected) {
    return `
      <div class="gmail-step">
        <div class="gmail-status gmail-status-connected">
          <span class="gmail-status-dot connected"></span>
          Gmail Connected
        </div>
        <p class="gmail-desc">
          Scan your inbox for job application confirmation emails from
          Naukri, LinkedIn, Indeed, Glassdoor, Foundit, Internshala, and more.
        </p>
        <div class="gmail-scan-options">
          <label class="form-label" for="gmail-days">Scan emails from last</label>
          <select class="form-control" id="gmail-days" style="width:auto;display:inline-block;margin:0 8px">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30" selected>30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
          </select>
        </div>
        <div class="modal-footer" style="padding:16px 0 0">
          <button class="btn btn-secondary" id="btn-gmail-disconnect">Disconnect</button>
          <button class="btn btn-primary" id="btn-gmail-scan">
            🔍 Scan Inbox
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="gmail-step" style="text-align:center;padding:32px 0">
      <div style="font-size:48px;margin-bottom:16px;opacity:0.85">📬</div>
      <h3 style="margin-bottom:8px;font-size:16px;font-weight:600">Connect your Gmail</h3>
      <p class="gmail-desc" style="max-width:380px;margin:0 auto 24px">
        We'll scan your inbox for job application emails from platforms like
        Naukri, LinkedIn, Indeed, and more. We only read email subjects and dates —
        <strong>no data is stored on any server</strong>.
      </p>
      <button class="btn btn-primary" id="btn-gmail-connect" style="padding:12px 28px;font-size:14px">
        <span style="margin-right:6px">🔗</span> Connect Gmail
      </button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:16px">
        Requires a Google account • Read-only access • You can disconnect anytime
      </p>
    </div>
  `;
}

function renderScanningStep() {
  return `
    <div class="gmail-step" style="text-align:center;padding:48px 0">
      <div class="gmail-spinner"></div>
      <h3 style="margin-top:20px;font-size:15px;font-weight:600">Scanning your inbox...</h3>
      <p class="gmail-desc">
        Looking for job application emails. This may take a moment.
      </p>
    </div>
  `;
}

function renderErrorStep(error, connected) {
  return `
    <div class="gmail-step" style="text-align:center;padding:32px 0">
      <div style="font-size:40px;margin-bottom:12px">⚠️</div>
      <h3 style="margin-bottom:8px;font-size:15px;font-weight:600;color:var(--red)">Something went wrong</h3>
      <p class="gmail-desc">${esc(error)}</p>
      <div class="modal-footer" style="padding:20px 0 0;justify-content:center">
        ${!connected
          ? '<button class="btn btn-primary" id="btn-gmail-connect">Reconnect Gmail</button>'
          : '<button class="btn btn-primary" id="btn-gmail-scan">Try Again</button>'
        }
        <button class="btn btn-secondary" id="btn-close-gmail-modal">Close</button>
      </div>
    </div>
  `;
}

function renderResultsStep(jobs, selected, totalEmails, days) {
  if (jobs.length === 0) {
    return `
      <div class="gmail-step" style="text-align:center;padding:32px 0">
        <div style="font-size:40px;margin-bottom:12px;opacity:0.5">📭</div>
        <h3 style="margin-bottom:8px;font-size:15px;font-weight:600">No applications found</h3>
        <p class="gmail-desc">
          No job application emails detected in the last ${days} days.
          Try increasing the time range or check if your application emails are in a different Gmail account.
        </p>
        <div class="modal-footer" style="padding:20px 0 0;justify-content:center">
          <button class="btn btn-secondary" id="btn-close-gmail-modal">Close</button>
          <button class="btn btn-primary" id="btn-gmail-scan">Scan Again</button>
        </div>
      </div>
    `;
  }

  const allSelected = selected.size === jobs.length;

  const rows = jobs.map((job, i) => `
    <tr>
      <td style="text-align:center">
        <input type="checkbox" class="gmail-job-check"
          data-index="${i}" ${selected.has(i) ? 'checked' : ''} />
      </td>
      <td>
        <div class="company-cell">
          <div class="company-name">${esc(job.company)}</div>
          <div class="role-name">${esc(job.role)}</div>
        </div>
      </td>
      <td><span class="badge badge-platform">${esc(job.platform)}</span></td>
      <td>${esc(job.appliedDate)}</td>
    </tr>
  `).join('');

  return `
    <div class="gmail-step">
      <div class="gmail-results-header">
        <span class="gmail-results-summary">
          Found <strong>${jobs.length}</strong> application${jobs.length !== 1 ? 's' : ''}
          from <strong>${totalEmails}</strong> emails (last ${days} days)
        </span>
      </div>

      <div class="gmail-results-table" style="max-height:360px;overflow-y:auto;margin:12px 0">
        <table class="jobs-table" style="font-size:13px">
          <thead>
            <tr>
              <th style="text-align:center;width:36px">
                <input type="checkbox" id="gmail-select-all"
                  ${allSelected ? 'checked' : ''} />
              </th>
              <th>Company / Role</th>
              <th>Platform</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="modal-footer" style="padding:12px 0 0">
        <span style="font-size:12px;color:var(--text-muted);margin-right:auto">
          ${selected.size} of ${jobs.length} selected
        </span>
        <button class="btn btn-secondary" id="btn-close-gmail-modal">Cancel</button>
        <button class="btn btn-primary" id="btn-gmail-do-import"
          ${selected.size === 0 ? 'disabled style="opacity:0.5;pointer-events:none"' : ''}>
          Import ${selected.size} Application${selected.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  `;
}
