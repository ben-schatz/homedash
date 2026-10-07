// Open-Meteo proxy (no key). Location comes from config.json. Cached 10 minutes.
const express = require('express');

module.exports = function weatherRoutes(config) {
  const router = express.Router();
  let cache = { until: 0, data: null };

  router.get('/', async (request, response) => {
    const w = config.weather || {};
    if (!Number.isFinite(w.latitude) || !Number.isFinite(w.longitude)) {
      return response.status(503).json({ error: 'Set weather.latitude and weather.longitude in config.json.' });
    }
    if (Date.now() < cache.until) return response.json(cache.data);

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(w.latitude),
      longitude: String(w.longitude),
      current: 'temperature_2m,weather_code,is_day',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset',
      forecast_days: '1',
      temperature_unit: w.units === 'celsius' ? 'celsius' : 'fahrenheit',
      timezone: 'auto'
    });

    try {
      const result = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!result.ok) throw new Error(`Open-Meteo returned ${result.status}`);
      cache = { until: Date.now() + 10 * 60 * 1000, data: await result.json() };
      response.json(cache.data);
    } catch (error) {
      console.error('Weather request failed:', error.message);
      response.status(502).json({ error: 'Unable to reach Open-Meteo.' });
    }
  });

  return router;
};
