const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const port = Number(process.env.PORT) || 8080;
const publicDirectory = path.join(__dirname, "public");
const rateLimits = new Map();
const forecastCache = new Map();
const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 30;
const rateLimitMaxEntries = 10_000;
const forecastCacheTtlMs = 10 * 60_000;
const forecastCacheMaxEntries = 1_000;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function allowForecastRequest(clientIp, now = Date.now()) {
  const entry = rateLimits.get(clientIp);
  if (!entry || entry.expiresAt <= now) {
    if (!entry && rateLimits.size >= rateLimitMaxEntries) {
      for (const [ip, limit] of rateLimits) {
        if (limit.expiresAt <= now) rateLimits.delete(ip);
      }
      if (rateLimits.size >= rateLimitMaxEntries) return false;
    }
    rateLimits.set(clientIp, { count: 1, expiresAt: now + rateLimitWindowMs });
    return true;
  }
  if (entry.count >= rateLimitMaxRequests) return false;
  entry.count += 1;
  return true;
}

function forecastCacheKey(location, coordinates) {
  if (coordinates) {
    const roundCoordinate = (value) => {
      const rounded = Math.round(value * 100) / 100;
      return (rounded === 0 ? 0 : rounded).toFixed(2);
    };
    return `coordinates:${roundCoordinate(coordinates.latitude)},${roundCoordinate(coordinates.longitude)}`;
  }
  return `location:${location.toLowerCase()}`;
}

function getCachedForecast(key, now = Date.now()) {
  const entry = forecastCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    forecastCache.delete(key);
    return null;
  }
  return entry.result;
}

function cacheForecast(key, result, now = Date.now()) {
  if (!forecastCache.has(key) && forecastCache.size >= forecastCacheMaxEntries) {
    for (const [cacheKey, entry] of forecastCache) {
      if (entry.expiresAt <= now) forecastCache.delete(cacheKey);
    }
    if (forecastCache.size >= forecastCacheMaxEntries) {
      const oldestKey = forecastCache.keys().next().value;
      if (oldestKey !== undefined) forecastCache.delete(oldestKey);
    }
  }
  forecastCache.set(key, { result, expiresAt: now + forecastCacheTtlMs });
}

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (entry.expiresAt <= now) rateLimits.delete(ip);
  }
  for (const [key, entry] of forecastCache) {
    if (entry.expiresAt <= now) forecastCache.delete(key);
  }
}, 60_000);
cleanupInterval.unref();

async function getForecast(location, coordinates) {
  let place;
  if (!coordinates) {
    const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodingUrl.search = new URLSearchParams({ count: "1", language: "en", name: location, format: "json" });
    const geocodingResponse = await fetch(geocodingUrl, { signal: AbortSignal.timeout(10000) });
    if (!geocodingResponse.ok) throw new Error("Location search is temporarily unavailable.");

    place = (await geocodingResponse.json()).results?.[0];
    if (!place) return null;
  }

  const apiKey = process.env.INFOPLAZA_API_KEY;
  const latitude = coordinates?.latitude ?? place.latitude;
  const longitude = coordinates?.longitude ?? place.longitude;

  const forecastUrl = new URL("https://api.infoplaza.com/v1/weather/forecast");
  forecastUrl.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    api_key: apiKey,
    units: "metric",
    max_daily: "5",
    language: "en",
  });
  const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(10000) });
  if (!forecastResponse.ok) throw new Error("The forecast is temporarily unavailable.");
  const forecastPayload = await forecastResponse.json();
  const forecast = forecastPayload.data ?? forecastPayload;
  if (forecastPayload.success === false || !Array.isArray(forecast.daily) || !forecast.currently) {
    throw new Error("The forecast response is incomplete.");
  }

  return {
    place: {
      name: place?.name || forecast.location || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
      admin1: place?.admin1,
      country: place?.country || forecast.country,
      timezone: place?.timezone || forecast.timezone,
    },
    forecast,
  };
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, "http://localhost");
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end("Method not allowed");
      return;
    }

    if (requestUrl.pathname === "/api/forecast") {
      const clientIp = request.headers["fly-client-ip"]?.trim() || request.socket.remoteAddress || "unknown";
      if (!allowForecastRequest(clientIp)) {
        sendJson(response, 429, { error: "Too many forecast requests. Please try again shortly." });
        return;
      }

      const location = requestUrl.searchParams.get("location")?.trim();
      const latitudeParam = requestUrl.searchParams.get("lat");
      const longitudeParam = requestUrl.searchParams.get("lon");
      const hasCoordinates = latitudeParam !== null || longitudeParam !== null;
      let coordinates;
      if (hasCoordinates) {
        const latitude = Number(latitudeParam);
        const longitude = Number(longitudeParam);
        if (location || latitudeParam === null || longitudeParam === null || latitudeParam.trim() === "" || longitudeParam.trim() === "" ||
          !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          sendJson(response, 400, { error: "The current-location coordinates are invalid." });
          return;
        }
        coordinates = { latitude, longitude };
      } else if (!location || location.length > 100) {
        sendJson(response, 400, { error: "Enter a location up to 100 characters long." });
        return;
      }

      if (!process.env.INFOPLAZA_API_KEY) {
        sendJson(response, 503, { error: "Forecast setup is incomplete. Configure INFOPLAZA_API_KEY and restart the server." });
        return;
      }

      const cacheKey = forecastCacheKey(location, coordinates);
      const cachedResult = getCachedForecast(cacheKey);
      if (cachedResult) {
        sendJson(response, 200, cachedResult);
        return;
      }
      try {
        const result = await getForecast(location, coordinates);
        if (!result) {
          sendJson(response, 404, { error: "We couldn't find that place. Try a nearby city." });
          return;
        }
        cacheForecast(cacheKey, result);
        sendJson(response, 200, result);
      } catch (error) {
        console.error("Forecast request failed:", error.message);
        sendJson(response, 502, { error: "Weather data could not be reached. Please try again." });
      }
      return;
    }

    const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
    if (filePath !== publicDirectory && !filePath.startsWith(`${publicDirectory}${path.sep}`)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    try {
      const content = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=31536000",
        "Content-Security-Policy": "default-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com/leaflet@1.9.4/; script-src 'self' https://unpkg.com/leaflet@1.9.4/; img-src 'self' data: https://unpkg.com/leaflet@1.9.4/ https://*.tile.openstreetmap.org; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      response.end(content);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  } catch (error) {
    console.error("Request failed:", error instanceof Error ? error.message : String(error));
    if (response.headersSent || response.destroyed) {
      response.destroy();
      return;
    }
    sendJson(response, 500, { error: "The request could not be completed." });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Fietsweer listening on port ${port}`));