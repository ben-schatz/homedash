// Open-Meteo proxy (no key). Location comes from config.json. Cached 10 minutes.
// GET /api/weather        raw Open-Meteo response
// GET /api/weather/simple { icon, temp, phrase } for the kid board
const express = require('express');

// One short phrase a kid can read. Current conditions win; then today's rain chance; then temperature.
function simplify(data, units) {
  const code = data.current.weather_code;
  const temp = Math.round(data.current.temperature_2m);
  const isDay = data.current.is_day === 1;
  const rainChance = (data.daily.precipitation_probability_max || [0])[0] || 0;
  const freezing = units === 'celsius' ? 0 : 32;
  const cold = units === 'celsius' ? 7 : 45;
  const hot = units === 'celsius' ? 29 : 85;

  let icon = isDay ? '☀️' : '🌙'; // sun / moon
  let phrase = isDay ? 'Sunny' : 'Clear';
  if (code === 2) { icon = '⛅'; phrase = 'Some clouds'; }
  if (code === 3) { icon = '☁️'; phrase = 'Cloudy'; }
  if (code === 45 || code === 48) { icon = '🌫️'; phrase = 'Foggy'; }

  const raining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const snowing = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const storming = code >= 95;

  if (storming) { icon = '⛈️'; phrase = 'Storms'; }
  else if (snowing) { icon = '❄️'; phrase = 'Snow'; }
  else if (raining) { icon = '🌧️'; phrase = 'Rain'; }
  else if (rainChance >= 40) {
    icon = '🌦️';
    phrase = temp <= freezing ? 'Maybe snow' : 'Maybe rain';
  }
  else if (temp <= freezing) phrase = 'Freezing';
  else if (temp <= cold) phrase = 'Cold';
  else if (temp >= hot) phrase = 'Hot';

  return { icon, temp, phrase };
}

module.exports = function weatherRoutes(config) {
  const router = express.Router();
  const w = config.weather || {};
  let cache = { until: 0, data: null };

  async function load() {
    if (Date.now() < cache.until) return cache.data;
    if (!Number.isFinite(w.latitude) || !Number.isFinite(w.longitude)) {
      throw new Error('Set weather.latitude and weather.longitude in config.json.');
    }
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
    const result = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!result.ok) throw new Error(`Open-Meteo returned ${result.status}`);
    cache = { until: Date.now() + 10 * 60 * 1000, data: await result.json() };
    return cache.data;
  }

  router.get('/', async (request, response) => {
    try { response.json(await load()); }
    catch (error) {
      console.error('Weather request failed:', error.message);
      response.status(502).json({ error: 'Weather unavailable.' });
    }
  });

  router.get('/simple', async (request, response) => {
    try { response.json(simplify(await load(), w.units)); }
    catch (error) {
      console.error('Weather request failed:', error.message);
      response.status(502).json({ error: 'Weather unavailable.' });
    }
  });

  return router;
};

module.exports.simplify = simplify;
