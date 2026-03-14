/**
 * js/components/jobTable.js
 * ──────────────────────────────────────────────────────────
 * Renders the main applications table (or the empty state).
 * Pure function: (filteredJobs, filters, hasAnyFilters) => HTML string
 */

import { COLUMNS, STATUS_BADGE_CLASS } from '../constants/config.js';
import { formatDate, getDaysAgo, esc } from '../utils/helpers.js';

// ── Sort indicator ────────────────────────────────────────

function sortIcon(field, activeSortBy, sortDir) {
  if (field !== activeSortBy) return '<span class="sort-icon">&#8597;</span>';
  return sortDir === 'asc'
    ? '<span class="sort-icon">&#8593;</span>'
    : '<span class="sort-icon">&#8595;</span>';
}

// ── Single row ────────────────────────────────────────────

function renderRow(job) {
  const badgeClass = STATUS_BADGE_CLASS[job.status] ?? 's-applied';
  const daysAgo    = getDaysAgo(job.appliedDate);

  const linkBtn = job.link
    ? `<a href="${esc(job.link)}" target="_blank" rel="noopener noreferrer" class="action-link">Link ↗</a>`
    : '';

  return `
    <tr data-job-id="${esc(job.id)}">
      <td>
        <div class="company-cell">
          <div class="company-name">${esc(job.company)}</div>
          <div class="role-name">${esc(job.role)}</div>
        </div>
      </td>
      <td>
        <span class="badge badge-platform">${esc(job.platform)}</span>
      </td>
      <td>
        <span class="badge ${badgeClass}">${esc(job.status)}</span>
      </td>
      <td>
        <div class="date-primary">${formatDate(job.appliedDate)}</div>
        ${daysAgo ? `<div class="date-ago">${daysAgo}</div>` : ''}
      </td>
      <td>${esc(job.location) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${esc(job.salary)   || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div class="row-actions">
          ${linkBtn}
          <button class="action-btn"     data-action="edit"   data-id="${esc(job.id)}">Edit</button>
          <button class="action-btn del" data-action="delete" data-id="${esc(job.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

// ── Empty state ───────────────────────────────────────────

function renderEmpty(hasActiveFilters) {
  const msg = hasActiveFilters
    ? 'No applications match your filters. Try adjusting your search or clearing the filters.'
    : 'No applications yet. Click <strong>Add Application</strong> to get started.';

  return `
    <div class="empty-state">
      <div class="empty-icon">&#128203;</div>
      <div class="empty-title">${hasActiveFilters ? 'No results' : 'Nothing here yet'}</div>
      <div class="empty-sub">${msg}</div>
    </div>
  `;
}

// ── Table header ──────────────────────────────────────────

function renderHead(sortBy, sortDir) {
  return COLUMNS.map(col => {
    if (!col.sortable) {
      return `<th>${col.label}</th>`;
    }
    const isActive = col.field === sortBy;
    return `
      <th class="sortable ${isActive ? 'sort-active' : ''}" data-sort="${col.field}">
        ${col.label}${sortIcon(col.field, sortBy, sortDir)}
      </th>
    `;
  }).join('');
}

// ── Public render function ────────────────────────────────

/**
 * @param {Object[]} filteredJobs
 * @param {Object}   filters           { sortBy, sortDir, search, status, platform }
 * @returns {string}
 */
export function renderJobTable(filteredJobs, filters) {
  const hasActiveFilters = !!(filters.search || filters.status || filters.platform);

  if (filteredJobs.length === 0) {
    return `<div class="table-wrapper">${renderEmpty(hasActiveFilters)}</div>`;
  }

  const jobCount = filteredJobs.length;
  const countLabel = `${jobCount} ${jobCount === 1 ? 'application' : 'applications'}`;

  return `
    <div class="table-wrapper">
      <div class="table-header">
        <span class="table-title">Applications</span>
        <span class="table-count">${countLabel}</span>
      </div>
      <div class="table-scroll">
        <table class="jobs-table">
          <thead>
            <tr>${renderHead(filters.sortBy, filters.sortDir)}</tr>
          </thead>
          <tbody>
            ${filteredJobs.map(renderRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
