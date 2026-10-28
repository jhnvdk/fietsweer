const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");

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
  const { daily } = data.forecast;
  document.querySelector("#place-name").textContent = locationLabel(data.place);
  document.querySelector("#score-list").replaceChildren(...daily.time.map((date, index) => {
    const score = scoreRideWeather(
      daily.temperature_2m_max[index],
      daily.wind_speed_10m_max[index],
      daily.precipitation_probability_max[index] ?? 0,
    );
    const card = document.createElement("article");
    card.className = "score-card";
    const day = document.createElement("span");
    day.className = "score-day";
    day.textContent = index === 0 ? "Today" : "Tomorrow";
    const dateLabel = document.createElement("span");
    dateLabel.className = "score-date";
    dateLabel.textContent = formatDay(date, { weekday: "long", month: "short", day: "numeric" });
    const value = document.createElement("strong");
    value.className = "score-value";
    value.setAttribute("aria-label", `Ride score: ${score} out of 10`);
    value.textContent = String(score);
    card.append(day, dateLabel, value);
    return card;
  }));
  results.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const location = input.value.trim();
  if (!location) return;
  const button = form.querySelector("button");
  button.disabled = true;
  button.querySelector("span:first-child").textContent = "Checking…";
  statusMessage.textContent = "";
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
    button.querySelector("span:first-child").textContent = "Show ride score";
  }
});