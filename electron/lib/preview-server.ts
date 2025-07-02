import * as http from 'http'
import * as path from 'path'
import * as fs from 'fs/promises'
import { UIFile } from '../../src/types'

let server: http.Server | null = null
let currentPort = 0

export async function startPreviewServer(files: UIFile[]): Promise<{ port: number; url: string }> {
  // Stop existing server if running
  if (server) {
    await stopPreviewServer()
  }

  // Find an available port
  currentPort = await getAvailablePort()

  // Create HTTP server
  server = http.createServer(async (req, res) => {
    // Set permissive headers for all responses
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*'
    }
    
    try {
      const url = new URL(req.url || '/', `http://localhost:${currentPort}`)
      
      if (url.pathname === '/' || url.pathname === '/index.html') {
        // Serve the main HTML file
        const html = generateIndexHtml(files)
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          ...headers
        })
        res.end(html)
      } else if (url.pathname.startsWith('/components/')) {
        // Serve component files
        const filename = url.pathname.replace('/components/', '')
        const file = files.find(f => f.filename === filename)
        
        if (file) {
          res.writeHead(200, { 
            'Content-Type': 'application/javascript',
            ...headers
          })
          res.end(file.content)
        } else {
          res.writeHead(404, headers)
          res.end('Component not found')
        }
      } else {
        res.writeHead(404, headers)
        res.end('Not found')
      }
    } catch (error) {
      console.error('Server error:', error)
      res.writeHead(500, headers)
      res.end('Internal server error')
    }
  })

  await new Promise<void>((resolve) => {
    server!.listen(currentPort, () => {
      console.log(`Preview server running at http://localhost:${currentPort}`)
      resolve()
    })
  })

  return {
    port: currentPort,
    url: `http://localhost:${currentPort}`
  }
}

export async function stopPreviewServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        server = null
        currentPort = 0
        resolve()
      })
    })
  }
}

async function getAvailablePort(): Promise<number> {
  // Try ports starting from 3100
  const startPort = 3100
  const maxPort = 3200
  
  for (let port = startPort; port <= maxPort; port++) {
    if (await isPortAvailable(port)) {
      return port
    }
  }
  
  throw new Error('No available ports found')
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const testServer = http.createServer()
    
    testServer.once('error', () => {
      resolve(false)
    })
    
    testServer.once('listening', () => {
      testServer.close()
      resolve(true)
    })
    
    testServer.listen(port)
  })
}

function generateIndexHtml(files: UIFile[]): string {
  // Filter only JavaScript files (exclude .md, .html, etc)
  const jsFiles = files.filter(f => 
    f.filename.endsWith('.js') || 
    f.filename.endsWith('.jsx') || 
    f.filename.endsWith('.ts') || 
    f.filename.endsWith('.tsx')
  )
  
  const sortedFiles = [...jsFiles].sort((a, b) => {
    if (a.type === 'main' || a.filename.toLowerCase().includes('app')) return 1
    if (b.type === 'main' || b.filename.toLowerCase().includes('app')) return -1
    return 0
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loadout Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  ${sortedFiles.map(file => `<script>${file.content}</script>`).join('\n')}
  <script>
    // Mount the app after all components are loaded
    if (window.App) {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(window.App));
    } else {
      console.error('App component not found!');
    }
  </script>
</body>
</html>`
} 