// HomeDash entry point. LAN-only home dashboard.
const path = require('node:path');
const { loadEnv } = require('./src/env');
loadEnv();

const express = require('express');
const { loadConfig } = require('./src/config');
const { requireParent, mountAuth } = require('./src/auth');

const config = loadConfig();
const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const views = file => path.join(__dirname, 'views', file);
const pub = dir => path.join(__dirname, 'public', dir);

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Open routes (wall tablet)
app.get('/', (request, response) => response.redirect('/kid'));
app.use('/shared', express.static(pub('shared')));
app.use('/kid', express.static(pub('kid')));
app.use('/api/kid', require('./src/routes/kid')(config));
app.use('/api/weather', require('./src/routes/weather')(config));

// Parent routes (password gate)
mountAuth(app, views);
app.use('/home', requireParent, express.static(pub('home')));
app.get('/amp', requireParent, (request, response) => response.sendFile(views('amp.html')));
app.use('/api/amp', requireParent, require('./src/routes/amp')());

app.get('/health', (request, response) => response.json({ ok: true }));
app.use((request, response) => response.status(404).send('Not found'));

if (!process.env.SESSION_SECRET || !process.env.PARENT_PASSWORD_HASH) {
  console.warn('Parent login disabled: set SESSION_SECRET and PARENT_PASSWORD_HASH in .env.');
}

app.listen(port, host, () => console.log(`HomeDash on http://${host}:${port}`));
