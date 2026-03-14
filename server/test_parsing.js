require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');

async function debugEmails() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `http://localhost:${process.env.PORT || 3001}/auth/google/callback`
  );

  // You will need to click "Connect Gmail" in the UI first so the server gets a token,
  // then we steal it from the running server's memory or ask the user to fetch.
  console.log("Since we don't have the token in this script, let me just print the regex to test manually:");
  
  const subjects = [
    "Application for Frontend Developer at Microsoft", // naukri test
    "Naukri Insights: Application for SDE at Amazon",
    "Application successfully submitted for React Dev at Meta",
    "You have successfully applied to Google for Software Engineer",
    "Fwd: Foundit job application: Senior Engineer at Apple",
    "Your application for Data Scientist at OpenAI is submitted"
  ];

  // Load the parser
  const parser = require('./emailParser');
  
  subjects.forEach(sub => {
    const res = parser.parseSubject(sub);
    console.log(`[${sub}] =>`, res);
  });
}

debugEmails();
