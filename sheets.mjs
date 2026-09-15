import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const root = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(root, 'credentials.json');

const CONTACT_SHEET = 'Contact Submissions';
const CONTACT_HEADERS = ['Timestamp', 'Name', 'Email', 'Phone', 'Project type', 'Message'];

const NEWSLETTER_SHEET = 'Newsletter Signups';
const NEWSLETTER_HEADERS = ['Timestamp', 'Email'];

let sheetsClientPromise = null;
const ensuredTabs = new Set();

function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      if (!fs.existsSync(credentialsPath)) {
        throw new Error('Missing credentials.json (Google service account key) in project root.');
      }
      const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const client = await auth.getClient();
      return google.sheets({ version: 'v4', auth: client });
    })();
  }
  return sheetsClientPromise;
}

async function ensureTab(sheets, spreadsheetId, tabName, headers) {
  if (ensuredTabs.has(tabName)) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some((s) => s.properties.title === tabName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  ensuredTabs.add(tabName);
}

async function appendRow(tabName, headers, row) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Missing GOOGLE_SHEET_ID in .env');
  }

  const sheets = await getSheetsClient();
  await ensureTab(sheets, spreadsheetId, tabName, headers);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

export function appendContactRow({ name, email, phone, projectType, message }) {
  return appendRow(CONTACT_SHEET, CONTACT_HEADERS, [
    new Date().toISOString(),
    name,
    email,
    phone || '',
    projectType || '',
    message,
  ]);
}

export function appendNewsletterRow({ email }) {
  return appendRow(NEWSLETTER_SHEET, NEWSLETTER_HEADERS, [new Date().toISOString(), email]);
}
