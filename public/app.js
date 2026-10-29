const form = document.querySelector("#location-form");
const input = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const results = document.querySelector("#weather-results");

function formatDay(timestamp, timezone, options) {
  return new Intl.DateTimeFormat("nl-NL", { ...options, timeZone: timezone }).format(new Date(timestamp * 1000));
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
    cell.setAttribute("aria-label", `${formatDay(dayData.time, timezone, { weekday: "long" })}: ${score} van 10`);
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