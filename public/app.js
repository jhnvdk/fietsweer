const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");
const forecastList = document.querySelector("#forecast-list");

const weatherDescriptions = {
  0: ["Clear sky", "☀"], 1: ["Mostly clear", "🌤"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁"],
  45: ["Foggy", "〰"], 48: ["Rime fog", "〰"], 51: ["Light drizzle", "☂"], 53: ["Drizzle", "☂"],
  55: ["Heavy drizzle", "☂"], 56: ["Freezing drizzle", "❄"], 57: ["Freezing drizzle", "❄"],
  61: ["Light rain", "☂"], 63: ["Rain", "☂"], 65: ["Heavy rain", "☂"], 66: ["Freezing rain", "❄"],
  67: ["Freezing rain", "❄"], 71: ["Light snow", "❄"], 73: ["Snow", "❄"], 75: ["Heavy snow", "❄"],
  77: ["Snow grains", "❄"], 80: ["Light showers", "☂"], 81: ["Rain showers", "☂"],
  82: ["Heavy showers", "☂"], 85: ["Snow showers", "❄"], 86: ["Heavy snow showers", "❄"],
  95: ["Thunderstorm", "ϟ"], 96: ["Thunderstorm, hail", "ϟ"], 99: ["Thunderstorm, hail", "ϟ"],
};

function describeWeather(code) {
  return weatherDescriptions[code] || ["Conditions unavailable", "·"];
}

function formatTemperature(value) {
  return `${Math.round(value)}°`;
}

function formatDay(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${date}T12:00:00`));
}

function locationLabel(place) {
  return [place.name, place.admin1, place.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
}

function scoreRideWeather(temperature, wind, rainChance) {
  let score = temperature >= 18 ? 10 : temperature >= 15 ? 9 : temperature >= 12 ? 7 : temperature >= 9 ? 5 : temperature >= 5 ? 3 : 1;
  if (wind > 30) score -= 3;
  else if (wind > 20) score -= 2;
  else if (wind > 10) score -= 1;
  if (rainChance > 60) score -= 3;
  else if (rainChance > 30) score -= 2;
  else if (rainChance > 10) score -= 1;
  return Math.max(1, Math.min(10, score));
}

function renderForecast(data) {
  const { current, daily } = data.forecast;
  const [description, icon] = describeWeather(current.weather_code);
  const currentDate = current.time.slice(0, 10);
  document.querySelector("#place-name").textContent = locationLabel(data.place);
  document.querySelector("#forecast-dates").textContent = `${formatDay(daily.time[0], { month: "short", day: "numeric" })} – ${formatDay(daily.time[4], { month: "short", day: "numeric" })}`;
  document.querySelector("#current-day").textContent = formatDay(currentDate, { weekday: "long" });
  document.querySelector("#current-icon").textContent = icon;
  document.querySelector("#current-temp").textContent = formatTemperature(current.temperature_2m);
  document.querySelector("#current-description").textContent = description;
  document.querySelector("#feels-like").textContent = formatTemperature(current.apparent_temperature);
  document.querySelector("#current-wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  document.querySelector("#humidity").textContent = `${current.relative_humidity_2m}%`;

  forecastList.replaceChildren(...daily.time.map((date, index) => {
    const [dayDescription, dayIcon] = describeWeather(daily.weather_code[index]);
    const row = document.createElement("article");
    row.className = "forecast-row";
    const day = document.createElement("span");
    day.className = "forecast-day";
    day.textContent = index === 0 ? "Today" : formatDay(date, { weekday: "short" });
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
    rain.textContent = `${daily.precipitation_probability_max[index] ?? 0}% rain`;
    const temperature = document.createElement("span");
    temperature.className = "forecast-temperature";
    const high = document.createElement("strong");
    high.textContent = formatTemperature(daily.temperature_2m_max[index]);
    const low = document.createElement("span");
    low.textContent = formatTemperature(daily.temperature_2m_min[index]);
    temperature.append(high, low);
    row.append(day, weather, rain, temperature);
    const rideScore = document.createElement("span");
    rideScore.className = "forecast-score";
    if (index < 2) {
      const score = scoreRideWeather(
        daily.temperature_2m_max[index],
        daily.wind_speed_10m_max[index],
        daily.precipitation_probability_max[index] ?? 0,
      );
      rideScore.textContent = String(score);
      rideScore.setAttribute("aria-label", `Cycling score: ${score} out of 10`);
      rideScore.title = `Cycling score: ${score} out of 10`;
    }
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