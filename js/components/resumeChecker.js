/**
 * js/components/resumeChecker.js
 * ──────────────────────────────────────────────────────────
 * Handles the AI-powered Resume Checker feature.
 */

import { esc } from '../utils/helpers.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3001' : 'https://job-tracker-ooak.onrender.com';

// Local state for the resume checker modal
const checkerState = {
  open: false,
  status: 'idle', // 'idle' | 'loading' | 'error' | 'done'
  error: null,
  result: null,
  fileName: '',
  jobDesc: ''
};

export function getCheckerState() {
  return checkerState;
}

export function resetCheckerState() {
  checkerState.open = false;
  checkerState.status = 'idle';
  checkerState.error = null;
  checkerState.result = null;
  checkerState.fileName = '';
  checkerState.jobDesc = '';
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

export async function submitResumeCheck(file, jobDescription, onUpdate) {
  checkerState.status = 'loading';
  checkerState.fileName = file.name;
  checkerState.jobDesc = jobDescription;
  if (onUpdate) onUpdate();

  try {
    // Read file as base64
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is "data:application/pdf;base64,....."
        const base64Str = reader.result.split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    const res = await fetch(`${API_BASE}/api/check-resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeBase64: base64Data, jobDescription }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to check resume.');
    }

    checkerState.result = data.result;
    checkerState.status = 'done';
    if (onUpdate) onUpdate();
  } catch (err) {
    checkerState.error = err.message;
    checkerState.status = 'error';
    if (onUpdate) onUpdate();
  }
}

export function renderResumeCheckerModal() {
  const { status, error, result, jobDesc } = checkerState;

  let body = '';

  if (status === 'idle' || status === 'error') {
    body = `
      <div class="form-group">
        <label class="form-label" for="resume-job-desc">Target Job Description (Optional)</label>
        <textarea id="resume-job-desc" class="form-control" rows="4" placeholder="Paste a job description to tailor the feedback, or leave blank for a general ATS score..." style="resize:vertical">${esc(jobDesc)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="resume-file">Upload Resume (PDF)</label>
        <div id="resume-drop-zone" style="border: 2px dashed var(--border); border-radius: 8px; padding: 24px; text-align: center; background: #fafafa; margin-top: 4px; transition: all 0.2s;">
          <input type="file" id="resume-file" accept=".pdf" style="margin: 0 auto; display: block;">
          <p style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">Drag and drop a PDF here, or click to browse (Max 5MB).</p>
        </div>
      </div>
      ${status === 'error' ? `<div style="color:var(--red);margin-bottom:12px;font-size:13px">⚠ ${esc(error)}</div>` : ''}
      <div class="modal-footer" style="padding-top:16px;">
        <button class="btn btn-secondary" id="btn-close-resume-modal">Cancel</button>
        <button class="btn btn-primary" id="btn-submit-resume-check">✨ AI Analyze Match</button>
      </div>
    `;
  } else if (status === 'loading') {
    body = `
      <div style="text-align:center;padding:48px 0;">
        <div class="gmail-spinner"></div>
        <h3 style="margin-top:20px;font-size:15px;font-weight:600">AI is Analyzing...</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px">Comparing your skills against the job description.</p>
      </div>
    `;
  } else if (status === 'done') {
    body = `
      <div class="ai-result-box" style="background:#f9fafb;border-radius:6px;padding:20px;font-size:14px;line-height:1.6;border:1px solid #e5e7eb;max-height:400px;overflow-y:auto;">
        ${parseMarkdown(result)}
      </div>
      <div class="modal-footer" style="padding-top:16px;">
        <button class="btn btn-secondary" id="btn-reset-resume-check">Check Another</button>
        <button class="btn btn-primary" id="btn-close-resume-modal">Done</button>
      </div>
    `;
  }

  return `
    <div class="modal-header">
      <h2 class="modal-title"><span style="margin-right:8px">📄</span> AI Resume Checker</h2>
      <button class="modal-close" id="btn-close-resume-modal-x">&#x2715;</button>
    </div>
    <div class="modal-body">
      ${body}
    </div>
  `;
}
