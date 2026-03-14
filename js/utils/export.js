/**
 * js/utils/export.js
 * ──────────────────────────────────────────────────────────
 * Handles exporting the current list of job applications to a CSV file.
 * Compatible with Microsoft Excel, Google Sheets, etc.
 */

/**
 * Escapes a CSV field to handle commas, quotes, and newlines safely.
 * @param {string} text - The input string field.
 * @returns {string} - The safely escaped CSV field.
 */
function escapeCSV(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  // If the field contains a comma, newline, or double quote, we must wrap it in quotes
  // and double up any existing double quotes.
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a CSV file from an array of Job objects and triggers a browser download.
 * @param {Array} jobs - The currently filtered array of job application objects.
 */
export function exportJobsToCSV(jobs) {
  if (!jobs || jobs.length === 0) {
    return; // Nothing to export
  }

  // 1. Define the CSV Header Row (The columns)
  const headers = [
    'Company',
    'Role',
    'Platform',
    'Status',
    'Applied Date',
    'Location',
    'Salary/CTC',
    'Link',
    'Notes'
  ];

  // 2. Map the job objects into rows strings
  const rows = jobs.map(job => {
    return [
      escapeCSV(job.company),
      escapeCSV(job.role),
      escapeCSV(job.platform),
      escapeCSV(job.status),
      escapeCSV(job.appliedDate),
      escapeCSV(job.location),
      escapeCSV(job.salary),
      escapeCSV(job.link),
      escapeCSV(job.notes)
    ].join(',');
  });

  // 3. Assemble full CSV string
  const csvContent = [headers.join(','), ...rows].join('\n');

  // 4. Create a Blob from the CSV String
  // We prepend the UTF-8 BOM (\uFEFF) so Excel opens UTF-8 encoded characters properly.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // 5. Create a hidden `<a>` tag and trigger the download
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `job_applications_${dateStr}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  URL.revokeObjectURL(url);
}
