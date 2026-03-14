/**
 * server/index.js
 * ──────────────────────────────────────────────────────────
 * Express server for Job Application Tracker.
 *
 * Routes:
 *   GET  /auth/google           → Redirect to Google OAuth consent
 *   GET  /auth/google/callback  → Handle OAuth callback
 *   GET  /auth/status           → Check if user is authenticated
 *   POST /auth/logout           → Clear session
 *   GET  /api/scan-emails       → Scan Gmail for job application emails
 */

require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const cors         = require('cors');
const { google }   = require('googleapis');
const { parseEmail } = require('./emailParser');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────
// Allow the frontend (http-server on port 3000) to call us.

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json());

// ── Sessions ─────────────────────────────────────────────
// Store OAuth tokens in server-side session (never sent to browser).

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,          // true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    sameSite: 'lax',
  },
}));

// ── OAuth 2.0 client ─────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `http://localhost:${PORT}/auth/google/callback`
  );
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// ── Routes: Authentication ───────────────────────────────

/**
 * GET /auth/google
 * Redirects the user to Google's OAuth 2.0 consent screen.
 */
app.get('/auth/google', (req, res) => {
  const oauth2Client = createOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Google redirects here after the user consents.
 * We exchange the code for tokens, store them in session,
 * then redirect back to the frontend.
 */
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    // Redirect back to the frontend app
    res.redirect('http://localhost:3000?gmail_connected=1');
  } catch (err) {
    console.error('[auth] Token exchange failed:', err.message);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

/**
 * GET /auth/status
 * Returns whether the user has valid Gmail credentials in their session.
 */
app.get('/auth/status', (req, res) => {
  const authenticated = !!(req.session.tokens?.access_token);
  res.json({ authenticated });
});

/**
 * POST /auth/logout
 * Clears the session (removes stored tokens).
 */
app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ── Middleware: require auth ──────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.tokens?.access_token) {
    return res.status(401).json({ error: 'Not authenticated. Please connect Gmail first.' });
  }
  next();
}

// ── Routes: Gmail scanning ───────────────────────────────

/**
 * GET /api/scan-emails?days=30
 *
 * Scans the user's Gmail for job application confirmation emails
 * from the past N days (default 30, max 365).
 *
 * Returns an array of parsed job applications.
 */
app.get('/api/scan-emails', requireAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

    // Set up authenticated Gmail client
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(req.session.tokens);

    // Handle token refresh
    oauth2Client.on('tokens', (newTokens) => {
      if (newTokens.refresh_token) {
        req.session.tokens.refresh_token = newTokens.refresh_token;
      }
      req.session.tokens.access_token = newTokens.access_token;
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Build Gmail search query
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);
    const afterStr = afterDate.toISOString().slice(0, 10).replace(/-/g, '/');

    const searchQuery = [
      'from:(naukri.com OR linkedin.com OR indeed.com OR glassdoor.com',
      'OR foundit.com OR internshala.com OR hirist.com OR wellfound.com',
      'OR angel.co OR instahyre.com OR cutshort.io)',
      'subject:(applied OR application OR apply OR "thank you for applying" OR "job application" OR received)',
      `after:${afterStr}`,
    ].join(' ');

    console.log(`[scan] Searching emails from last ${days} days...`);
    console.log(`[scan] Query: ${searchQuery}`);

    // Fetch message IDs (paginate up to 200 results)
    let allMessageIds = [];
    let pageToken = null;

    do {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 100,
        pageToken: pageToken || undefined,
      });

      const messages = listRes.data.messages || [];
      allMessageIds.push(...messages);
      pageToken = listRes.data.nextPageToken;
    } while (pageToken && allMessageIds.length < 200);

    console.log(`[scan] Found ${allMessageIds.length} matching emails.`);

    if (allMessageIds.length === 0) {
      return res.json({ jobs: [], totalEmails: 0 });
    }

    // Fetch full message content (batch in parallel, 10 at a time)
    const parsedJobs = [];
    const batchSize = 10;

    for (let i = 0; i < allMessageIds.length; i += batchSize) {
      const batch = allMessageIds.slice(i, i + batchSize);
      const fullMessages = await Promise.all(
        batch.map(msg =>
          gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
          }).then(r => r.data).catch(() => null)
        )
      );

      for (const message of fullMessages) {
        if (!message) continue;
        const parsed = parseEmail(message);
        if (parsed) parsedJobs.push(parsed);
      }
    }

    // Deduplicate by company + role + date
    const seen = new Set();
    const uniqueJobs = parsedJobs.filter(job => {
      const key = `${job.company.toLowerCase()}|${job.role.toLowerCase()}|${job.appliedDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date descending (newest first)
    uniqueJobs.sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));

    console.log(`[scan] Parsed ${uniqueJobs.length} unique applications from ${allMessageIds.length} emails.`);

    res.json({
      jobs: uniqueJobs,
      totalEmails: allMessageIds.length,
    });
  } catch (err) {
    console.error('[scan] Error scanning emails:', err.message);

    // Token expired → user needs to re-authenticate
    if (err.message.includes('invalid_grant') || err.code === 401) {
      req.session.tokens = null;
      return res.status(401).json({ error: 'Gmail session expired. Please reconnect.' });
    }

    res.status(500).json({ error: 'Failed to scan emails. Please try again.' });
  }
});

// ── Start server ─────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ✓ JobTracker API server running on http://localhost:${PORT}`);
  console.log(`  ✓ Gmail OAuth callback: http://localhost:${PORT}/auth/google/callback`);

  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your-client-id')) {
    console.log('\n  ⚠  WARNING: Google OAuth credentials not configured!');
    console.log('  → Edit server/.env with your Client ID and Client Secret');
    console.log('  → See server/.env.example for the format\n');
  }
});
