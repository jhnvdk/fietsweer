// Cycling score logic shared by the web app and the iOS app.
// The server adds score, uncertain and summary to every forecast day, so both clients show the same numbers.

const uncertainAfterDays = 7;

function scoreRideWeather(temperature, wind, rainProbability, rainIntensity, precipType) {
  let penalty = temperature < 10 || temperature > 32 ? 3
    : temperature < 14 || temperature > 28 ? 2
      : temperature < 16 || temperature > 24 ? 1
        : 0;
  penalty += Math.round(Math.min(4, 3 * rainProbability + 1.5 * Math.min(rainIntensity / 2, 1)));

  const windPenalty = wind >= 35 ? 3 : wind >= 25 ? 2 : wind >= 15 ? 1 : 0;
  if (["snow", "sleet", "hail"].includes(precipType) && (rainProbability >= 0.2 || rainIntensity > 0.1)) penalty += 2;
  if (temperature <= 0 && rainIntensity > 0.1) penalty += 1;
  penalty += windPenalty;
  return Math.max(1, Math.min(10, 10 - penalty));
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

// "YYYY-MM-DD" for a unix timestamp in the given timezone.
function dateKey(timestamp, timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(timestamp * 1000));
}

function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

function safeTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "Europe/Amsterdam";
  }
}

// Returns a copy of the forecast result with score, uncertain and summary on each day.
// Called when sending, not when caching, so "uncertain" stays right after midnight.
function enrichForecast(result, now = Date.now()) {
  const timezone = safeTimezone(result.forecast.timezone || result.place.timezone || "Europe/Amsterdam");
  const today = dateKey(now / 1000, timezone);
  const daily = result.forecast.daily.map((day) => {
    const score = scoreRideWeather(day.apparentTemperature, day.windSpeed, day.precipProbability, day.precipIntensity, day.precipType);
    return {
      ...day,
      score: Number.isFinite(score) ? score : null,
      uncertain: daysBetween(today, dateKey(day.time, timezone)) > uncertainAfterDays,
      summary: describeDayWeather(day),
    };
  });
  return { ...result, forecast: { ...result.forecast, daily } };
}

module.exports = { scoreRideWeather, describeDayWeather, dateKey, daysBetween, enrichForecast, uncertainAfterDays };
