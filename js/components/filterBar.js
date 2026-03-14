/**
 * js/components/filterBar.js
 * ──────────────────────────────────────────────────────────
 * Renders the search + filter controls bar.
 * Pure function: (filters, totalCount, filteredCount) => HTML string
 */

import { STATUSES, PLATFORMS } from '../constants/config.js';
import { esc } from '../utils/helpers.js';

/**
 * @param {Object} filters       Current filter state
 * @param {number} totalCount    Total jobs before filtering
 * @param {number} filteredCount Jobs after filtering
 * @returns {string}             HTML for the filter bar
 */
export function renderFilterBar(filters, totalCount, filteredCount) {
  const { search, status, platform } = filters;
  const hasActiveFilters = search || status || platform;

  const statusOptions = STATUSES.map(s =>
    `<option value="${esc(s)}" ${status === s ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');

  const platformOptions = PLATFORMS.map(p =>
    `<option value="${esc(p)}" ${platform === p ? 'selected' : ''}>${esc(p)}</option>`
  ).join('');

  const clearBtn = hasActiveFilters
    ? `<button class="btn btn-secondary btn-sm" id="btn-clear-filters">Clear filters</button>`
    : '';

  const countBadge = (hasActiveFilters && filteredCount !== totalCount)
    ? `<span class="filter-count">${filteredCount} of ${totalCount}</span>`
    : '';

  return `
    <div class="filter-bar">
      <div class="search-wrapper">
        <span class="search-icon">&#9906;</span>
        <input
          type="text"
          id="search-input"
          class="search-input"
          placeholder="Search company, role, location, notes..."
          value="${esc(search)}"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <select class="filter-select" id="status-filter">
        <option value="">All Statuses</option>
        ${statusOptions}
      </select>

      <select class="filter-select" id="platform-filter">
        <option value="">All Platforms</option>
        ${platformOptions}
      </select>

      ${clearBtn}
      ${countBadge}
    </div>
  `;
}
