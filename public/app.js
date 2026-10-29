const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");
const currentLocationButton = document.querySelector("#current-location-button");
const dayWeatherDialog = document.querySelector("#day-weather-dialog");
const countryMapButtons = [...document.querySelectorAll(".country-map-button")];
const overviewMapDialog = document.querySelector("#overview-map-dialog");
const overviewMapElement = document.querySelector("#overview-map");
const overviewMapStatus = document.querySelector("#overview-map-status");
const overviewMapDay = document.querySelector("#overview-map-day");
const mapCountries = {
  netherlands: {
    name: "Nederland",
    timezone: "Europe/Amsterdam",
    capitals: [
      { province: "Groningen", name: "Groningen", latitude: 53.2194, longitude: 6.5665 },
      { province: "Friesland", name: "Leeuwarden", latitude: 53.2012, longitude: 5.7999 },
      { province: "Drenthe", name: "Assen", latitude: 52.9925, longitude: 6.5642 },
      { province: "Overijssel", name: "Zwolle", latitude: 52.5168, longitude: 6.0830 },
      { province: "Flevoland", name: "Lelystad", latitude: 52.5185, longitude: 5.4714 },
      { province: "Gelderland", name: "Arnhem", latitude: 51.9851, longitude: 5.8987 },
      { province: "Utrecht", name: "Utrecht", latitude: 52.0907, longitude: 5.1214 },
      { province: "Noord-Holland", name: "Haarlem", latitude: 52.3874, longitude: 4.6462 },
      { province: "Zuid-Holland", name: "Den Haag", latitude: 52.0705, longitude: 4.3007 },
      { province: "Zeeland", name: "Middelburg", latitude: 51.4988, longitude: 3.6100 },
      { province: "Noord-Brabant", name: "'s-Hertogenbosch", latitude: 51.6978, longitude: 5.3037 },
      { province: "Limburg", name: "Maastricht", latitude: 50.8514, longitude: 5.6910 },
    ],
  },
  belgium: {
    name: "België",
    timezone: "Europe/Brussels",
    capitals: [
      { province: "Antwerpen", name: "Antwerpen", latitude: 51.2194, longitude: 4.4025 },
      { province: "Limburg", name: "Hasselt", latitude: 50.9307, longitude: 5.3325 },
      { province: "Oost-Vlaanderen", name: "Gent", latitude: 51.0543, longitude: 3.7174 },
      { province: "Vlaams-Brabant", name: "Leuven", latitude: 50.8798, longitude: 4.7005 },
      { province: "West-Vlaanderen", name: "Brugge", latitude: 51.2093, longitude: 3.2247 },
      { province: "Waals-Brabant", name: "Waver", latitude: 50.7172, longitude: 4.6120 },
      { province: "Henegouwen", name: "Bergen", latitude: 50.4542, longitude: 3.9523 },
      { province: "Luik", name: "Luik", latitude: 50.6326, longitude: 5.5797 },
      { province: "Luxemburg", name: "Aarlen", latitude: 49.6833, longitude: 5.8167 },
      { province: "Namen", name: "Namen", latitude: 50.4674, longitude: 4.8718 },
    ],
  },
};
const overviewForecasts = new Map();
let overviewMap;
let overviewMapMarkers;
let activeMapCountryKey;
let activeMapCountry;

function formatDay(timestamp, timezone, options) {
  return new Intl.DateTimeFormat("nl-NL", { ...options, timeZone: timezone }).format(new Date(timestamp * 1000));
}

function locationLabel(place) {
  return [place.name, place.admin1, place.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
}

function windDirection(bearing) {
  if (!Number.isFinite(bearing)) return null;
  const directions = [
    ["N", "noorden"], ["NO", "noordoosten"], ["O", "oosten"], ["ZO", "zuidoosten"],
    ["Z", "zuiden"], ["ZW", "zuidwesten"], ["W", "westen"], ["NW", "noordwesten"],
  ];
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  return directions[Math.round(normalizedBearing / 45) % directions.length];
}

function beaufortForce(speedKmh) {
  if (!Number.isFinite(speedKmh) || speedKmh < 0) return null;
  const thresholds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const force = thresholds.findIndex((threshold) => speedKmh < threshold);
  return force === -1 ? 12 : force;
}

function formatPrecipitationIntensity(value) {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(value);
}

function formatWeatherValue(value, suffix = "", digits = 0) {
  if (!Number.isFinite(value)) return "Onbekend";
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: digits }).format(value)}${suffix}`;
}

function describeDayWeather(day) {
  const precipitation = day.precipType === "snow" ? "Sneeuw" : day.precipType === "sleet" ? "Natte sneeuw" : day.precipType === "hail" ? "Hagel" : "Regen";
  if (day.precipProbability >= 0.6 && day.precipIntensity >= 1) return `${precipitation} verwacht`;
  if (day.precipProbability >= 0.3 && day.precipIntensity > 0) return `${precipitation} mogelijk`;
  if (day.cloudCover >= 0.8) return "Overwegend bewolkt";
  if (day.cloudCover >= 0.45) return "Gedeeltelijk bewolkt";
  if (day.cloudCover >= 0.15) return "Licht bewolkt";
  return "Overwegend zonnig";
}

function openDayWeather(day, timezone) {
  const direction = windDirection(day.windBearing);
  const force = beaufortForce(day.windSpeed);
  const title = formatDay(day.time, timezone, { weekday: "long", day: "numeric", month: "long" });
  document.querySelector("#day-weather-title").textContent = title;
  document.querySelector("#day-weather-summary").textContent = describeDayWeather(day);

  const metrics = [
    ["Maximumtemperatuur", formatWeatherValue(day.temperatureHigh, " °C")],
    ["Minimumtemperatuur", formatWeatherValue(day.temperatureLow, " °C")],
    ["Gevoelstemperatuur", formatWeatherValue(day.apparentTemperature, " °C", 1)],
    ["Wind", `${direction ? `Uit het ${direction[1]}` : "Richting onbekend"} · ${force === null ? "Beaufort onbekend" : `Beaufort ${force}`}`],
    ["Neerslagkans", formatWeatherValue(day.precipProbability * 100, "%")],
    ["Neerslagintensiteit", formatWeatherValue(day.precipIntensity, " mm/u", 1)],
    ["Bewolking", formatWeatherValue(day.cloudCover * 100, "%")],
    ["Luchtvochtigheid", formatWeatherValue(day.humidity * 100, "%")],
    ["Dauwpunt", formatWeatherValue(day.dewPoint, " °C", 1)],
    ["Luchtdruk", formatWeatherValue(day.pressure, " hPa", 1)],
    ["UV-index", formatWeatherValue(day.uvIndex, "", 1)],
    ["Zonnestraling", formatWeatherValue(day.globalRadiationSum, " Wh/m²")],
  ];
  if (Number.isFinite(day.windGust)) {
    metrics.splice(4, 0, ["Windstoten", `Beaufort ${beaufortForce(day.windGust)}`]);
  }
  const details = document.querySelector("#day-weather-details");
  details.replaceChildren(...metrics.flatMap(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    return [term, description];
  }));
  dayWeatherDialog.showModal();
}

function scoreRideWeather(temperature, wind, rainProbability, rainIntensity, precipType) {
  let penalty = temperature < 10 || temperature > 32 ? 3
    : temperature < 14 || temperature > 28 ? 2
      : temperature < 16 || temperature > 24 ? 1
        : 0;
  penalty += Math.round(Math.min(4, 3 * rainProbability + 1.5 * Math.min(rainIntensity / 2, 1)));

  let windPenalty = wind >= 35 ? 3 : wind >= 25 ? 2 : wind >= 15 ? 1 : 0;
  if (["snow", "sleet", "hail"].includes(precipType) && (rainProbability >= 0.2 || rainIntensity > 0.1)) penalty += 2;
  if (temperature <= 0 && rainIntensity > 0.1) penalty += 1;
  penalty += windPenalty;
  return Math.max(1, Math.min(10, 10 - penalty));
}

function initializeOverviewMap() {
  overviewMap = L.map(overviewMapElement, { scrollWheelZoom: false }).setView([51.5, 5], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-bijdragers</a>',
  }).addTo(overviewMap);
  overviewMapMarkers = L.layerGroup().addTo(overviewMap);
}

function updateOverviewMapMarkers(dayIndex) {
  overviewMapMarkers.clearLayers();
  const countryForecasts = activeMapCountry.capitals.map((capital) => overviewForecasts.get(`${activeMapCountryKey}:${capital.province}`));
  const dateForecast = countryForecasts.find((data) => data?.forecast.daily[dayIndex]);
  if (!dateForecast) return;
  const selectedDay = dateForecast.forecast.daily[dayIndex];
  const selectedDate = formatDay(selectedDay.time, dateForecast.forecast.timezone || activeMapCountry.timezone, {
    weekday: "long", day: "numeric", month: "long",
  });

  for (const capital of activeMapCountry.capitals) {
    const data = overviewForecasts.get(`${activeMapCountryKey}:${capital.province}`);
    const day = data?.forecast.daily[dayIndex];
    if (!day) continue;
    const score = scoreRideWeather(day.apparentTemperature, day.windSpeed, day.precipProbability, day.precipIntensity, day.precipType);
    if (!Number.isFinite(score)) continue;
    const scoreClass = score < 6 ? "is-low" : score < 8 ? "is-medium" : "";
    const marker = L.marker([capital.latitude, capital.longitude], {
      title: `${capital.province}, ${capital.name}: fietsscore ${score} van 10`,
      icon: L.divIcon({
        className: "overview-score-marker",
        html: `<span class="overview-score-badge ${scoreClass}">${score}</span>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      }),
    });
    const popup = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = `${capital.name} · ${capital.province}`;
    const scoreText = document.createElement("p");
    scoreText.textContent = `Fietsscore ${score} van 10 · ${selectedDate}`;
    const weatherText = document.createElement("p");
    weatherText.textContent = `${describeDayWeather(day)} · maximaal ${formatWeatherValue(day.temperatureHigh, " °C")}`;
    popup.append(heading, scoreText, weatherText);
    marker.bindPopup(popup).addTo(overviewMapMarkers);
  }
  const loadedCount = countryForecasts.filter((data) => Array.isArray(data?.forecast.daily) && data.forecast.daily.length).length;
  overviewMapStatus.textContent = `${selectedDate} · fietsscore in ${loadedCount} van de ${activeMapCountry.capitals.length} hoofdsteden`;
}

async function loadOverviewForecasts() {
  const missingCapitals = activeMapCountry.capitals.filter((capital) => !overviewForecasts.has(`${activeMapCountryKey}:${capital.province}`));
  if (missingCapitals.length) {
    overviewMapStatus.textContent = `Weer ophalen voor ${missingCapitals.length} hoofdsteden…`;
    await Promise.all(missingCapitals.map(async (capital) => {
      try {
        const query = new URLSearchParams({ lat: String(capital.latitude), lon: String(capital.longitude) });
        const response = await fetch(`/api/forecast?${query}`);
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.forecast?.daily)) throw new Error("Forecast unavailable");
        overviewForecasts.set(`${activeMapCountryKey}:${capital.province}`, data);
      } catch {
        return;
      }
    }));
  }

  const availableForecasts = activeMapCountry.capitals
    .map((capital) => overviewForecasts.get(`${activeMapCountryKey}:${capital.province}`))
    .filter((data) => Array.isArray(data?.forecast.daily) && data.forecast.daily.length);
  if (availableForecasts.length === 0) {
    overviewMapStatus.textContent = "De weerscores konden niet worden geladen. Sluit de kaart en probeer het opnieuw.";
    return;
  }

  const previousDayIndex = Number(overviewMapDay.value) || 0;
  const firstForecast = availableForecasts[0].forecast;
  overviewMapDay.replaceChildren(...firstForecast.daily.map((day, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = formatDay(day.time, firstForecast.timezone || activeMapCountry.timezone, {
      weekday: "short", day: "numeric", month: "short",
    });
    return option;
  }));
  overviewMapDay.disabled = false;
  overviewMapDay.value = String(Math.min(previousDayIndex, firstForecast.daily.length - 1));
  updateOverviewMapMarkers(Number(overviewMapDay.value) || 0);
}

async function openOverviewMap(countryKey) {
  activeMapCountryKey = countryKey;
  activeMapCountry = mapCountries[countryKey];
  document.querySelector("#overview-map-title").textContent = activeMapCountry.name;
  overviewMapElement.setAttribute("aria-label", `Kaart van ${activeMapCountry.name} met fietsscores per provinciehoofdstad`);
  overviewMapDialog.showModal();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!window.L) {
    overviewMapStatus.textContent = "De kaart kon niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.";
    return;
  }
  if (!overviewMap) initializeOverviewMap();
  overviewMap.invalidateSize();
  overviewMap.fitBounds(L.latLngBounds(activeMapCountry.capitals.map((capital) => [capital.latitude, capital.longitude])), {
    padding: [30, 30],
    maxZoom: 7,
  });
  await loadOverviewForecasts();
}

countryMapButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    countryMapButtons.forEach((mapButton) => { mapButton.disabled = true; });
    try {
      await openOverviewMap(button.dataset.country);
    } finally {
      countryMapButtons.forEach((mapButton) => { mapButton.disabled = false; });
    }
  });
});

overviewMapDay.addEventListener("change", () => updateOverviewMapMarkers(Number(overviewMapDay.value)));

function renderForecast(data) {
  const { daily } = data.forecast;
  const timezone = data.forecast.timezone || data.place.timezone || "UTC";
  document.querySelector("#place-name").textContent = locationLabel(data.place);
  const dayHeadings = daily.map((dayData) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = formatDay(dayData.time, timezone, { weekday: "short" }).replace(/\.$/, "");
    return heading;
  });
  document.querySelector("#score-days").replaceChildren(...dayHeadings);
  const scores = daily.map((dayData) => {
    const score = scoreRideWeather(dayData.apparentTemperature, dayData.windSpeed, dayData.precipProbability, dayData.precipIntensity, dayData.precipType);
    const cell = document.createElement("td");
    const value = document.createElement("strong");
    value.className = "score-value";
    if (score < 6) value.classList.add("is-low");
    else if (score < 8) value.classList.add("is-medium");
    value.setAttribute("aria-label", `Fietsscore: ${score} van de 10`);
    value.textContent = String(score);
    const direction = windDirection(dayData.windBearing);
    const force = beaufortForce(dayData.windSpeed);
    const rainProbability = Number.isFinite(dayData.precipProbability)
      ? Math.round(dayData.precipProbability * 100)
      : null;
    const rainIntensity = formatPrecipitationIntensity(dayData.precipIntensity);
    const details = document.createElement("span");
    details.className = "weather-details";
    const wind = document.createElement("span");
    wind.className = "weather-wind";
    wind.textContent = `${direction?.[0] || "—"} · Bft ${force ?? "—"}`;
    const rain = document.createElement("span");
    rain.className = "weather-rain";
    const rainIcon = document.createElement("span");
    rainIcon.setAttribute("aria-hidden", "true");
    rainIcon.textContent = "☂";
    rain.append(rainIcon, document.createTextNode(` ${rainProbability ?? "—"}%`));
    details.append(wind, rain);
    const weekday = formatDay(dayData.time, timezone, { weekday: "long" });
    const accessibleWind = direction
      ? `wind uit het ${direction[1]}`
      : "windrichting onbekend";
    const accessibleForce = force === null ? "windkracht onbekend" : `Beaufort ${force}`;
    const accessibleRain = rainProbability === null ? "regenkans onbekend" : `regenkans ${rainProbability} procent`;
    const accessibleIntensity = rainIntensity === null ? "neerslagintensiteit onbekend" : `neerslagintensiteit ${rainIntensity} millimeter per uur`;
    const weatherDescription = `${accessibleWind}, ${accessibleForce}; ${accessibleRain}; ${accessibleIntensity}`;
    cell.setAttribute("aria-label", `${weekday}: ${score} van 10; ${weatherDescription}`);
    cell.title = weatherDescription;
    const content = document.createElement("button");
    content.type = "button";
    content.className = "score-cell-content";
    content.setAttribute("aria-haspopup", "dialog");
    content.setAttribute("aria-label", `Bekijk volledig weerbericht voor ${weekday}, fietsscore ${score} van 10`);
    content.append(value, details);
    content.addEventListener("click", () => openDayWeather(dayData, timezone));
    cell.append(content);
    return cell;
  });
  document.querySelector("#cycling-scores").replaceChildren(...scores);
  results.hidden = false;
}

function getCurrentPosition() {
  if (!window.isSecureContext) {
    throw new Error("Locatietoegang werkt alleen via een beveiligde HTTPS-verbinding.");
  }
  if (!navigator.geolocation) {
    throw new Error("Je browser ondersteunt geen locatietoegang.");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      const messages = {
        1: "Geef toestemming voor locatietoegang in je browserinstellingen.",
        2: "Je locatie kon niet worden bepaald. Probeer het opnieuw.",
        3: "Het bepalen van je locatie duurde te lang. Probeer het opnieuw.",
      };
      reject(new Error(messages[error.code] || "Je locatie kon niet worden bepaald."));
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  });
}

async function runForecastAction(button, loadingText, getUrl) {
  const label = button.querySelector(".button-label");
  const originalLabel = label.textContent;
  button.disabled = true;
  label.textContent = loadingText;
  statusMessage.textContent = "";
  statusMessage.classList.remove("is-error");
  results.hidden = true;
  try {
    const response = await fetch(await getUrl());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    renderForecast(data);
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
  } finally {
    button.disabled = false;
    label.textContent = originalLabel;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const location = input.value.trim();
  if (!location) return;
  await runForecastAction(form.querySelector("button[type=submit]"), "Bezig…", () =>
    `/api/forecast?location=${encodeURIComponent(location)}`,
  );
});

currentLocationButton.addEventListener("click", async () => {
  await runForecastAction(currentLocationButton, "Locatie bepalen…", async () => {
    const position = await getCurrentPosition();
    const query = new URLSearchParams({
      lat: String(position.coords.latitude),
      lon: String(position.coords.longitude),
    });
    return `/api/forecast?${query}`;
  });
});