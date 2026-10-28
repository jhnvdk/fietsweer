const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");

function formatDay(date, options) {
  return new Intl.DateTimeFormat("nl-NL", options).format(new Date(`${date}T12:00:00`));
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
  const dayHeadings = daily.time.map((date) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = formatDay(date, { weekday: "short" }).replace(/\.$/, "");
    return heading;
  });
  document.querySelector("#score-days").replaceChildren(
    document.querySelector(".activity-heading"),
    ...dayHeadings,
  );
  const scores = daily.time.map((date, index) => {
    const score = scoreRideWeather(
      daily.temperature_2m_max[index],
      daily.wind_speed_10m_max[index],
      daily.precipitation_probability_max[index] ?? 0,
    );
    const cell = document.createElement("td");
    const value = document.createElement("strong");
    value.className = "score-value";
    if (score < 6) value.classList.add("is-low");
    else if (score < 8) value.classList.add("is-medium");
    value.setAttribute("aria-label", `Fietsscore: ${score} van de 10`);
    value.textContent = String(score);
    cell.setAttribute("aria-label", `${formatDay(date, { weekday: "long" })}: ${score} van 10`);
    cell.append(value);
    return cell;
  });
  document.querySelector("#cycling-scores").replaceChildren(
    document.querySelector(".activity-name"),
    ...scores,
  );
  results.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const location = input.value.trim();
  if (!location) return;
  const button = form.querySelector("button");
  button.disabled = true;
  button.querySelector("span:first-child").textContent = "Bezig…";
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
    button.querySelector("span:first-child").textContent = "Toon fietsscore";
  }
});