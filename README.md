# Fietsweer

A responsive cycling weather app. Choose a place to see cycling scores for the next five days.

Weather data comes from [Infoplaza](https://platform.infoplaza.com/reference/v1-weather-forecast), and location search uses [Open-Meteo](https://open-meteo.com/). The server uses Node.js built-in HTTP and `fetch` APIs.

## Run locally

Requires Node.js 20.18 or newer.

```sh
npm start
```

Put `INFOPLAZA_API_KEY=your_api_key` in the ignored `.env` file. Both `npm start` and `npm run dev` load it automatically. Open http://localhost:8080.

On Fly.io, the app reads `INFOPLAZA_API_KEY` from the existing Fly secret; no local `.env` file is needed in the image.

Run the syntax checks with `npm run check`.

## Deploy to Fly.io

Install and sign in to the [Fly CLI](https://fly.io/docs/flyctl/install/), then deploy from this directory:

```sh
fly deploy
```

The included `fly.toml` targets the existing app `fietsweer` in the Amsterdam region. Fly builds the included Dockerfile and injects its configured secrets at runtime.

## GitHub

After creating a GitHub repository, connect and push this project:

```sh
git init
git add .
git commit -m "Build Fietsweer weather forecast app"
git branch -M main
git remote add origin https://github.com/jhnvdk/fietsweer.git
git push -u origin main
```