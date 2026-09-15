import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendContactEmail, sendNewsletterOwnerNotification, sendNewsletterConfirmation } from './mailer.mjs';
import { appendContactRow, appendNewsletterRow } from './sheets.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

async function handleContact(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid request body.' });
  }

  const { name, email, phone, projectType, message, company } = body || {};

  // Honeypot: real users never fill this hidden field.
  if (company) {
    return sendJson(res, 200, { ok: true });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendJson(res, 400, { ok: false, error: 'Name is required.' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return sendJson(res, 400, { ok: false, error: 'A valid email address is required.' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return sendJson(res, 400, { ok: false, error: 'Message is required.' });
  }

  const submission = {
    name: name.trim(),
    email: email.trim(),
    phone: typeof phone === 'string' ? phone.trim() : '',
    projectType: typeof projectType === 'string' ? projectType.trim() : '',
    message: message.trim(),
  };

  try {
    await sendContactEmail(submission);
  } catch (err) {
    console.error('Failed to send contact email:', err);
    return sendJson(res, 500, { ok: false, error: 'Failed to send message. Please try again later.' });
  }

  try {
    await appendContactRow(submission);
  } catch (err) {
    console.error('Failed to log contact submission to Google Sheet:', err);
  }

  return sendJson(res, 200, { ok: true });
}

async function handleNewsletter(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid request body.' });
  }

  const { email, company } = body || {};

  // Honeypot: real users never fill this hidden field.
  if (company) {
    return sendJson(res, 200, { ok: true });
  }

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return sendJson(res, 400, { ok: false, error: 'A valid email address is required.' });
  }

  const trimmedEmail = email.trim();

  try {
    await appendNewsletterRow({ email: trimmedEmail });
  } catch (err) {
    console.error('Failed to log newsletter signup to Google Sheet:', err);
    return sendJson(res, 500, { ok: false, error: 'Failed to sign up. Please try again later.' });
  }

  try {
    await sendNewsletterOwnerNotification(trimmedEmail);
  } catch (err) {
    console.error('Failed to send newsletter owner notification:', err);
  }

  try {
    await sendNewsletterConfirmation(trimmedEmail);
  } catch (err) {
    console.error('Failed to send newsletter confirmation:', err);
  }

  return sendJson(res, 200, { ok: true });
}

http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];

  if (req.method === 'POST' && urlPath === '/api/contact') {
    handleContact(req, res);
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/newsletter') {
    handleNewsletter(req, res);
    return;
  }

  const decodedPath = decodeURIComponent(urlPath);
  const isAllowed = decodedPath === '/index.html' || decodedPath.startsWith('/brand_assets/');

  if (!isAllowed) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const filePath = path.join(root, decodedPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
