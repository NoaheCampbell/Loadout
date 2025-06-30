import { useState, useMemo, useEffect } from 'react'
import { Copy, Code2, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'

// Function to convert React-like JSX to static HTML
function convertToStaticHTML(code: string): string {
  if (!code) return ''
  
  try {
    // Remove imports
    let html = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
    
    // Remove TypeScript types
    html = html.replace(/:\s*\w+(\[\])?/g, '')
    html = html.replace(/interface\s+\w+\s*{[^}]*}/g, '')
    html = html.replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
    
    // Extract mock data
    const mockDataRegex = /const\s+(\w+)\s*=\s*(\[[^\]]+\]|{[^}]+})/g
    const mockData: Record<string, any> = {}
    let match
    while ((match = mockDataRegex.exec(html)) !== null) {
      try {
        // Simple eval alternative for arrays
        if (match[2].startsWith('[')) {
          mockData[match[1]] = JSON.parse(match[2].replace(/id:\s*(\d+)/g, '"id": $1')
            .replace(/(\w+):/g, '"$1":')
            .replace(/'/g, '"'))
        }
      } catch (e) {
        // Fallback for complex data
        mockData[match[1]] = [
          { id: 1, name: 'Item 1', title: 'Title 1' },
          { id: 2, name: 'Item 2', title: 'Title 2' }
        ]
      }
    }
    
    // Replace className with class
    html = html.replace(/className=/g, 'class=')
    
    // Replace {/* comments */} with <!-- comments -->
    html = html.replace(/{\/\*\s*(.*?)\s*\*\/}/g, '<!-- $1 -->')
    
    // Replace self-closing tags
    html = html.replace(/<(\w+)([^>]*?)\/>/g, '<$1$2></$1>')
    
    // Replace icon components with simple SVGs
    const iconRegex = /<(Search|User|Bell|Home|Settings|PlusCircle|MessageCircle|Pencil|Save|LogIn|Paperclip)\s*([^>]*?)><\/\1>/g
    html = html.replace(iconRegex, (match, iconName, props) => {
      const classMatch = props.match(/class="([^"]*)"/)
      const className = classMatch ? classMatch[1] : 'w-6 h-6'
      return `<svg class="${className}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>`
    })
    
    // Replace .map() iterations with static HTML
    html = html.replace(/{(\w+)\.map\([^)]+\)\s*=>\s*\(([\s\S]*?)\)\)}/g, (match, varName, template) => {
      const data = mockData[varName] || []
      return data.map((item: any) => {
        let itemHtml = template
        // Replace {item.property} with actual values
        itemHtml = itemHtml.replace(/{(\w+)\.(\w+)}/g, (m: string, obj: string, prop: string) => {
          return item[prop] || `${obj}.${prop}`
        })
        // Replace key={...} attributes
        itemHtml = itemHtml.replace(/\s*key={[^}]+}/g, '')
        return itemHtml
      }).join('\n')
    })
    
    // Extract the component's return statement
    const componentMatch = html.match(/return\s*\(([\s\S]*?)\);?\s*}/m)
    if (componentMatch) {
      html = componentMatch[1]
    }
    
    // Clean up any remaining JSX expressions
    html = html.replace(/{[^}]+}/g, '')
    
    // Wrap in basic HTML document
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    
    /* Tailwind-like utility classes */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-around { justify-content: space-around; }
    .gap-2 { gap: 0.5rem; }
    .gap-4 { gap: 1rem; }
    .p-4 { padding: 1rem; }
    .mb-4 { margin-bottom: 1rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .border { border: 1px solid #e5e7eb; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-gray-200 { border-color: #e5e7eb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-white { background-color: white; }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .text-lg { font-size: 1.125rem; }
    .font-semibold { font-weight: 600; }
    .w-6 { width: 1.5rem; }
    .h-6 { height: 1.5rem; }
    .h-screen { height: 100vh; }
    .overflow-y-auto { overflow-y: auto; }
    .fixed { position: fixed; }
    .bottom-0 { bottom: 0; }
    .left-0 { left: 0; }
    .right-0 { right: 0; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    
    /* Mobile responsive */
    @media (max-width: 640px) {
      .grid-cols-2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim()
  } catch (error) {
    console.error('Error converting to static HTML:', error)
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 20px; }
    .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h3>Preview Error</h3>
    <p>Could not generate preview. The component may have complex JavaScript that cannot be converted to static HTML.</p>
  </div>
</body>
</html>
    `
  }
}

// Component to handle iframe with blob URL
function PreviewIframe({ 
  code, 
  mode, 
  refreshKey,
  convertToStaticHTML,
  createInteractivePreview 
}: {
  code: string
  mode: 'static' | 'interactive'
  refreshKey: number
  convertToStaticHTML: (code: string) => string
  createInteractivePreview: (code: string) => string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  
  useEffect(() => {
    const htmlContent = mode === 'static' 
      ? convertToStaticHTML(code)
      : createInteractivePreview(code)
    
    // Create blob URL
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    
    // Cleanup
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [code, mode, refreshKey, convertToStaticHTML, createInteractivePreview])
  
  if (!blobUrl) {
    return <div className="flex items-center justify-center h-full">Loading preview...</div>
  }
  
  return (
    <iframe
      src={blobUrl}
      className="w-full border-0 bg-white"
      style={{ 
        height: '900px',
        display: 'block'
      }}
      title="UI Preview"
    />
  )
}

export default function UiTab() {
  const { currentProjectData, uiViewMode, setUiViewMode } = useStore()
  const [showRawCode, setShowRawCode] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [previewMode, setPreviewMode] = useState<'static' | 'interactive'>('static')
  
  if (!currentProjectData) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p>Create or select a project to see the UI preview</p>
      </div>
    )
  }

  const handleCopyCode = () => {
    if (currentProjectData.uiCode) {
      navigator.clipboard.writeText(currentProjectData.uiCode)
      toast.success('Code copied to clipboard!')
    }
  }

  const handleCopyV0Prompt = () => {
    if (currentProjectData.v0Prompt) {
      navigator.clipboard.writeText(JSON.stringify(currentProjectData.v0Prompt, null, 2))
      toast.success('v0 prompt copied to clipboard!')
    }
  }

  const handleRetryGeneration = () => {
    toast('Retry generation feature coming soon!')
  }

  // Check if the code contains problematic patterns
  const hasCodeIssues = currentProjectData.uiCode && (
    currentProjectData.uiCode.includes('```') ||
    currentProjectData.uiCode.includes('Error:') ||
    currentProjectData.uiCode.includes('Sorry') ||
    currentProjectData.uiCode.includes('I cannot') ||
    currentProjectData.uiCode.includes('I can\'t')
  )

  const highlightCode = (code: string) => {
    try {
      return highlight(code, languages.tsx, 'tsx')
    } catch (e) {
      return code
    }
  }

  // Preprocess code to ensure it has a default export
  const preprocessCode = (code: string): string => {
    if (!code) return ''
    
    console.log('Original generated code:', code);
    
    // Remove any markdown code blocks if present
    let cleanCode = code.replace(/```[\w]*\n?/g, '').trim();
    
    // Look for the main component - usually the last component defined or one with the most JSX
    const componentRegex = /(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)\s*(?:=|\(|extends)/g;
    const components: string[] = [];
    let match;
    while ((match = componentRegex.exec(cleanCode)) !== null) {
      components.push(match[1]);
    }
    
    // Find the component that likely renders other components (contains other component names)
    let mainComponent: string | null = null;
    if (components.length > 0) {
      // Check each component to see if it references other components
      for (const comp of components) {
        const componentBodyRegex = new RegExp(`${comp}[^{]*{[^}]*}`, 's');
        const bodyMatch = cleanCode.match(componentBodyRegex);
        if (bodyMatch) {
          const body = bodyMatch[0];
          // Count how many other components it references
          const referencedComponents = components.filter(c => c !== comp && body.includes(`<${c}`));
          if (referencedComponents.length > 2) {
            mainComponent = comp;
            break;
          }
        }
      }
      
      // If no component references others, pick the last one (often the main component)
      if (!mainComponent) {
        mainComponent = components[components.length - 1];
      }
    }
    
    // Check if code already has a default export
    const defaultExportMatch = cleanCode.match(/export\s+default\s+([A-Za-z][a-zA-Z0-9_]*)/);
    if (defaultExportMatch) {
      const exportedItem = defaultExportMatch[1];
      console.log('Code already has default export:', exportedItem);
      
      // Check if the exported item is actually a component (starts with uppercase)
      const isComponent = /^[A-Z]/.test(exportedItem);
      
      // If we found a main component and either the export isn't a component or it's different from main
      if (mainComponent && (!isComponent || (mainComponent !== exportedItem && components.includes(mainComponent)))) {
        console.log(`Fixing export: changing from ${exportedItem} to ${mainComponent}`);
        cleanCode = cleanCode.replace(/export\s+default\s+[A-Za-z][a-zA-Z0-9_]*;?/, `export default ${mainComponent};`);
      }
      
      return cleanCode;
    }
    
    // Check for named exports like: export { ComponentName }
    const namedExportMatch = cleanCode.match(/export\s*{\s*([A-Z][a-zA-Z0-9]*)\s*}/);
    if (namedExportMatch) {
      const componentName = namedExportMatch[1];
      console.log('Found named export:', componentName);
      
      // Use main component if found, otherwise use the named export
      const exportName = mainComponent || componentName;
      return cleanCode.replace(/export\s*{\s*[A-Z][a-zA-Z0-9]*\s*}/, `export default ${exportName}`);
    }
    
    // Check for CommonJS exports like: module.exports = ComponentName
    const commonJsMatch = cleanCode.match(/module\.exports\s*=\s*([A-Z][a-zA-Z0-9]*)/);
    if (commonJsMatch) {
      const componentName = commonJsMatch[1];
      console.log('Found CommonJS export:', componentName);
      
      // Use main component if found
      const exportName = mainComponent || componentName;
      return cleanCode.replace(/module\.exports\s*=\s*[A-Z][a-zA-Z0-9]*/, `export default ${exportName}`);
    }
    
    // If no export found, add one
    if (mainComponent) {
      console.log('Adding export for main component:', mainComponent);
      return `${cleanCode}\n\nexport default ${mainComponent};`;
    }
    
    // Try to find any component
    const componentMatches = [
      // Arrow function: const ComponentName = () => { ... }
      cleanCode.match(/const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*(?:\([^)]*\)|[^=])*\s*=>/),
      // Function declaration: function ComponentName() { ... }
      cleanCode.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/),
      // Class declaration: class ComponentName extends ...
      cleanCode.match(/class\s+([A-Z][a-zA-Z0-9]*)\s*(?:extends|{)/)
    ];
    
    for (const match of componentMatches) {
      if (match) {
        const componentName = match[1];
        console.log('Found component declaration:', componentName);
        // Add export default at the end
        return `${cleanCode}\n\nexport default ${componentName};`;
      }
    }
    
    // If no component found, check if there's JSX in the code
    if (cleanCode.includes('<') && cleanCode.includes('>')) {
      console.log('Found JSX, wrapping in component');
      // Wrap the code in a component
      return `import React from 'react';

const App = () => {
  ${cleanCode}
};

export default App;`;
    }
    
    // Last resort: Create an error component
    console.warn('Could not find a valid React component in the generated code');
    return `import React from 'react';

const App = () => {
  return (
    <div className="p-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold mb-2">Preview Error</h3>
        <p className="text-red-700 text-sm">Could not find a valid React component to render.</p>
        <p className="text-red-600 text-xs mt-2">The generated code might be incomplete or have syntax errors.</p>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">View generated code</summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
          {${JSON.stringify(code)}}
        </pre>
      </details>
    </div>
  );
};

export default App;`;
  }

  // Move useMemo after preprocessCode is defined
  const processedCode = useMemo(() => {
    if (!currentProjectData?.uiCode) return '';
    const processed = preprocessCode(currentProjectData.uiCode);
    console.log('Processed code for preview:', processed);
    return processed;
  }, [currentProjectData?.uiCode]);

  const CodeEditor = ({ value, className = '', style = {} }: { value: string; className?: string; style?: React.CSSProperties }) => {
    const lineCount = value.split('\n').length
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

    return (
      <div className="flex h-full">
        <div className="text-gray-500 dark:text-gray-600 text-right pr-4 pt-5 select-none font-mono text-sm">
          <pre>{lineNumbers}</pre>
        </div>
        <div className="flex-1">
          <Editor
            value={value}
            onValueChange={() => {}} // Read-only
            highlight={highlightCode}
            padding={20}
            disabled
            textareaClassName="outline-none"
            className={`font-mono text-sm ${className}`}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              minHeight: '100%',
              ...style
            }}
          />
        </div>
      </div>
    )
  }

  // Function to convert React-like JSX to static HTML
  function convertToStaticHTML(code: string): string {
    if (!code) return ''
    
    try {
      console.log('[convertToStaticHTML] Input code:', code.substring(0, 200))
      
      // Remove imports
      let html = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
      
      // Remove TypeScript types more carefully
      html = html.replace(/:\s*React\.\w+/g, '')
      html = html.replace(/interface\s+\w+\s*{[^}]*}/g, '')
      html = html.replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
      
      console.log('[convertToStaticHTML] After preprocessing, html starts with:', html.substring(0, 100))
      console.log('[convertToStaticHTML] After preprocessing, html length:', html.length)
      
      // Try multiple patterns to extract the JSX content
      let extractedJSX = ''
      
      // Pattern 1: Look for a function component with return (disabled for now)
      // This pattern has issues with capturing the full JSX
      // const funcComponentMatch = html.match(/(?:function\s+\w+|const\s+\w+\s*=)[^{]*\{[\s\S]*?return\s*\(\s*([\s\S]*)\s*\)\s*}\s*(?:export|$)/m)
      // if (funcComponentMatch) {
      //   extractedJSX = funcComponentMatch[1]
      //   console.log('[convertToStaticHTML] Found function component with return')
      // }
      
      // Pattern 1: Look for return statement with parenthesis counting (most robust)
      if (!extractedJSX) {
        // Find the start of the return statement (with flexible whitespace)
        const returnMatch = html.match(/return\s*\(/m)
        const returnIndex = returnMatch ? html.indexOf(returnMatch[0]) : -1
        console.log('[convertToStaticHTML] Looking for return statement. Found at index:', returnIndex)
        
        if (returnIndex !== -1 && returnMatch) {
          // Count parentheses to find the matching closing parenthesis
          let openCount = 1 // Start with 1 for the opening parenthesis after return
          let startIndex = returnIndex + returnMatch[0].length // After "return ("
          let i = startIndex
          let inString = false
          let stringChar = ''
          
          console.log('[convertToStaticHTML] Starting parenthesis counting from index:', startIndex)
          
          while (i < html.length && openCount > 0) {
            const char = html[i]
            const prevChar = i > 0 ? html[i-1] : ''
            
            // Handle string boundaries
            if (!inString && (char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
              inString = true
              stringChar = char
            } else if (inString && char === stringChar && prevChar !== '\\') {
              inString = false
            }
            
            // Only count parentheses outside of strings
            if (!inString) {
              if (char === '(') {
                openCount++
              } else if (char === ')') {
                openCount--
                if (openCount === 0) {
                  extractedJSX = html.substring(startIndex, i).trim()
                  console.log('[convertToStaticHTML] Found return statement using parenthesis counting')
                  console.log('[convertToStaticHTML] Parenthesis counting extracted length:', extractedJSX.length)
                  break
                }
              }
            }
            i++
          }
          
          if (openCount > 0) {
            console.log('[convertToStaticHTML] Warning: Parenthesis counting did not find closing parenthesis. Open count:', openCount)
          }
        }
      }
      
      // Pattern 3: Look for arrow function with implicit return (must not have curly braces after =>)
      if (!extractedJSX) {
        // This pattern should only match arrow functions without curly braces
        const arrowMatch = html.match(/const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*(?!\s*\{)\s*\(?\s*([\s\S]+?)\s*\)?\s*(?:export|$)/m)
        if (arrowMatch) {
          extractedJSX = arrowMatch[1]
          console.log('[convertToStaticHTML] Found arrow function with implicit return')
        }
      }
      
      // Pattern 4: Look for JSX directly (starts with < and has matching closing tag)
      if (!extractedJSX) {
        const jsxMatch = html.match(/(<[A-Za-z][^>]*>[\s\S]*<\/[A-Za-z]+>)/m)
        if (jsxMatch) {
          extractedJSX = jsxMatch[1]
          console.log('[convertToStaticHTML] Found direct JSX')
        }
      }
      
      // Pattern 5: Last resort - find the largest JSX block
      if (!extractedJSX) {
        // Look for JSX that starts with a div
        const divMatch = html.match(/<div[^>]*>[\s\S]*<\/div>/m)
        if (divMatch) {
          extractedJSX = divMatch[0]
          console.log('[convertToStaticHTML] Found JSX block starting with div')
        }
      }
      
      // If we still don't have JSX, use the whole cleaned HTML
      if (!extractedJSX) {
        extractedJSX = html
        console.log('[convertToStaticHTML] Using entire cleaned HTML')
      }
      
      html = extractedJSX.trim()
      console.log('[convertToStaticHTML] Extracted JSX length:', html.length)
      console.log('[convertToStaticHTML] First 500 chars:', html.substring(0, 500))
      console.log('[convertToStaticHTML] Last 500 chars:', html.substring(Math.max(0, html.length - 500)))
      
      // Replace React fragments
      html = html.replace(/<>\s*/g, '<div>')
      html = html.replace(/\s*<\/>/g, '</div>')
      
      // Replace className with class
      html = html.replace(/className=/g, 'class=')
      
      // Replace htmlFor with for
      html = html.replace(/htmlFor=/g, 'for=')
      
      // Replace {/* comments */} with <!-- comments -->
      html = html.replace(/{\/\*\s*(.*?)\s*\*\/}/g, '<!-- $1 -->')
      
      // Remove event handlers (onClick, onChange, etc.)
      html = html.replace(/\s*on[A-Z]\w*={[^}]+}/g, '')
      
      // Replace self-closing tags
      html = html.replace(/<(\w+)([^>]*?)\/>/g, '<$1$2></$1>')
      
      // Replace icon components with simple SVGs
      const iconRegex = /<(Search|User|Bell|Home|Settings|PlusCircle|MessageCircle|Pencil|Save|LogIn|Paperclip|ChevronRight|ChevronDown|X|Plus|Hash|Lock|AtSign)\s*([^>]*?)(?:\/|><\/\1)>/g
      html = html.replace(iconRegex, (match, iconName, props) => {
        const classMatch = props.match(/class="([^"]*)"/)
        const className = classMatch ? classMatch[1] : 'w-6 h-6'
        
        const iconShapes: Record<string, string> = {
          Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
          User: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
          Bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
          Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
          Settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24 4.24m-4.24 4.24l4.24 4.24M20 12h6m-6 0h-6m-2.22 4.22l-4.24 4.24m4.24-4.24l-4.24-4.24M6 12H1"/>',
          PlusCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
          MessageCircle: '<path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>',
          Pencil: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
          Save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
          LogIn: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
          Paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
          ChevronRight: '<polyline points="9 18 15 12 9 6"/>',
          ChevronDown: '<polyline points="6 9 12 15 18 9"/>',
          X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
          Plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
          Hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
          Lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
          AtSign: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>'
        }
        
        const shape = iconShapes[iconName] || '<circle cx="12" cy="12" r="10"/>'
        return `<svg class="${className}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          ${shape}
        </svg>`
      })
      
      // Clean up JSX expressions more carefully
      // Handle quoted strings in attributes
      html = html.replace(/={["'`]([^"'`]+)["'`]}/g, '="$1"')
      
      // Handle simple variable replacements
      html = html.replace(/{(\w+)}/g, (match, varName) => {
        const commonVars: Record<string, string> = {
          title: 'App Title',
          name: 'Item Name',
          description: 'Description text',
          message: 'Hello, welcome!',
          channel: 'general',
          user: 'John Doe',
          count: '5',
          time: '2:30 PM'
        }
        return commonVars[varName.toLowerCase()] || varName
      })
      
      // Remove any remaining JSX expressions
      html = html.replace(/{[^}]*}/g, '')
      
      // Wrap in HTML document with inline Tailwind-like styles
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Reset and base styles */
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #1f2937;
    }
    
    /* Layout utilities */
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .justify-around { justify-content: space-around; }
    .justify-center { justify-content: center; }
    
    /* Spacing */
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .m-2 { margin: 0.5rem; }
    .m-4 { margin: 1rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mr-2 { margin-right: 0.5rem; }
    .ml-auto { margin-left: auto; }
    .mr-auto { margin-right: auto; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-base { font-size: 1rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.875rem; }
    .font-normal { font-weight: 400; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    
    /* Colors */
    .text-white { color: #ffffff; }
    .text-gray-400 { color: #9ca3af; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    .text-gray-700 { color: #374151; }
    .text-gray-800 { color: #1f2937; }
    .text-gray-900 { color: #111827; }
    .text-blue-500 { color: #3b82f6; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-700 { color: #1d4ed8; }
    .text-green-600 { color: #16a34a; }
    .text-red-600 { color: #dc2626; }
    
    .bg-white { background-color: #ffffff; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-gray-200 { background-color: #e5e7eb; }
    .bg-gray-800 { background-color: #1f2937; }
    .bg-gray-900 { background-color: #111827; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-blue-100 { background-color: #dbeafe; }
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-blue-600 { background-color: #2563eb; }
    .bg-green-50 { background-color: #f0fdf4; }
    .bg-green-100 { background-color: #dcfce7; }
    .bg-green-500 { background-color: #10b981; }
    .bg-red-50 { background-color: #fef2f2; }
    .bg-red-100 { background-color: #fee2e2; }
    
    /* Borders */
    .border { border: 1px solid #e5e7eb; }
    .border-2 { border: 2px solid #e5e7eb; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-t { border-top: 1px solid #e5e7eb; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-gray-800 { border-color: #1f2937; }
    .rounded { border-radius: 0.25rem; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-full { border-radius: 9999px; }
    
    /* Shadows */
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    
    /* Width/Height */
    .w-full { width: 100%; }
    .w-4 { width: 1rem; }
    .w-5 { width: 1.25rem; }
    .w-6 { width: 1.5rem; }
    .w-8 { width: 2rem; }
    .w-10 { width: 2.5rem; }
    .w-12 { width: 3rem; }
    .w-64 { width: 16rem; }
    .h-4 { height: 1rem; }
    .h-5 { height: 1.25rem; }
    .h-6 { height: 1.5rem; }
    .h-8 { height: 2rem; }
    .h-10 { height: 2.5rem; }
    .h-12 { height: 3rem; }
    .h-full { height: 100%; }
    .h-screen { height: 100vh; }
    .min-h-screen { min-height: 100vh; }
    
    /* Position */
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    .top-0 { top: 0; }
    .bottom-0 { bottom: 0; }
    .left-0 { left: 0; }
    .right-0 { right: 0; }
    
    /* Display */
    .block { display: block; }
    .inline-block { display: inline-block; }
    .hidden { display: none; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    
    /* Overflow */
    .overflow-hidden { overflow: hidden; }
    .overflow-auto { overflow: auto; }
    .overflow-y-auto { overflow-y: auto; }
    .overflow-x-auto { overflow-x: auto; }
    
    /* Cursor */
    .cursor-pointer { cursor: pointer; }
    
    /* Hover states */
    .hover\\:bg-gray-50:hover { background-color: #f9fafb; }
    .hover\\:bg-gray-100:hover { background-color: #f3f4f6; }
    .hover\\:bg-gray-200:hover { background-color: #e5e7eb; }
    .hover\\:bg-blue-600:hover { background-color: #2563eb; }
    .hover\\:text-gray-900:hover { color: #111827; }
    .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    
    /* Transitions */
    .transition { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-colors { transition-property: background-color, border-color, color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    
    /* Custom styles for common patterns */
    button, [role="button"] {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      font-weight: 500;
      transition: all 150ms;
    }
    
    button:hover { opacity: 0.8; }
    
    svg {
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }
    
    input { font-family: inherit; font-size: inherit; }
    .outline-none { outline: none; }
    
    /* Fixed bottom nav handling */
    .fixed.bottom-0 {
      background-color: white;
      border-top: 1px solid #e5e7eb;
      box-shadow: 0 -1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      .grid-cols-2 { grid-template-columns: 1fr; }
      .grid-cols-3 { grid-template-columns: 1fr; }
      .grid-cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <div style="background: #f0f9ff; border-bottom: 1px solid #e0f2fe; padding: 0.5rem 1rem; font-size: 0.75rem; color: #1e40af;">
    <strong>Static Preview</strong> - CSS styles applied, no interactivity
  </div>
  ${html}
</body>
</html>
      `.trim()
    } catch (error) {
      console.error('Error converting to static HTML:', error)
      return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 20px; }
    .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h3>Preview Error</h3>
    <p>Could not generate static preview.</p>
  </div>
</body>
</html>
      `
    }
  }

  // Function to create the interactive preview HTML
  function createInteractivePreview(code: string): string {
    if (!code) return ''
    
    try {
      // For interactive preview, let's use the same static HTML approach
      // but with enhanced CSS for better interactivity
      const staticHtml = convertToStaticHTML(code)
      
      // Extract the body content from static HTML
      const bodyMatch = staticHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      if (!bodyMatch) return staticHtml
      
      const bodyContent = bodyMatch[1]
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Reset and base styles */
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #1f2937;
    }
    
    /* Layout utilities */
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .justify-around { justify-content: space-around; }
    .justify-center { justify-content: center; }
    
    /* Spacing */
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .m-2 { margin: 0.5rem; }
    .m-4 { margin: 1rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mr-2 { margin-right: 0.5rem; }
    .ml-auto { margin-left: auto; }
    .mr-auto { margin-right: auto; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-base { font-size: 1rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.875rem; }
    .font-normal { font-weight: 400; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    
    /* Colors */
    .text-white { color: #ffffff; }
    .text-gray-400 { color: #9ca3af; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    .text-gray-700 { color: #374151; }
    .text-gray-800 { color: #1f2937; }
    .text-gray-900 { color: #111827; }
    .text-blue-500 { color: #3b82f6; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-700 { color: #1d4ed8; }
    .text-green-600 { color: #16a34a; }
    .text-red-600 { color: #dc2626; }
    
    .bg-white { background-color: #ffffff; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-gray-200 { background-color: #e5e7eb; }
    .bg-gray-800 { background-color: #1f2937; }
    .bg-gray-900 { background-color: #111827; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-blue-100 { background-color: #dbeafe; }
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-blue-600 { background-color: #2563eb; }
    .bg-green-50 { background-color: #f0fdf4; }
    .bg-green-100 { background-color: #dcfce7; }
    .bg-green-500 { background-color: #10b981; }
    .bg-red-50 { background-color: #fef2f2; }
    .bg-red-100 { background-color: #fee2e2; }
    
    /* Borders */
    .border { border: 1px solid #e5e7eb; }
    .border-2 { border: 2px solid #e5e7eb; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-t { border-top: 1px solid #e5e7eb; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-gray-800 { border-color: #1f2937; }
    .rounded { border-radius: 0.25rem; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-full { border-radius: 9999px; }
    
    /* Shadows */
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    
    /* Width/Height */
    .w-full { width: 100%; }
    .w-4 { width: 1rem; }
    .w-5 { width: 1.25rem; }
    .w-6 { width: 1.5rem; }
    .w-8 { width: 2rem; }
    .w-10 { width: 2.5rem; }
    .w-12 { width: 3rem; }
    .w-64 { width: 16rem; }
    .h-4 { height: 1rem; }
    .h-5 { height: 1.25rem; }
    .h-6 { height: 1.5rem; }
    .h-8 { height: 2rem; }
    .h-10 { height: 2.5rem; }
    .h-12 { height: 3rem; }
    .h-full { height: 100%; }
    .h-screen { height: 100vh; }
    .min-h-screen { min-height: 100vh; }
    
    /* Position */
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    .top-0 { top: 0; }
    .bottom-0 { bottom: 0; }
    .left-0 { left: 0; }
    .right-0 { right: 0; }
    
    /* Display */
    .block { display: block; }
    .inline-block { display: inline-block; }
    .hidden { display: none; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    
    /* Overflow */
    .overflow-hidden { overflow: hidden; }
    .overflow-auto { overflow: auto; }
    .overflow-y-auto { overflow-y: auto; }
    .overflow-x-auto { overflow-x: auto; }
    
    /* Cursor */
    .cursor-pointer { cursor: pointer; }
    
    /* Enhanced hover states with transitions */
    .hover\\:bg-gray-50:hover { background-color: #f9fafb; }
    .hover\\:bg-gray-100:hover { background-color: #f3f4f6; }
    .hover\\:bg-gray-200:hover { background-color: #e5e7eb; }
    .hover\\:bg-gray-800:hover { background-color: #374151; }
    .hover\\:bg-blue-600:hover { background-color: #2563eb; }
    .hover\\:text-gray-700:hover { color: #374151; }
    .hover\\:text-gray-900:hover { color: #111827; }
    .hover\\:text-white:hover { color: #ffffff; }
    .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    
    /* Transitions */
    .transition { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-colors { transition-property: background-color, border-color, color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    
    /* Add transitions to all interactive elements */
    [class*="hover\\:"]:not([class*="transition"]) {
      transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Interactive enhancements */
    .cursor-pointer:hover {
      transform: translateY(-1px);
    }
    
    .cursor-pointer:active {
      transform: translateY(0);
    }
    
    /* Custom styles for common patterns */
    button, [role="button"] {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      font-weight: 500;
      transition: all 150ms;
    }
    
    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
    
    svg {
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }
    
    input { 
      font-family: inherit; 
      font-size: inherit; 
      transition: all 150ms;
    }
    
    input:focus {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
    
    .outline-none { outline: none; }
    
    /* Fixed bottom nav handling */
    .fixed.bottom-0 {
      background-color: white;
      border-top: 1px solid #e5e7eb;
      box-shadow: 0 -1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      .grid-cols-2 { grid-template-columns: 1fr; }
      .grid-cols-3 { grid-template-columns: 1fr; }
      .grid-cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <div style="background: #e0f2fe; border-bottom: 1px solid #3b82f6; padding: 0.5rem 1rem; font-size: 0.75rem; color: #1e40af;">
    <strong>Interactive Preview</strong> - Enhanced CSS with hover states and transitions
  </div>
  ${bodyContent}
</body>
</html>
      `.trim()
    } catch (error) {
      console.error('Error creating interactive preview:', error)
      return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 20px; }
    .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h3>Preview Error</h3>
    <p>Could not generate interactive preview: ${error instanceof Error ? error.message : 'Unknown error'}</p>
  </div>
</body>
</html>
      `
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {currentProjectData.uiStrategy === 'v0' ? (
        // v0 Strategy - Show prompt
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">v0 Prompt</h3>
            <button
              onClick={handleCopyV0Prompt}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Prompt
            </button>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Copy this prompt and paste it into v0.dev to generate your UI:
            </p>
            <pre className="bg-white dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(currentProjectData.v0Prompt, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        // GPT Strategy - Show code and preview
        <>
          {/* Toggle Buttons */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUiViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  uiViewMode === 'preview'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => setUiViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  uiViewMode === 'code'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Code2 className="w-4 h-4" />
                Code
              </button>
              
              {/* Preview Mode Toggle - only show when in preview mode */}
              {uiViewMode === 'preview' && (
                <div className="ml-4 flex items-center gap-1 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Mode:</span>
                  <button
                    onClick={() => setPreviewMode('static')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewMode === 'static'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Static
                  </button>
                  <button
                    onClick={() => setPreviewMode('interactive')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewMode === 'interactive'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Interactive
                  </button>
                </div>
              )}
              
              <div className="ml-auto">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Code
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            {uiViewMode === 'preview' ? (
              <div>
                {hasCodeIssues || showRawCode ? (
                  <div className="p-6 space-y-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-yellow-800 dark:text-yellow-200">UI Generation Issue</h4>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            The generated code contains formatting issues or explanatory text. This sometimes happens when the AI includes markdown or instructions instead of pure code.
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setShowRawCode(!showRawCode)}
                              className="text-sm px-3 py-1 bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 rounded transition-colors"
                            >
                              {showRawCode ? 'Hide' : 'View'} Raw Code
                            </button>
                            <button
                              onClick={handleRetryGeneration}
                              className="flex items-center gap-1 text-sm px-3 py-1 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 rounded transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry Generation
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {showRawCode && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Raw Generated Code:</h4>
                        <div className="h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                          <CodeEditor value={currentProjectData.uiCode || ''} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="relative bg-gray-50" style={{ height: '900px' }}>
                      <PreviewIframe 
                        code={processedCode}
                        mode={previewMode}
                        refreshKey={refreshKey}
                        convertToStaticHTML={convertToStaticHTML}
                        createInteractivePreview={createInteractivePreview}
                      />
                      {/* Refresh button */}
                      <button
                        onClick={() => {
                          setRefreshKey(prev => prev + 1);
                        }}
                        className="absolute top-2 right-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-10"
                        title="Refresh preview"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                <CodeEditor value={currentProjectData.uiCode || ''} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
} 