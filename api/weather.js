// ============================================================
// GET /api/weather?location=<city name>
// Server-side weather proxy — no provider API key ever reaches
// the browser. Defaults to Open-Meteo (free, no key required).
// If WEATHER_API_KEY is set in Vercel env vars, uses OpenWeatherMap
// instead. Swap/add providers here only — no page or script needs
// to change when the provider changes.
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const location = String((req.query && req.query.location) || '').trim();
  if (!location) return res.status(400).json({ error: 'location required' });

  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const data = apiKey
      ? await fetchOpenWeatherMap(location, apiKey)
      : await fetchOpenMeteo(location);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: (e && e.message) || 'weather fetch failed' });
  }
}

const WMO_CONDITIONS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm (hail)', 99: 'Severe thunderstorm',
};

async function fetchOpenMeteo(location) {
  const geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(location);
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) throw new Error('location lookup failed');
  const geo = await geoRes.json();
  const hit = geo && geo.results && geo.results[0];
  if (!hit) throw new Error('location not found');

  const wxUrl = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + hit.latitude + '&longitude=' + hit.longitude
    + '&current=temperature_2m,weather_code,wind_speed_10m'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=auto';
  const wxRes = await fetch(wxUrl);
  if (!wxRes.ok) throw new Error('forecast fetch failed');
  const wx = await wxRes.json();
  if (!wx || !wx.current) throw new Error('forecast unavailable');

  const label = [hit.name, hit.admin1, hit.country].filter(Boolean).slice(0, 2).join(', ');
  const rainChance = wx.daily && Array.isArray(wx.daily.precipitation_probability_max)
    ? wx.daily.precipitation_probability_max[0]
    : null;

  return {
    provider: 'open-meteo',
    location: label || location,
    temperature: Math.round(wx.current.temperature_2m) + '°C',
    condition: WMO_CONDITIONS[wx.current.weather_code] || 'Unknown',
    high: wx.daily && wx.daily.temperature_2m_max ? Math.round(wx.daily.temperature_2m_max[0]) + '°C' : '',
    low: wx.daily && wx.daily.temperature_2m_min ? Math.round(wx.daily.temperature_2m_min[0]) + '°C' : '',
    rainChance: rainChance != null ? Math.round(rainChance) + '%' : '',
    wind: Math.round(wx.current.wind_speed_10m) + ' km/h',
  };
}

async function fetchOpenWeatherMap(location, apiKey) {
  const url = 'https://api.openweathermap.org/data/2.5/weather?units=metric&q='
    + encodeURIComponent(location) + '&appid=' + apiKey;
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok) throw new Error((d && d.message) || 'weather fetch failed');

  return {
    provider: 'openweathermap',
    location: d.name + (d.sys && d.sys.country ? ', ' + d.sys.country : ''),
    temperature: Math.round(d.main.temp) + '°C',
    condition: d.weather && d.weather[0] ? d.weather[0].description : 'Unknown',
    high: d.main.temp_max != null ? Math.round(d.main.temp_max) + '°C' : '',
    low: d.main.temp_min != null ? Math.round(d.main.temp_min) + '°C' : '',
    rainChance: '',
    wind: d.wind && d.wind.speed != null ? Math.round(d.wind.speed * 3.6) + ' km/h' : '',
  };
}
