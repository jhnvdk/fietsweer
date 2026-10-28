# Fietsweer

A responsive weather site for choosing the next good day to ride. Enter a city to see current conditions and a five-day outlook, including high and low temperatures, rain chance, and wind.

Weather and geocoding data come from [Open-Meteo](https://open-meteo.com/). No API key or application dependencies are required. The server uses Node.js built-in HTTP and `fetch` APIs.

## Run locally

Requires Node.js 20 or newer.

```sh
npm start
```

Open http://localhost:8080. For automatic restarts while editing, run `npm run dev`.

Run the syntax checks with `npm run check`.

## Deploy to Fly.io

Install and sign in to the [Fly CLI](https://fly.io/docs/flyctl/install/), then run from this directory:

```sh
fly launch --no-deploy
fly deploy
```

The included `fly.toml` uses the Amsterdam region and app name `fietsweer-jhnvdk`. Change its `app` value if that name is already taken. Fly builds the included Dockerfile; no secrets or environment variables are needed.

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