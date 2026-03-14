/**
 * js/components/stats.js
 * ──────────────────────────────────────────────────────────
 * Renders the top-level stats dashboard cards.
 * Pure function: (jobs) => HTML string
 */

import { computeStats } from '../utils/helpers.js';

/**
 * @param {Object[]} jobs  The full (unfiltered) jobs array
 * @returns {string}       HTML for the stats grid section
 */
export function renderStats(jobs) {
  const s = computeStats(jobs);

  const cards = [
    {
      label:  'Total Applied',
      value:  s.total,
      sub:    s.total === 1 ? '1 application logged' : `${s.total} applications logged`,
      accent: 'accent-blue',
    },
    {
      label:  'Active',
      value:  s.active,
      sub:    'in progress',
      accent: 'accent-purple',
    },
    {
      label:  'Interviews',
      value:  s.interviews,
      sub:    'scheduled or completed',
      accent: 'accent-teal',
    },
    {
      label:  'Offers',
      value:  s.offers,
      sub:    s.offers === 1 ? '1 offer received' : `${s.offers} offers received`,
      accent: 'accent-green',
    },
    {
      label:  'Rejected',
      value:  s.rejected,
      sub:    'closed',
      accent: 'accent-red',
    },
    {
      label:  'Response Rate',
      value:  `${s.responseRate}%`,
      sub:    'companies responded',
      accent: 'accent-amber',
    },
  ];

  const cardHTML = cards.map(c => `
    <div class="stat-card ${c.accent}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>
  `).join('');

  return `<div class="stats-grid">${cardHTML}</div>`;
}
