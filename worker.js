// Cloudflare Worker for Steam API Proxy
const STEAM_API_KEY = "697576621005E7075600828CE6273B4F";

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  }

  // Handle Steam API proxy requests
  if (url.pathname.startsWith('/api/steam/')) {
    try {
      const steamApiPath = url.pathname.replace('/api/steam/', '') + url.search
      // Replace the placeholder key with the actual Steam API key
      const steamApiUrl = steamApiPath.replace('key=REMOVED', `key=${STEAM_API_KEY}`)
      const finalUrl = `https://api.steampowered.com/${steamApiUrl}`
      
      console.log(`Proxying request to: ${finalUrl.replace(/key=[^&]+/, 'key=***')}`)
      
      const response = await fetch(finalUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'GrawlixDB-Proxy/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Steam API returned ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
      
    } catch (error) {
      console.error('Proxy error:', error)
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch from Steam API',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }

  // Default response for other routes
  return new Response('Steam API Proxy Worker', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
