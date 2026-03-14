/**
 * js/components/jobForm.js
 * ──────────────────────────────────────────────────────────
 * Renders:
 *   • renderJobForm()    — Add / Edit modal
 *   • renderDeleteConfirm() — Delete confirmation modal
 *
 * Also exports:
 *   • validateJobForm()  — Returns an errors object
 *   • extractFormData()  — Reads all field values from the modal DOM
 */

import { PLATFORMS, STATUSES } from '../constants/config.js';
import { esc } from '../utils/helpers.js';

// ── Field builder ─────────────────────────────────────────

/**
 * Build a form-group block (label + input/select/textarea + optional error).
 *
 * @param {Object} opts
 * @param {string}   opts.id
 * @param {string}   opts.label
 * @param {boolean}  [opts.required=false]
 * @param {string}   [opts.type='text']        text | date | url | select | textarea
 * @param {string[]} [opts.options]            Required when type='select'
 * @param {string}   [opts.value='']
 * @param {string}   [opts.placeholder='']
 * @param {string}   [opts.error='']
 * @param {boolean}  [opts.colSpan=false]      Span both grid columns
 * @returns {string}
 */
function field({ id, label, required = false, type = 'text',
                 options, value = '', placeholder = '', error = '', colSpan = false }) {
  const wrapClass = `form-group${colSpan ? ' col-span' : ''}`;
  const ctrlClass = `form-control${error ? ' invalid' : ''}`;
  const req       = required ? ' <span class="required">*</span>' : '';

  let control;

  if (type === 'select') {
    const optionHTML = (options ?? []).map(o =>
      `<option value="${esc(o)}" ${value === o ? 'selected' : ''}>${esc(o)}</option>`
    ).join('');
    control = `
      <select class="${ctrlClass}" id="${id}" name="${id}">
        <option value="">Select ${esc(label)}</option>
        ${optionHTML}
      </select>`;
  } else if (type === 'textarea') {
    control = `
      <textarea class="${ctrlClass}" id="${id}" name="${id}"
        placeholder="${esc(placeholder)}" rows="3">${esc(value)}</textarea>`;
  } else {
    control = `
      <input type="${type}" class="${ctrlClass}" id="${id}" name="${id}"
        value="${esc(value)}" placeholder="${esc(placeholder)}"
        ${required ? 'required' : ''} autocomplete="off" />`;
  }

  return `
    <div class="${wrapClass}">
      <label class="form-label" for="${id}">${label}${req}</label>
      ${control}
      ${error ? `<span class="field-error">${esc(error)}</span>` : ''}
    </div>
  `;
}

// ── Add / Edit modal ──────────────────────────────────────

/**
 * @param {Object|null} job     null when adding; existing job when editing
 * @param {Object}      errors  Validation error map { fieldName: message }
 * @returns {string}
 */
export function renderJobForm(job, errors = {}) {
  const isEdit = !!(job?.id);
  const title  = isEdit ? 'Edit Application' : 'Add Application';

  // Default the date to today when adding a new record
  const today = new Date().toISOString().slice(0, 10);
  const v = key => job?.[key] ?? (key === 'appliedDate' ? today : '');

  return `
    <div class="modal-header">
      <h2 class="modal-title">${title}</h2>
      <button class="modal-close" id="btn-close-modal">&#x2715;</button>
    </div>

    <div class="modal-body">
      <div class="form-grid">

        <div class="form-divider">Basic info</div>

        ${field({ id: 'company', label: 'Company Name', required: true,
                  value: v('company'), placeholder: 'e.g. Google',
                  error: errors.company })}

        ${field({ id: 'role', label: 'Job Title / Role', required: true,
                  value: v('role'), placeholder: 'e.g. Software Engineer',
                  error: errors.role })}

        ${field({ id: 'platform', label: 'Applied Via', required: true,
                  type: 'select', options: PLATFORMS,
                  value: v('platform'), error: errors.platform })}

        ${field({ id: 'status', label: 'Status', required: true,
                  type: 'select', options: STATUSES,
                  value: v('status') || 'Applied' })}

        <div class="form-divider">Details</div>

        ${field({ id: 'appliedDate', label: 'Date Applied',
                  type: 'date', value: v('appliedDate') })}

        ${field({ id: 'location', label: 'Location',
                  value: v('location'), placeholder: 'e.g. Hyderabad / Remote / Hybrid' })}

        ${field({ id: 'salary', label: 'Salary / CTC',
                  value: v('salary'), placeholder: 'e.g. 12–15 LPA' })}

        ${field({ id: 'link', label: 'Job Posting URL',
                  type: 'url', value: v('link'), placeholder: 'https://...' })}

        ${field({ id: 'notes', label: 'Notes', type: 'textarea', colSpan: true,
                  value: v('notes'),
                  placeholder: 'Recruiter name, JD highlights, interview feedback, follow-up dates...' })}

      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
      <button class="btn btn-primary" id="btn-save-job"
        data-mode="${isEdit ? 'edit' : 'add'}"
        data-id="${esc(job?.id ?? '')}">
        ${isEdit ? 'Save Changes' : 'Add Application'}
      </button>
    </div>
  `;
}

// ── Delete confirmation modal ─────────────────────────────

/**
 * @param {Object} job  The job to be deleted
 * @returns {string}
 */
export function renderDeleteConfirm(job) {
  return `
    <div class="modal-header">
      <h2 class="modal-title">Delete Application</h2>
      <button class="modal-close" id="btn-close-delete">&#x2715;</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text-secondary);line-height:1.7">
        Are you sure you want to permanently delete
        <strong style="color:var(--text-primary)">${esc(job?.role)}</strong>
        at <strong style="color:var(--text-primary)">${esc(job?.company)}</strong>?
        <br>This cannot be undone.
      </p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-cancel-delete">Cancel</button>
      <button class="btn btn-danger"    id="btn-confirm-delete" data-id="${esc(job?.id)}">
        Yes, Delete
      </button>
    </div>
  `;
}

// ── Validation ────────────────────────────────────────────

/**
 * Validate form data and return a map of field → error message.
 * An empty object means the form is valid.
 *
 * @param {Object} data  Result of extractFormData()
 * @returns {Object}
 */
export function validateJobForm(data) {
  const errors = {};
  if (!data.company?.trim())  errors.company  = 'Company name is required.';
  if (!data.role?.trim())     errors.role     = 'Job title is required.';
  if (!data.platform)         errors.platform = 'Please select a platform.';
  if (!data.status)           errors.status   = 'Please select a status.';
  return errors;
}

// ── Form data extraction ──────────────────────────────────

/**
 * Read all form field values from the modal element.
 *
 * @param {HTMLElement} container  The modal div (parent of the form fields)
 * @returns {Object}
 */
export function extractFormData(container) {
  const val = id => container.querySelector(`#${id}`)?.value?.trim() ?? '';
  return {
    company:     val('company'),
    role:        val('role'),
    platform:    val('platform'),
    status:      val('status') || 'Applied',
    appliedDate: val('appliedDate'),
    location:    val('location'),
    salary:      val('salary'),
    link:        val('link'),
    notes:       val('notes'),
  };
}
