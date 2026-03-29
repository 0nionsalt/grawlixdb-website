const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://', 'https://grawlixdb-website.grawlixcinema.workers.dev', 'https://grawlixdb-website.pages.dev'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Serve static files (your existing HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Steam API proxy endpoint
app.get('/api/steam/*', async (req, res) => {
  try {
    const steamApiPath = req.params[0];
    const steamApiUrl = `https://api.steampowered.com/${steamApiPath}`;
    
    console.log(`Proxying request to: ${steamApiUrl}`);
    
    const response = await fetch(steamApiUrl);
    
    if (!response.ok) {
      throw new Error(`Steam API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from Steam API',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TF2 Cheater DB Proxy Server running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname)}`);
  console.log(`🔗 Steam API proxy: http://localhost:${PORT}/api/steam/`);
  console.log(`🌐 Open http://localhost:${PORT} to view your app`);
});
