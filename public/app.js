const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");
const forecastList = document.querySelector("#forecast-list");

function describeConditions(cloudCover, precipIntensity, precipProbability = 0, precipType = "rain") {
  if (precipIntensity >= 0.1 || (precipProbability >= 0.6 && precipIntensity > 0)) {
    const winterWeather = ["snow", "sleet", "hail"].includes(precipType);
    return [winterWeather ? `${precipType[0].toUpperCase()}${precipType.slice(1)} possible` : "Rain possible", winterWeather ? "❄" : "☂"];
  }
  if (cloudCover >= 0.8) return ["Overcast", "☁"];
  if (cloudCover >= 0.45) return ["Partly cloudy", "⛅"];
  if (cloudCover >= 0.15) return ["Mostly clear", "🌤"];
  return ["Clear", "☀"];
}

function formatTemperature(value) {
  return `${Math.round(value)}°`;
}

function formatDay(timestamp, timezone, options) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(new Date(timestamp * 1000));
}

function locationLabel(place) {
  return [place.name, place.admin1, place.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
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
  const { currently: current, daily } = data.forecast;
  const timezone = data.forecast.timezone || data.place.timezone || "UTC";
  const [description, icon] = describeConditions(current.cloudCover, current.precipIntensity);
  document.querySelector("#place-name").textContent = locationLabel(data.place);
  document.querySelector("#forecast-dates").textContent = `${formatDay(daily[0].time, timezone, { month: "short", day: "numeric" })} – ${formatDay(daily.at(-1).time, timezone, { month: "short", day: "numeric" })}`;
  document.querySelector("#current-day").textContent = formatDay(current.time, timezone, { weekday: "long" });
  document.querySelector("#current-icon").textContent = icon;
  document.querySelector("#current-temp").textContent = formatTemperature(current.temperature);
  document.querySelector("#current-description").textContent = description;
  document.querySelector("#feels-like").textContent = formatTemperature(current.apparentTemperature);
  document.querySelector("#current-wind").textContent = `${Math.round(current.windSpeed)} km/h`;
  document.querySelector("#humidity").textContent = `${Math.round(current.humidity * 100)}%`;

  forecastList.replaceChildren(...daily.map((dayData, index) => {
    const [dayDescription, dayIcon] = describeConditions(dayData.cloudCover, dayData.precipIntensity, dayData.precipProbability, dayData.precipType);
    const row = document.createElement("article");
    row.className = "forecast-row";
    const day = document.createElement("span");
    day.className = "forecast-day";
    day.textContent = index === 0 ? "Today" : formatDay(dayData.time, timezone, { weekday: "short" });
    const weather = document.createElement("span");
    weather.className = "forecast-condition";
    const symbol = document.createElement("span");
    symbol.className = "forecast-symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = dayIcon;
    const label = document.createElement("span");
    label.textContent = dayDescription;
    weather.append(symbol, label);
    const rain = document.createElement("span");
    rain.className = "forecast-rain";
    rain.textContent = `${Math.round(dayData.precipProbability * 100)}% rain`;
    const temperature = document.createElement("span");
    temperature.className = "forecast-temperature";
    const high = document.createElement("strong");
    high.textContent = formatTemperature(dayData.temperatureHigh);
    const low = document.createElement("span");
    low.textContent = formatTemperature(dayData.temperatureLow);
    temperature.append(high, low);
    row.append(day, weather, rain, temperature);
    const rideScore = document.createElement("span");
    rideScore.className = "forecast-score";
    const score = scoreRideWeather(dayData.apparentTemperature, dayData.windSpeed, dayData.precipProbability, dayData.precipIntensity, dayData.precipType);
    rideScore.textContent = String(score);
    rideScore.setAttribute("aria-label", `Cycling score: ${score} out of 10`);
    rideScore.title = `Cycling score: ${score} out of 10`;
    row.append(rideScore);
    return row;
  }));
  results.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const location = input.value.trim();
  if (!location) return;
  const button = form.querySelector("button");
  button.disabled = true;
  button.querySelector("span:first-child").textContent = "Finding your forecast…";
  statusMessage.textContent = "Checking the skies…";
  statusMessage.classList.remove("is-error");
  results.hidden = true;
  try {
    const response = await fetch(`/api/forecast?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    renderForecast(data);
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.classList.add("is-error");
  } finally {
    button.disabled = false;
    button.querySelector("span:first-child").textContent = "Find forecast";
  }
});