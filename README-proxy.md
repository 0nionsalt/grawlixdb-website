# TF2 Cheater DB Proxy Server

This proxy server handles CORS issues when making requests to the Steam API from your browser-based application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage

Once the server is running, open your browser and go to:
- http://localhost:3001 - Your TF2 Cheater DB application
- http://localhost:3001/health - Server health check

The Steam API requests will now be proxied through:
- http://localhost:3001/api/steam/

## How it works

The proxy server:
1. Serves your static files (HTML, CSS, JS)
2. Intercepts Steam API requests and forwards them
3. Handles CORS headers automatically
4. Logs requests for debugging

## Steam API Endpoints

The proxy will forward any request to `/api/steam/*` to `https://api.steampowered.com/*`

Example:
- Request: `/api/steam/ISteamUser/GetPlayerSummaries/v0002/?key=YOUR_KEY&steamids=76561197960265728`
- Becomes: `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=YOUR_KEY&steamids=76561197960265728`

## Environment Variables

- `PORT`: Server port (default: 3001)

## Troubleshooting

1. Make sure port 3001 is not in use
2. Check the console output for error messages
3. Verify your Steam API key is valid
4. Test the health endpoint: http://localhost:3001/health
