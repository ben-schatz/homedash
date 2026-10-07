// Parent password gate. Password hash (scrypt) and session secret come from .env.
// Session is a signed, expiring cookie, so restarts do not log anyone out.
const crypto = require('node:crypto');

const COOKIE = 'hd_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = Buffer.from(hashPassword(password, salt).split(':')[1], 'hex');
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex');
}

function readCookie(request, name) {
  const header = request.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function isParent(request) {
  if (!process.env.SESSION_SECRET) return false;
  const value = readCookie(request, COOKIE);
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function requireParent(request, response, next) {
  if (isParent(request)) return next();
  if (request.originalUrl.startsWith('/api/')) return response.status(401).json({ error: 'Sign in required.' });
  response.redirect(`/login?next=${encodeURIComponent(request.originalUrl)}`);
}

function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/home';
}

function mountAuth(app, views) {
  app.get('/login', (request, response) => response.sendFile(views('login.html')));

  app.post('/login', async (request, response) => {
    const ok = process.env.SESSION_SECRET && verifyPassword(String(request.body.password || ''), process.env.PARENT_PASSWORD_HASH);
    if (!ok) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // slow down guessing
      return response.redirect(`/login?error=1&next=${encodeURIComponent(safeNext(request.body.next))}`);
    }
    const expires = String(Date.now() + MAX_AGE_MS);
    response.cookie(COOKIE, `${expires}.${sign(expires)}`, { httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE_MS });
    response.redirect(safeNext(request.body.next));
  });

  app.post('/logout', (request, response) => {
    response.clearCookie(COOKIE);
    response.redirect('/login');
  });
}

module.exports = { hashPassword, verifyPassword, requireParent, mountAuth };
