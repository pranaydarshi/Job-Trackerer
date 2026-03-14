/**
 * server/emailParser.js
 * ──────────────────────────────────────────────────────────
 * Parses Gmail messages to extract job application details.
 *
 * Each portal sends confirmation emails with different formats.
 * This module uses regex patterns to extract:
 *   - Company name
 *   - Job role / title
 *   - Platform (detected from sender domain)
 *   - Date applied (from email date)
 */

// ── Portal detection by sender domain ────────────────────

const PORTAL_MAP = [
  { domain: 'naukri.com',      platform: 'Naukri' },
  { domain: 'linkedin.com',    platform: 'LinkedIn' },
  { domain: 'indeed.com',      platform: 'Indeed' },
  { domain: 'glassdoor.com',   platform: 'Glassdoor' },
  { domain: 'foundit.com',     platform: 'Foundit' },
  { domain: 'internshala.com', platform: 'Internshala' },
  { domain: 'hirist.com',      platform: 'Hirist' },
  { domain: 'wellfound.com',   platform: 'Wellfound' },
  { domain: 'angellist.com',   platform: 'AngelList' },
  { domain: 'angel.co',        platform: 'AngelList' },
  { domain: 'instahyre.com',   platform: 'Other' },
  { domain: 'cutshort.io',     platform: 'Other' },
];

/**
 * Detect which platform sent the email based on the "From" header.
 *
 * @param {string} from  The From header value
 * @returns {string|null} Platform name, or null if unrecognized
 */
function detectPlatform(from) {
  const lower = (from || '').toLowerCase();
  for (const entry of PORTAL_MAP) {
    if (lower.includes(entry.domain)) return entry.platform;
  }
  return null;
}

// ── Subject-line parsing patterns ────────────────────────
//
// Each portal has its own email format. We try multiple
// regex patterns and return the first match.

const SUBJECT_PATTERNS = [
  // ── Naukri ──────────────────────────────────────────────
  // "Application for Software Engineer at Google"
  // "Your application for Software Engineer - Google has been submitted"
  // "You have applied at Google for Software Engineer"
  {
    regex: /application\s+(?:successfully\s+)?(?:submitted\s+)?for\s+(.+?)\s+at\s+(.+?)(?:\s+has\b|\s*$)/i,
    role: 1, company: 2,
  },
  {
    regex: /applied\s+(?:successfully\s+)?(?:at|to)\s+(.+?)\s+for\s+(.+?)(?:\s*[-–—.|]|\s*$)/i,
    company: 1, role: 2,
  },
  {
    regex: /applied\s+(?:successfully\s+)?for\s+(.+?)\s+(?:at|with)\s+(.+?)(?:\s*[-–—.|]|\s*$)/i,
    role: 1, company: 2,
  },

  // ── LinkedIn ────────────────────────────────────────────
  // "You applied for Software Engineer at Google"
  // "Your application was sent to Google"
  // "Application submitted: Software Engineer at Google"
  {
    regex: /you\s+applied\s+for\s+(.+?)\s+at\s+(.+?)(?:\s*$)/i,
    role: 1, company: 2,
  },
  {
    regex: /application\s+(?:was\s+)?sent\s+to\s+(.+?)(?:\s*$)/i,
    company: 1, role: null,
  },
  {
    regex: /application\s+submitted[:\s]+(.+?)\s+at\s+(.+?)(?:\s*$)/i,
    role: 1, company: 2,
  },

  // ── Indeed ──────────────────────────────────────────────
  // "Your application to Google was sent"
  // "You applied to Software Engineer at Google"
  {
    regex: /your\s+application\s+to\s+(.+?)\s+was\s+sent/i,
    company: 1, role: null,
  },
  {
    regex: /you\s+applied\s+to\s+(.+?)\s+at\s+(.+)/i,
    role: 1, company: 2,
  },

  // ── Glassdoor ───────────────────────────────────────────
  // "Application Received: Software Engineer"
  // "Application Received: Software Engineer at Google"
  {
    regex: /application\s+received[:\s]+(.+?)\s+at\s+(.+?)(?:\s*$)/i,
    role: 1, company: 2,
  },
  {
    regex: /application\s+received[:\s]+(.+?)(?:\s*$)/i,
    role: 1, company: null,
  },

  // ── Foundit / Internshala ───────────────────────────────
  // "Application submitted for Web Developer Intern at Startup Inc"
  // "Foundit job application: Senior Engineer at Apple"
  {
    regex: /application\s+submitted\s+for\s+(.+?)\s+at\s+(.+?)(?:\s*$)/i,
    role: 1, company: 2,
  },
  {
    regex: /job\s+application[:\-]\s*(.+?)\s+at\s+(.+?)(?:\s*$)/i,
    role: 1, company: 2,
  },

  // ── Generic fallback ───────────────────────────────────
  // "Thank you for applying to Google"
  // "Thank you for your application - Software Engineer"
  {
    regex: /thank\s+you\s+for\s+applying\s+(?:to|at)\s+(.+?)(?:\s*$)/i,
    company: 1, role: null,
  },
  {
    regex: /thank\s+you\s+for\s+your\s+application\s*[-–—:]\s*(.+?)(?:\s*$)/i,
    role: 1, company: null,
  },
];

/**
 * Try to extract company and role from an email subject line.
 *
 * @param {string} subject
 * @returns {{ company: string|null, role: string|null }}
 */
function parseSubject(subject) {
  let clean = (subject || '').replace(/\s+/g, ' ').trim();

  // Strip common email prefixes that throw off the regex starting boundary
  clean = clean.replace(/^(?:Fwd|Fw|Re):\s*/i, '');
  clean = clean.replace(/^(?:Naukri\s+Insights|Update|Alert):\s*/i, '');
  clean = clean.replace(/^(?:Foundit|Monster).*?job\s+application:\s*/i, 'job application: ');
  clean = clean.trim();

  for (const pattern of SUBJECT_PATTERNS) {
    const match = clean.match(pattern.regex);
    if (!match) continue;

    const company = pattern.company !== null ? (match[pattern.company] || '').trim() : null;
    const role    = pattern.role    !== null ? (match[pattern.role]    || '').trim() : null;

    // Reject obviously bad extractions
    if (company && company.length > 100) continue;
    if (role    && role.length    > 100) continue;

    return { company: company || null, role: role || null };
  }

  return { company: null, role: null };
}

// ── Body parsing (fallback) ──────────────────────────────

/**
 * Try to extract company/role from the plain-text email body
 * when subject parsing fails or returns incomplete data.
 *
 * @param {string} body
 * @returns {{ company: string|null, role: string|null }}
 */
function parseBody(body) {
  if (!body) return { company: null, role: null };

  const text = body.replace(/\s+/g, ' ').substring(0, 2000); // limit scan range

  const bodyPatterns = [
    {
      regex: /applied\s+for\s+(?:the\s+)?(?:position\s+of\s+)?(.+?)\s+at\s+(.+?)[\.\,\!]/i,
      role: 1, company: 2,
    },
    {
      regex: /application\s+for\s+(.+?)\s+at\s+(.+?)\s+has\s+been/i,
      role: 1, company: 2,
    },
    {
      regex: /your\s+application\s+to\s+(.+?)\s+for\s+(?:the\s+)?(.+?)\s+(?:has|was)/i,
      company: 1, role: 2,
    },
  ];

  for (const pattern of bodyPatterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;
    const company = pattern.company !== null ? (match[pattern.company] || '').trim() : null;
    const role    = pattern.role    !== null ? (match[pattern.role]    || '').trim() : null;
    if (company && company.length > 100) continue;
    if (role    && role.length    > 100) continue;
    return { company: company || null, role: role || null };
  }

  return { company: null, role: null };
}

// ── Date extraction ──────────────────────────────────────

/**
 * Extract a YYYY-MM-DD date from the email's internal date (ms timestamp).
 *
 * @param {string|number} internalDate  Epoch milliseconds
 * @returns {string} YYYY-MM-DD
 */
function extractDate(internalDate) {
  try {
    const d = new Date(Number(internalDate));
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── Header extraction helper ─────────────────────────────

/**
 * Get a specific header value from the Gmail message payload.
 *
 * @param {Object} payload  Gmail message payload
 * @param {string} name     Header name (case-insensitive)
 * @returns {string}
 */
function getHeader(payload, name) {
  const header = (payload.headers || []).find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );
  return header?.value || '';
}

// ── Decode email body ────────────────────────────────────

/**
 * Decode the plain-text body from a Gmail message.
 * Gmail returns base64url-encoded content spread across parts.
 *
 * @param {Object} payload  Gmail message payload
 * @returns {string}
 */
function decodeBody(payload) {
  // Simple message (no parts)
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Multipart message — find the text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
      // Nested multipart
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === 'text/plain' && sub.body?.data) {
            return Buffer.from(sub.body.data, 'base64url').toString('utf-8');
          }
        }
      }
    }
  }

  return '';
}

// ── Main parse function ──────────────────────────────────

/**
 * Parse a Gmail message into a structured job application object.
 *
 * @param {Object} message  Full Gmail message (with payload)
 * @returns {Object|null}   Parsed job data, or null if not a job email
 */
function parseEmail(message) {
  const { payload, internalDate } = message;
  if (!payload) return null;

  const from    = getHeader(payload, 'From');
  const subject = getHeader(payload, 'Subject');

  // Detect which platform sent this
  const platform = detectPlatform(from);
  if (!platform) return null;

  // Try subject line first
  let { company, role } = parseSubject(subject);

  // Fall back to body parsing if subject didn't give enough
  if (!company || !role) {
    const body     = decodeBody(payload);
    const bodyData = parseBody(body);
    company = company || bodyData.company;
    role    = role    || bodyData.role;
  }

  // Must have at least company or role to be useful
  if (!company && !role) return null;

  return {
    company:     company || 'Unknown Company',
    role:        role    || 'Unknown Role',
    platform,
    status:      'Applied',
    appliedDate: extractDate(internalDate),
    location:    '',
    salary:      '',
    link:        '',
    notes:       `Imported from Gmail · Subject: ${subject}`,
    _emailId:    message.id,     // used for deduplication
    _subject:    subject,        // for user review
  };
}

module.exports = {
  detectPlatform,
  parseSubject,
  parseBody,
  parseEmail,
  decodeBody,
  getHeader,
  PORTAL_MAP,
};
