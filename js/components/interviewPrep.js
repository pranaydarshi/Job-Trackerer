/**
 * js/components/interviewPrep.js
 * ──────────────────────────────────────────────────────────
 * Handles the AI-powered Interview Preparation feature.
 */

import { esc } from '../utils/helpers.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3001' : 'https://job-tracker-ooak.onrender.com';

// Local state for the interview prep modal
const prepState = {
  open: false,
  status: 'idle', // 'idle' | 'loading' | 'error' | 'done'
  error: null,
  result: null,
  role: '',
  company: ''
};

export function getPrepState() {
  return prepState;
}

export function resetPrepState() {
  prepState.open = false;
  prepState.status = 'idle';
  prepState.error = null;
  prepState.result = null;
  prepState.role = '';
  prepState.company = '';
}

// Very basic markdown to HTML for the AI output
function parseMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/<\/ul>\n<ul>/gim, ''); // join adjacent lists
  return html.replace(/\n/g, '<br/>');
}

export async function submitInterviewPrep(role, company, onUpdate) {
  prepState.status = 'loading';
  prepState.role = role;
  prepState.company = company;
  if (onUpdate) onUpdate();

  try {
    const res = await fetch(`${API_BASE}/api/prep-interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, company }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate prep guide.');
    }

    prepState.result = data.result;
    prepState.status = 'done';
    if (onUpdate) onUpdate();
  } catch (err) {
    prepState.error = err.message;
    prepState.status = 'error';
    if (onUpdate) onUpdate();
  }
}

export function renderInterviewPrepModal() {
  const { status, error, result, role, company } = prepState;

  let body = '';

  if (status === 'idle' || status === 'error') {
    body = `
      <div class="form-group">
        <label class="form-label" for="prep-role">Target Role</label>
        <input type="text" id="prep-role" class="form-control" placeholder="e.g. Senior Frontend Engineer" value="${esc(role)}">
      </div>
      <div class="form-group">
        <label class="form-label" for="prep-company">Target Company (Optional)</label>
        <input type="text" id="prep-company" class="form-control" placeholder="e.g. Stripe, AWS (leave blank for general prep)" value="${esc(company)}">
      </div>
      ${status === 'error' ? `<div style="color:var(--red);margin-bottom:12px;font-size:13px">⚠ ${esc(error)}</div>` : ''}
      <div class="modal-footer" style="padding-top:16px;">
        <button class="btn btn-secondary" id="btn-close-prep-modal">Cancel</button>
        <button class="btn btn-primary" id="btn-submit-prep">✨ Generate Guide</button>
      </div>
    `;
  } else if (status === 'loading') {
    body = `
      <div style="text-align:center;padding:48px 0;">
        <div class="gmail-spinner"></div>
        <h3 style="margin-top:20px;font-size:15px;font-weight:600">Generating Study Guide...</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px">Tailoring questions for ${esc(company)}.</p>
      </div>
    `;
  } else if (status === 'done') {
    body = `
      <div class="ai-result-box" style="background:#f9fafb;border-radius:6px;padding:20px;font-size:14px;line-height:1.6;border:1px solid #e5e7eb;max-height:400px;overflow-y:auto;">
        ${parseMarkdown(result)}
      </div>
      <div class="modal-footer" style="padding-top:16px;">
        <button class="btn btn-secondary" id="btn-reset-prep">Prep Another</button>
        <button class="btn btn-primary" id="btn-close-prep-modal">Done</button>
      </div>
    `;
  }

  return `
    <div class="modal-header">
      <h2 class="modal-title"><span style="margin-right:8px">🎯</span> AI Interview Prep</h2>
      <button class="modal-close" id="btn-close-prep-modal-x">&#x2715;</button>
    </div>
    <div class="modal-body">
      ${body}
    </div>
  `;
}
