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

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { google } = require('googleapis');
const { GoogleGenAI } = require('@google/genai');
const { parseEmail } = require('./emailParser');

const app = express();
const PORT = process.env.PORT || 3001;

// ── FIX 1: Correct production URL fallbacks ───────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://jobtracky.netlify.app';
const BACKEND_URL = process.env.BACKEND_URL || 'https://job-tracker-ooak.onrender.com';

// ── CORS ─────────────────────────────────────────────────
app.set('trust proxy', 1);

// ── FIX 2: Added jobtracky.netlify.app to allowed origins ─
app.use(cors({
  origin: [
    FRONTEND_URL,
    'https://jobtracky.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://pranaydarshi.github.io',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ── Sessions ─────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
  },
}));

// ── OAuth 2.0 client ─────────────────────────────────────
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${BACKEND_URL}/auth/google/callback`  // FIX 3: Now uses production BACKEND_URL
  );
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// ── Routes: Authentication ───────────────────────────────

app.get('/auth/google', (req, res) => {
  const oauth2Client = createOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect(`${FRONTEND_URL}?gmail_connected=1`);  // FIX 4: Redirects to Netlify, not localhost
  } catch (err) {
    console.error('[auth] Token exchange failed:', err.message);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

app.get('/auth/status', (req, res) => {
  const authenticated = !!(req.session.tokens?.access_token);
  res.json({ authenticated });
});

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
app.get('/api/scan-emails', requireAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(req.session.tokens);

    oauth2Client.on('tokens', (newTokens) => {
      if (newTokens.refresh_token) {
        req.session.tokens.refresh_token = newTokens.refresh_token;
      }
      req.session.tokens.access_token = newTokens.access_token;
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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

    const seen = new Set();
    const uniqueJobs = parsedJobs.filter(job => {
      const key = `${job.company.toLowerCase()}|${job.role.toLowerCase()}|${job.appliedDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniqueJobs.sort((a, b) => b.appliedDate.localeCompare(a.appliedDate));

    console.log(`[scan] Parsed ${uniqueJobs.length} unique applications from ${allMessageIds.length} emails.`);

    res.json({
      jobs: uniqueJobs,
      totalEmails: allMessageIds.length,
    });
  } catch (err) {
    console.error('[scan] Error scanning emails:', err.message);

    if (err.message.includes('invalid_grant') || err.code === 401) {
      req.session.tokens = null;
      return res.status(401).json({ error: 'Gmail session expired. Please reconnect.' });
    }

    res.status(500).json({ error: 'Failed to scan emails. Please try again.' });
  }
});

// ── AI Tools Initialization ──────────────────────────────

let ai = null;
try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here' && process.env.GEMINI_API_KEY !== '"your-gemini-api-key-here"') {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.replace(/"/g, '') });
  }
} catch (e) {
  console.warn('⚠️ Google Gen AI SDK failed to initialize. Check GEMINI_API_KEY.');
}

// ── Routes: AI Tools ─────────────────────────────────────

app.post('/api/check-resume', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'AI features are not configured on the server. Please set GEMINI_API_KEY in server/.env.' });
  }

  try {
    const { resumeBase64, jobDescription } = req.body;
    if (!resumeBase64) {
      return res.status(400).json({ error: 'Missing resume file.' });
    }

    let prompt = `You are a strict, expert technical recruiter and resume reviewer.\n`;
    if (jobDescription && jobDescription.trim() !== '') {
      prompt += `The user is applying for a job described below. Evaluate their resume against this job description.\n\nJob Description:\n"""\n${jobDescription}\n"""\n\n`;
      prompt += `Please provide your evaluation in the following structure using clean Markdown:\n`;
      prompt += `- **Match Score**: Rate the match out of 100%.\n`;
      prompt += `- **Strengths**: 3 strong areas in the resume for this role.\n`;
      prompt += `- **Missing Keywords**: Key technical or soft skills mentioned in the JD but missing in the resume.\n`;
      prompt += `- **Actionable Recommendations**: 3 specific recommendations to improve the resume for this exact role.\n`;
    } else {
      prompt += `Evaluate the provided resume for general ATS (Applicant Tracking System) optimization and standard best practices since no target job description was provided.\n\n`;
      prompt += `Please provide your evaluation in the following structure using clean Markdown:\n`;
      prompt += `- **Overall ATS Score**: Rate the general ATS score out of 100%.\n`;
      prompt += `- **Strengths**: 3 strong formatting or content areas in the resume.\n`;
      prompt += `- **Weaknesses/Missing Elements**: Areas where the resume lacks detail, impact, or ATS friendliness.\n`;
      prompt += `- **Actionable Recommendations**: 3 specific recommendations to improve the resume generally.\n`;
    }
    prompt += `Be concise and constructive. Analyze the attached PDF document.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [
          { text: prompt },
          { inlineData: { data: resumeBase64, mimeType: 'application/pdf' } }
        ]}
      ]
    });

    res.json({ result: response.text });
  } catch (err) {
    console.error('[ai] Resume Check Error:', err);
    res.status(500).json({ error: 'Failed to generate AI response. Try again later.' });
  }
});

app.post('/api/prep-interview', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'AI features are not configured on the server. Please set GEMINI_API_KEY in server/.env.' });
  }

  try {
    const { role, company } = req.body;
    if (!role || !company) {
      return res.status(400).json({ error: 'Missing role or company name.' });
    }

    const prompt = `You are an expert interview coach for top-tier companies.
The user is preparing for a job interview for the role of "${role}" at the company "${company}".

Provide a comprehensive, tailored interview preparation guide. Include the following using clean Markdown:
- **Company Context**: A very brief sentence about ${company}'s known culture or interview style if applicable.
- **Behavioral Questions**: 3 highly likely cultural or behavioral questions specific to ${company}.
- **Technical Questions**: 3 likely role-specific questions for a "${role}".
- **Questions to Ask**: 2 strategic questions the candidate should ask the interviewer at the end.
- **Pro-Tips**: Top 3 general tips to succeed in this specific interview.
Be extremely specific to the known or assumed nature of ${company} and the ${role}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ result: response.text });
  } catch (err) {
    console.error('[ai] Interview Prep Error:', err);
    res.status(500).json({ error: 'Failed to generate AI response. Try again later.' });
  }
});

// ── Start server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ✓ JobTracker API server running on port ${PORT}`);
  console.log(`  ✓ Frontend URL : ${FRONTEND_URL}`);
  console.log(`  ✓ Backend URL  : ${BACKEND_URL}`);
  console.log(`  ✓ OAuth callback: ${BACKEND_URL}/auth/google/callback`);

  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your-client-id')) {
    console.log('\n  ⚠  WARNING: Google OAuth credentials not configured!');
    console.log('  → Edit server/.env with your Client ID and Client Secret');
    console.log('  → See server/.env.example for the format\n');
  }
});