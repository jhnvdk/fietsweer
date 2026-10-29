const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");
const currentLocationButton = document.querySelector("#current-location-button");

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
  document.querySelector("#score-days").replaceChildren(
    document.querySelector(".activity-heading"),
    ...dayHeadings,
  );
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
    const content = document.createElement("span");
    content.className = "score-cell-content";
    content.append(value, details);
    cell.append(content);
    return cell;
  });
  document.querySelector("#cycling-scores").replaceChildren(
    document.querySelector(".activity-name"),
    ...scores,
  );
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