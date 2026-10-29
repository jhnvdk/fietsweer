const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const port = Number(process.env.PORT) || 8080;
const publicDirectory = path.join(__dirname, "public");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function getForecast(location) {
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.search = new URLSearchParams({ count: "1", language: "en", name: location, format: "json" });
  const geocodingResponse = await fetch(geocodingUrl, { signal: AbortSignal.timeout(10000) });
  if (!geocodingResponse.ok) throw new Error("Location search is temporarily unavailable.");

  const place = (await geocodingResponse.json()).results?.[0];
  if (!place) return null;

  const apiKey = process.env.INFOPLAZA_API_KEY;

  const forecastUrl = new URL("https://api.infoplaza.com/v1/weather/forecast");
  forecastUrl.search = new URLSearchParams({
    lat: String(place.latitude),
    lon: String(place.longitude),
    api_key: apiKey,
    units: "metric",
    max_daily: "5",
    language: "en",
  });
  const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(10000) });
  if (!forecastResponse.ok) throw new Error("The forecast is temporarily unavailable.");

  return {
    place: { name: place.name, admin1: place.admin1, country: place.country, timezone: place.timezone },
    forecast: await forecastResponse.json(),
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
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" });
    response.end("Method not allowed");
    return;
  }

  if (requestUrl.pathname === "/api/forecast") {
    const location = requestUrl.searchParams.get("location")?.trim();
    if (!location || location.length > 100) {
      sendJson(response, 400, { error: "Enter a location up to 100 characters long." });
      return;
    }
    if (!process.env.INFOPLAZA_API_KEY) {
      sendJson(response, 503, { error: "Forecast setup is incomplete. Configure INFOPLAZA_API_KEY and restart the server." });
      return;
    }
    try {
      const result = await getForecast(location);
      if (!result) {
        sendJson(response, 404, { error: "We couldn't find that place. Try a nearby city." });
        return;
      }
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
      "Content-Security-Policy": "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:",
      "Referrer-Policy": "no-referrer",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Fietsweer listening on port ${port}`));