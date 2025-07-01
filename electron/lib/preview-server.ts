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
    try {
      const url = new URL(req.url || '/', `http://localhost:${currentPort}`)
      
      if (url.pathname === '/' || url.pathname === '/index.html') {
        // Serve the main HTML file
        const html = generateIndexHtml(files)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } else if (url.pathname.startsWith('/components/')) {
        // Serve component files
        const filename = url.pathname.replace('/components/', '')
        const file = files.find(f => f.filename === filename)
        
        if (file) {
          res.writeHead(200, { 'Content-Type': 'application/javascript' })
          res.end(file.content)
        } else {
          res.writeHead(404)
          res.end('Component not found')
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    } catch (error) {
      console.error('Server error:', error)
      res.writeHead(500)
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
  <title>FlowGenius Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  
  <!-- Router and State utilities -->
  <script>
    window.Router = {
      currentRoute: 'home',
      listeners: [],
      navigate: function(route) {
        this.currentRoute = route;
        this.listeners.forEach(fn => fn(route));
        // Trigger React re-render if using React 18
        if (window._reactRoot) {
          window._reactRoot.render(React.createElement(window.App));
        }
      },
      getCurrentRoute: function() {
        return this.currentRoute;
      },
      onRouteChange: function(callback) {
        this.listeners.push(callback);
        return () => {
          this.listeners = this.listeners.filter(fn => fn !== callback);
        };
      }
    };
    
    window.AppState = {
      state: {},
      set: function(key, value) {
        this.state[key] = value;
      },
      get: function(key) {
        return this.state[key];
      }
    };
    
    // Mock Router methods that might be missing
    window.Router.offRouteChange = function(callback) {
      if (callback) {
        this.listeners = this.listeners.filter(fn => fn !== callback);
      }
    }; // Compatibility
  </script>
  
  <!-- Load Components -->
  ${sortedFiles.map(f => `<script src="/components/${f.filename}"></script>`).join('\n  ')}
  
  <!-- Mount App -->
  <script>
    // Wait for all components to load
    window.addEventListener('load', () => {
      if (window.App) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        window._reactRoot = root; // Store for re-renders
        root.render(React.createElement(window.App));
      } else {
        console.error('App component not found! Make sure window.App is defined.');
        document.getElementById('root').innerHTML = '<div style="padding: 20px; color: red;">Error: App component not found</div>';
      }
    });
  </script>
</body>
</html>`
} 