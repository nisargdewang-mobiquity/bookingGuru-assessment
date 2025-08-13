const express = require('express');

const NodeCache = require('node-cache');
const router = express.Router();

const pollutionApiUrl = 'http://be-recruitment-task.onrender.com/pollution';
const pollutionApiCredentials = {
  username: 'testuser',
  password: 'testpass',
};

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedRefreshToken = null;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now) {
    return cachedToken;
  }
  // Try refresh token if available
  if (cachedRefreshToken) {
    try {
      const refreshResRaw = await fetch(pollutionApiUrl + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: cachedRefreshToken })
      });
      const refreshRes = await refreshResRaw.json();
      const token = refreshRes.data.token;
      const expiresIn = refreshRes.data.expiresIn || 60;
      if (token) {
        cachedToken = token;
        tokenExpiresAt = now + expiresIn * 1000 - 5000;
        cachedRefreshToken = refreshRes.data.refreshToken || cachedRefreshToken;
        return token;
      }
    } catch (e) {
      // If refresh fails, fallback to login
      console.error('Error refreshing token:', e);
      cachedToken = null;
      cachedRefreshToken = null;
    }
  }
  // Fallback: login
  const authResRaw = await fetch(pollutionApiUrl +'/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pollutionApiCredentials)
  });
  const authRes = await authResRaw.json();
  const token = authRes.token;
  const expiresIn = authRes.expiresIn || 60; // seconds

  if (!token) throw new Error('No access token received');
  cachedToken = token;
  tokenExpiresAt = now + expiresIn * 1000 - 5000; // subtract 5s for safety
  cachedRefreshToken = authRes.refreshToken;
  return token;
}
const wikiApiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const wikiCache = new NodeCache({ stdTTL: 60 * 60 }); // 1 hour cache

async function getWikiDescription(city, country) {
  const cacheKey = `${city},${country}`;
  const cached = wikiCache.get(cacheKey);
  if (cached) return cached;
  try {
    // Wikipedia API expects city name, sometimes with country for disambiguation
    const query = encodeURIComponent(`${city}, ${country}`);
    const resRaw = await fetch(wikiApiUrl + query);
    const res = await resRaw.json();
    if (res?.extract) {
      wikiCache.set(cacheKey, res.extract);
      return res.extract;
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Wiki API error:', e);
    }
    // fallback: try just city name
    try {
      const resRaw = await fetch(wikiApiUrl + encodeURIComponent(city));
      const res = await resRaw.json();
      if (res?.extract) {
        wikiCache.set(cacheKey, res.extract);
        return res.extract;
      }
    } catch (e2) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Wiki API fallback error:', e2);
      }
    }
  }
  wikiCache.set(cacheKey, null);
  return null;
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const enrich = req.query.enrich !== 'false'; // default true, set enrich=false to skip Wikipedia
    const allowedCountries = ['PL', 'DE', 'ES', 'FR'];
    let country = req.query.country;
    if (!country || !allowedCountries.includes(country)) {
      country = 'PL'; // default to PL if not provided or invalid
    }

    // Step 1: Get access token (cached)
    const accessToken = await getAccessToken();
    console.log()
    // Remove debug log for production
    let cities;
    try {
      const responseRaw = await fetch(`${pollutionApiUrl}?country=${country}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      cities = await responseRaw.json();
    } catch (apiErr) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Pollution API error:', apiErr);
      }
      throw apiErr;
    }

    // Use results from pollution API response
    if (!cities || !Array.isArray(cities.results)) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Expected results array in pollution API response, got:', cities);
      }
      throw new Error('Invalid response format from pollution API');
    }
    const meta = cities.meta || {};
    const results = cities.results;
    // Filter and normalize
    const normalized = results.filter(entry => entry.name && typeof entry.name === 'string')
      .map(entry => ({
        name: entry.name.trim(),
        country,
        pollution: entry.pollution ?? null,
      }));
    let citiesOut;
    if (enrich) {
      citiesOut = await Promise.all(
        normalized.map(async cityObj => {
          const description = await getWikiDescription(cityObj.name, cityObj.country);
          return { ...cityObj, description: description || '' };
        })
      );
    } else {
      citiesOut = normalized.map(cityObj => ({ ...cityObj, description: '' }));
    }
    res.json({
      page: meta.page || page,
      limit,
      totalPages: meta.totalPages || null,
      cities: citiesOut
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('API error:', err);
    }
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

module.exports = router;
