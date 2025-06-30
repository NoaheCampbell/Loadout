import { useState, useMemo } from 'react'
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

export default function UiTab() {
  const { currentProjectData, uiViewMode, setUiViewMode } = useStore()
  const [showRawCode, setShowRawCode] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  
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
      
      // Add default text to common elements if they're empty
      html = html.replace(/<h1([^>]*)><\/h1>/g, '<h1$1>Main Title</h1>')
      html = html.replace(/<h2([^>]*)><\/h2>/g, '<h2$1>Section Title</h2>')
      html = html.replace(/<h3([^>]*)><\/h3>/g, '<h3$1>Subsection</h3>')
      html = html.replace(/<button([^>]*)><\/button>/g, '<button$1>Click Me</button>')
      html = html.replace(/<a([^>]*)><\/a>/g, '<a$1>Link</a>')
      
      // Replace icon components with simple SVGs with icon-specific shapes
      const iconRegex = /<(Search|User|Bell|Home|Settings|PlusCircle|MessageCircle|Pencil|Save|LogIn|Paperclip)\s*([^>]*?)><\/\1>/g
      html = html.replace(iconRegex, (match, iconName, props) => {
        const classMatch = props.match(/class="([^"]*)"/)
        const className = classMatch ? classMatch[1] : 'w-6 h-6'
        
        // Different simple shapes for different icons
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
          Paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
        }
        
        const shape = iconShapes[iconName] || '<circle cx="12" cy="12" r="10"/>'
        return `<svg class="${className}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          ${shape}
        </svg>`
      })
      
      // Replace .map() iterations with static HTML
      html = html.replace(/{(\w+)\.map\([^)]+\)\s*=>\s*\(([\s\S]*?)\)\)}/g, (match, varName, template) => {
        const data = mockData[varName] || []
        // If no data, use better defaults
        if (data.length === 0) {
          const itemType = varName.toLowerCase()
          if (itemType.includes('group')) {
            data.push(
              { id: 1, name: 'Study Group Alpha', title: 'Calculus Study Group', members: 12 },
              { id: 2, name: 'Study Group Beta', title: 'Physics Study Group', members: 8 },
              { id: 3, name: 'Study Group Gamma', title: 'Chemistry Study Group', members: 15 }
            )
          } else if (itemType.includes('channel')) {
            data.push(
              { id: 1, name: 'General', title: 'General Discussion', members: 150 },
              { id: 2, name: 'Homework Help', title: 'Get Help with Assignments', members: 89 },
              { id: 3, name: 'Study Tips', title: 'Share Study Strategies', members: 67 }
            )
          } else {
            data.push(
              { id: 1, name: 'Item 1', title: 'First Item', description: 'This is the first item' },
              { id: 2, name: 'Item 2', title: 'Second Item', description: 'This is the second item' },
              { id: 3, name: 'Item 3', title: 'Third Item', description: 'This is the third item' }
            )
          }
        }
        return data.map((item: any) => {
          let itemHtml = template
          // Replace {item.property} with actual values
          itemHtml = itemHtml.replace(/{(\w+)\.(\w+)}/g, (m: string, obj: string, prop: string) => {
            return item[prop] || `${prop}`
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
      
      // Replace any text in curly braces with the text itself or placeholder
      html = html.replace(/{(['"`])([^'"`]+)\1}/g, '$2') // Replace {"text"} with text
      html = html.replace(/{(\w+)}/g, (match, varName) => {
        // Common variable replacements
        const commonVars: Record<string, string> = {
          title: 'App Title',
          name: 'Item Name',
          description: 'Description text',
          message: 'Hello, welcome!',
          user: 'John Doe',
          email: 'user@example.com',
          count: '42',
          total: '100',
          price: '$19.99'
        }
        return commonVars[varName.toLowerCase()] || varName
      })
      
      // Clean up any remaining complex JSX expressions
      html = html.replace(/{[^}]+}/g, 'Content')
      
      // If the HTML is mostly empty or just has divs, add some helpful content
      if (!html.trim() || html.trim() === '<div></div>' || !html.includes('>')) {
        html = `
          <div class="p-6 text-center">
            <h2 class="text-xl font-semibold mb-4">Preview Placeholder</h2>
            <p class="text-gray-600 mb-4">The component structure is ready but needs content.</p>
            <div class="grid grid-cols-2 gap-4 mt-6">
              <div class="bg-gray-100 p-4 rounded-lg">
                <h3 class="font-medium mb-2">Section 1</h3>
                <p class="text-sm text-gray-600">Content goes here</p>
              </div>
              <div class="bg-gray-100 p-4 rounded-lg">
                <h3 class="font-medium mb-2">Section 2</h3>
                <p class="text-sm text-gray-600">More content here</p>
              </div>
            </div>
          </div>
        `
      }
      
      // Wrap in basic HTML document
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    html, body { 
      margin: 0; 
      padding: 0;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #1f2937;
      background-color: #ffffff;
      min-height: 100%;
      height: 100%;
    }
          #preview-root {
        min-height: 100vh;
        position: relative;
        padding-bottom: 80px; /* Space for fixed bottom navigation */
      }
    
    /* Tailwind-like utility classes */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-around { justify-content: space-around; }
    .gap-2 { gap: 0.5rem; }
    .gap-4 { gap: 1rem; }
    .p-2 { padding: 0.5rem; }
    .p-4 { padding: 1.5rem; }
    .p-6 { padding: 2rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mt-4 { margin-top: 1rem; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .border { border: 1px solid #e5e7eb; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-gray-200 { border-color: #e5e7eb; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-gray-200 { background-color: #e5e7eb; }
    .bg-white { background-color: white; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-blue-100 { background-color: #dbeafe; }
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-green-50 { background-color: #f0fdf4; }
    .bg-green-100 { background-color: #dcfce7; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    .text-gray-700 { color: #374151; }
    .text-gray-800 { color: #1f2937; }
    .text-blue-600 { color: #2563eb; }
    .text-white { color: #ffffff; }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .text-sm { font-size: 0.875rem; }
    .text-base { font-size: 1rem; }
    .text-lg { font-size: 1.25rem; }
    .text-xl { font-size: 1.5rem; }
    .text-2xl { font-size: 1.875rem; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .w-4 { width: 1rem; }
    .h-4 { height: 1rem; }
    .w-5 { width: 1.25rem; }
    .h-5 { height: 1.25rem; }
    .w-6 { width: 1.5rem; }
    .h-6 { height: 1.5rem; }
    .w-8 { width: 2rem; }
    .h-8 { height: 2rem; }
    .w-10 { width: 2.5rem; }
    .h-10 { height: 2.5rem; }
          .w-full { width: 100%; }
      .h-full { height: 100%; }
      .h-screen { height: 100vh; min-height: 800px; }
      .min-h-screen { min-height: 100vh; }
    .overflow-y-auto { overflow-y: auto; }
    .overflow-hidden { overflow: hidden; }
          .fixed { position: fixed; }
      .relative { position: relative; }
      .absolute { position: absolute; }
      .bottom-0 { bottom: 0; }
      .left-0 { left: 0; }
      .right-0 { right: 0; }
      .top-0 { top: 0; }
      
      /* Fixed bottom navigation handling */
      .fixed.bottom-0 {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background-color: white;
        z-index: 50;
      }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-x-4 > * + * { margin-left: 1rem; }
    
    /* Hover effects */
    .hover\\:bg-gray-50:hover { background-color: #f9fafb; }
    .hover\\:bg-gray-100:hover { background-color: #f3f4f6; }
    .hover\\:bg-gray-200:hover { background-color: #e5e7eb; }
    .hover\\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    
    /* Make sure icons are visible */
    svg {
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }
    
    /* Button styles */
    button, [role="button"] {
      cursor: pointer;
      transition: all 0.2s;
    }
    
    /* Link styles */
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    
    /* Card-like elements */
    .card {
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      padding: 1.5rem;
    }
    
    /* Mobile responsive */
    @media (max-width: 640px) {
      .grid-cols-2 { grid-template-columns: 1fr; }
      .grid-cols-3 { grid-template-columns: 1fr; }
      body { font-size: 14px; }
      .p-4 { padding: 1rem; }
      .p-6 { padding: 1.5rem; }
    }
  </style>
</head>
  <body>
    <div style="background: #f0f9ff; border-bottom: 1px solid #e0f2fe; padding: 0.5rem 1rem; font-size: 0.75rem; color: #1e40af; position: sticky; top: 0; z-index: 1000;">
      <strong>Preview</strong> - Static HTML (interactions disabled)
    </div>
    <div id="preview-root">
      ${html}
    </div>
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
                      {(() => {
                        const htmlContent = convertToStaticHTML(processedCode);
                        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
                        return (
                          <iframe
                            key={refreshKey}
                            src={dataUrl}
                            className="w-full border-0 bg-white"
                            style={{ 
                              height: '900px',
                              display: 'block'
                            }}
                            title="UI Preview"
                          />
                        );
                      })()}
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