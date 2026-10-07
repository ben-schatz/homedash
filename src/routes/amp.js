// AMP game-server status (v2, optional). Proxies AMP's JSON API server-side.
// Untested against real AMP. History is in-memory only.
const express = require('express');

const ampHistory = new Map();
let ampCache = { until: 0, data: null };

async function ampCall(baseUrl, method, parameters) {
  const result = await fetch(new URL(`API/${method}`, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameters),
    signal: AbortSignal.timeout(8000)
  });
  if (!result.ok) throw new Error(`AMP ${method} returned ${result.status}`);
  const data = await result.json();
  if (data?.Status === false || data?.success === false || data?.Error || data?.Title) throw new Error(`AMP ${method} rejected the request`);
  if (method === 'Core/Login' && !data.sessionID && !data.SessionID) {
    const authorization = result.headers.get('authorization');
    if (authorization) data.sessionID = authorization.replace(/^Bearer\s+/i, '');
  }
  return data;
}

function ampInstances(payload) {
  if (Array.isArray(payload)) return payload.flatMap(ampInstances);
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['AvailableInstances', 'Instances', 'instances', 'Result', 'Data']) {
    if (Array.isArray(payload[key])) return ampInstances(payload[key]);
  }
  return payload.InstanceID || payload.InstanceId || payload.FriendlyName || payload.AppState !== undefined ? [payload] : [];
}

function ampNumber(value) {
  return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
}

module.exports = function ampRoutes() {
  const router = express.Router();

  router.get('/', async (request, response) => {
    if (!process.env.AMP_URL || !process.env.AMP_USERNAME || !process.env.AMP_PASSWORD) {
      return response.status(503).json({ error: 'Set AMP_URL, AMP_USERNAME, and AMP_PASSWORD on the dashboard server.' });
    }
    if (Date.now() < ampCache.until) return response.json(ampCache.data);
    try {
      const baseUrl = new URL(process.env.AMP_URL.endsWith('/') ? process.env.AMP_URL : `${process.env.AMP_URL}/`);
      if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('AMP_URL must use http or https');
      const login = await ampCall(baseUrl, 'Core/Login', {
        username: process.env.AMP_USERNAME,
        password: process.env.AMP_PASSWORD,
        token: '', rememberMe: false
      });
      const sessionID = login.sessionID || login.SessionID;
      if (!sessionID) throw new Error('AMP did not return a session ID');
      const result = await ampCall(baseUrl, 'ADSModule/GetInstances', { SESSIONID: sessionID });
      const rawInstances = ampInstances(result);
      const now = Date.now();
      const instances = rawInstances.map(instance => {
        const id = String(instance.InstanceID || instance.InstanceId || instance.Id || instance.FriendlyName || instance.InstanceName || 'unknown');
        const rawRunning = instance.Running ?? instance.IsRunning ?? instance.running;
        const appState = ampNumber(instance.AppState);
        const running = rawRunning == null && appState == null && instance.State == null ? null :
          rawRunning === true || rawRunning === 'true' || appState === 20 || instance.State === 'Running';
        const metrics = instance.Metrics || {};
        const players = ampNumber(metrics['Active Users']?.RawValue ?? instance.PlayerCount ?? instance.Players);
        const cpu = ampNumber(metrics['CPU Usage']?.RawValue ?? instance.CPUUsage);
        const memory = ampNumber(metrics['Memory Usage']?.Percent ?? instance.MemoryPercent);
        const uptime = ampNumber(instance.UptimeSeconds ?? instance.UpTimeSeconds);
        const name = String(instance.FriendlyName || instance.Name || instance.InstanceName || id);
        const samples = ampHistory.get(id) || [];
        samples.push({ time: now, running: typeof running === 'boolean' ? running : null, players: typeof players === 'number' ? players : null });
        ampHistory.set(id, samples.filter(sample => sample.time > now - 86400000));
        return { id, name, running, players, cpu, memory, uptime, history: ampHistory.get(id) };
      });
      const data = { instances, updatedAt: new Date(now).toISOString(), historyNote: 'History since this dashboard process started (up to 24 hours).' };
      ampCache = { until: now + 30000, data };
      response.json(data);
    } catch (error) {
      console.error('AMP request failed:', error.message);
      response.status(502).json({ error: 'Could not read AMP. Check its URL, credentials, and local API access.' });
    }
  });

  return router;
};
