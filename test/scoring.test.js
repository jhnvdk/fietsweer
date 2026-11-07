const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreRideWeather, describeDayWeather, enrichForecast } = require("../lib/scoring");

test("scoreRideWeather matches the original web thresholds", () => {
  const cases = [
    // [temperature, wind, rainProbability, rainIntensity, precipType, expected]
    [20, 5, 0, 0, "rain", 10],
    [15, 5, 0, 0, "rain", 9],
    [12, 18, 0, 0, "rain", 7],
    [8, 30, 0.5, 1, "rain", 3],
    [22, 10, 1, 3, "rain", 6],
    [-2, 40, 0.8, 2, "snow", 1],
    [30, 26, 0.1, 0, "rain", 6],
    [35, 0, 0, 0, "rain", 7],
  ];
  for (const [temperature, wind, probability, intensity, type, expected] of cases) {
    assert.equal(scoreRideWeather(temperature, wind, probability, intensity, type), expected, JSON.stringify({ temperature, wind, probability, intensity, type }));
  }
});

test("describeDayWeather picks rain before clouds", () => {
  assert.equal(describeDayWeather({ precipType: "rain", precipProbability: 0.7, precipIntensity: 2, cloudCover: 1 }), "Regen verwacht");
  assert.equal(describeDayWeather({ precipType: "snow", precipProbability: 0.4, precipIntensity: 0.2, cloudCover: 1 }), "Sneeuw mogelijk");
  assert.equal(describeDayWeather({ precipProbability: 0, precipIntensity: 0, cloudCover: 0.5 }), "Gedeeltelijk bewolkt");
  assert.equal(describeDayWeather({ precipProbability: 0, precipIntensity: 0, cloudCover: 0 }), "Overwegend zonnig");
});

test("enrichForecast adds score, uncertain and summary without changing the input", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  const day = (offset) => ({
    time: now / 1000 + offset * 86_400,
    apparentTemperature: 20, windSpeed: 5, precipProbability: 0, precipIntensity: 0, precipType: "rain", cloudCover: 0,
  });
  const input = { place: { name: "Utrecht" }, forecast: { timezone: "Europe/Amsterdam", daily: [day(0), day(7), day(8)] } };
  const output = enrichForecast(input, now);
  assert.deepEqual(output.forecast.daily.map((d) => d.uncertain), [false, false, true]);
  assert.deepEqual(output.forecast.daily.map((d) => d.score), [10, 10, 10]);
  assert.equal(output.forecast.daily[0].summary, "Overwegend zonnig");
  assert.equal(input.forecast.daily[0].score, undefined);
});
