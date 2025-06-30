import { useState, useMemo } from 'react'
import { Eye, Code2, Copy, AlertCircle, RefreshCw } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-jsx'
import 'prismjs/themes/prism-tomorrow.css'

function PreviewIframe({ code, refreshKey }: { code: string; refreshKey: number }) {
  // Encode the code as base64 to avoid escaping issues
  const encodedCode = btoa(unescape(encodeURIComponent(code)));
  
  // Create the HTML content with inline styles and minimal dependencies
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Base styles */
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { width: 100%; min-height: 100vh; }
    .error { padding: 20px; color: #ef4444; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; margin: 20px; }
    
    /* Tailwind-like utilities */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .justify-around { justify-content: space-around; }
    
    /* Spacing */
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    
    .p-1 { padding: 0.25rem; }
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    
    .m-2 { margin: 0.5rem; }
    .m-4 { margin: 1rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
    .mr-2 { margin-right: 0.5rem; }
    .ml-2 { margin-left: 0.5rem; }
    .ml-auto { margin-left: auto; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .text-base { font-size: 1rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.875rem; }
    .text-4xl { font-size: 2.25rem; }
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
    .text-green-500 { color: #10b981; }
    .text-green-600 { color: #059669; }
    .text-red-500 { color: #ef4444; }
    .text-red-600 { color: #dc2626; }
    
    .bg-white { background-color: #ffffff; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-gray-200 { background-color: #e5e7eb; }
    .bg-gray-300 { background-color: #d1d5db; }
    .bg-gray-700 { background-color: #374151; }
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
    .bg-red-500 { background-color: #ef4444; }
    
    /* Borders */
    .border { border: 1px solid #e5e7eb; }
    .border-2 { border: 2px solid #e5e7eb; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-t { border-top: 1px solid #e5e7eb; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-gray-700 { border-color: #374151; }
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
    .w-16 { width: 4rem; }
    .w-64 { width: 16rem; }
    .h-4 { height: 1rem; }
    .h-5 { height: 1.25rem; }
    .h-6 { height: 1.5rem; }
    .h-8 { height: 2rem; }
    .h-10 { height: 2.5rem; }
    .h-12 { height: 3rem; }
    .h-16 { height: 4rem; }
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
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    
    /* Overflow */
    .overflow-hidden { overflow: hidden; }
    .overflow-auto { overflow: auto; }
    .overflow-y-auto { overflow-y: auto; }
    
    /* Hover states */
    .hover\\:bg-gray-100:hover { background-color: #f3f4f6; }
    .hover\\:bg-gray-200:hover { background-color: #e5e7eb; }
    .hover\\:bg-gray-700:hover { background-color: #374151; }
    .hover\\:bg-blue-600:hover { background-color: #2563eb; }
    .hover\\:text-white:hover { color: #ffffff; }
    
    /* Transitions */
    .transition { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-colors { transition-property: background-color, border-color, color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    
    /* Custom styles */
    button, [role="button"] {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 150ms;
    }
    
    input, textarea {
      font-family: inherit;
      font-size: inherit;
    }
    
    svg { display: inline-block; vertical-align: middle; }
    .cursor-pointer { cursor: pointer; }
  </style>
</head>
<body>
  <div id="root">
    <div class="p-4 text-center text-gray-500">Loading preview...</div>
  </div>
  <script>
    // Error handling
    window.onerror = function(msg, source, lineno, colno, error) {
      document.getElementById('root').innerHTML = 
        '<div class="error">Error: ' + msg + '</div>';
      return true;
    };

    // Simple createElement function
    function h(tag, props, ...children) {
      if (typeof tag === 'function') {
        return tag(props || {}, children);
      }
      
      const element = document.createElement(tag);
      
      if (props) {
        Object.entries(props).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = value;
          } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
          } else if (key.startsWith('on')) {
            const eventName = key.substring(2).toLowerCase();
            if (typeof value === 'function') {
              element.addEventListener(eventName, value);
            }
          } else if (key !== 'children' && value != null) {
            element.setAttribute(key, value);
          }
        });
      }
      
      const appendChild = (child) => {
        if (child == null) return;
        if (Array.isArray(child)) {
          child.forEach(appendChild);
        } else if (typeof child === 'object' && child.nodeType) {
          element.appendChild(child);
        } else {
          element.appendChild(document.createTextNode(String(child)));
        }
      };
      
      children.forEach(appendChild);
      return element;
    }
    
    // Basic React-like API with hooks
    let stateIndex = 0;
    const stateStore = [];
    
    window.React = {
      createElement: h,
      Fragment: ({ children }) => {
        const fragment = document.createDocumentFragment();
        if (Array.isArray(children)) {
          children.forEach(child => {
            if (child) fragment.appendChild(child);
          });
        } else if (children) {
          fragment.appendChild(children);
        }
        return fragment;
      },
      useState: (initialValue) => {
        const currentIndex = stateIndex;
        stateIndex++;
        
        // Initialize state if not exists
        if (stateStore[currentIndex] === undefined) {
          stateStore[currentIndex] = initialValue;
        }
        
        const setState = (newValue) => {
          stateStore[currentIndex] = typeof newValue === 'function' 
            ? newValue(stateStore[currentIndex]) 
            : newValue;
          
          // Re-render the component
          const root = document.getElementById('root');
          if (root && window.App) {
            stateIndex = 0; // Reset state index for re-render
            root.innerHTML = '';
            try {
              const element = window.App();
              if (element) {
                root.appendChild(element);
              }
            } catch (err) {
              console.error('Re-render error:', err);
            }
          }
        };
        
        return [stateStore[currentIndex], setState];
      },
      useEffect: (callback, deps) => {
        // Simple implementation - just run the effect immediately
        // In a real implementation, we'd track dependencies and cleanup
        if (typeof callback === 'function') {
          const cleanup = callback();
          // We're not handling cleanup for this simple implementation
        }
      }
    };
    
    // Icon helper
    const Icon = (svgContent) => ({ className = "w-6 h-6", ...props }) => {
      const div = document.createElement('div');
      div.innerHTML = '<svg class="' + className + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + svgContent + '</svg>';
      return div.firstChild;
    };
    
    // Common icons
    const User = Icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
    const Settings = Icon('<circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24 4.24m-4.24 4.24l4.24 4.24M20 12h6m-6 0h-6m-2.22 4.22l-4.24 4.24m4.24-4.24l-4.24-4.24M6 12H1"/>');
    const Save = Icon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>');
    const Send = Icon('<path d="m22 2-7 20-4-9-9-4z"/>');
    const Search = Icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>');
    const Bell = Icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>');
    const Home = Icon('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>');
    const PlusCircle = Icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>');
    const MessageCircle = Icon('<path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>');
    const Plus = Icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
    const Hash = Icon('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>');
    const Lock = Icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');
    const ChevronRight = Icon('<polyline points="9 18 15 12 9 6"/>');
    const ChevronDown = Icon('<polyline points="6 9 12 15 18 9"/>');
    const X = Icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    const Pencil = Icon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
    const LogIn = Icon('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>');
    const Paperclip = Icon('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>');
    const AtSign = Icon('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>');
    
    // Store the encoded code
    window.encodedCode = '${encodedCode}';
    
    try {
      // Decode the code
      const code = decodeURIComponent(escape(atob(window.encodedCode)));
      
      // Check if it's JSX - look for JSX patterns like <ComponentName or <div
      // but exclude our compatibility wrapper
      const jsxPattern = /<[A-Z][a-zA-Z]*[\s>]|<[a-z]+[\s>]/;
      const isJSX = jsxPattern.test(code) && !code.includes('JSX compatibility wrapper');
      
      console.log('Code preview (first 200 chars):', code.substring(0, 200));
      console.log('Is JSX?', isJSX, 'Has wrapper?', code.includes('JSX compatibility wrapper'));
      
      if (isJSX) {
        // This is JSX code, show compatibility message
        document.getElementById('root').innerHTML = 
          '<div class="p-4">' +
            '<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">' +
              '<h3 class="text-yellow-800 font-semibold mb-2">Preview Temporarily Unavailable</h3>' +
              '<p class="text-yellow-700 text-sm">This project was created with JSX syntax. Please generate a new project to see the preview.</p>' +
              '<p class="text-yellow-600 text-xs mt-2">New projects will use a compatible format that works with the preview.</p>' +
            '</div>' +
          '</div>';
      } else {
        // Create a script element to execute the code (avoids eval)
        const script = document.createElement('script');
        script.textContent = code;
        console.log('Executing script with code length:', code.length);
        document.body.appendChild(script);
        console.log('Script added. Checking window.App immediately:', window.App);
        
        // Add a small delay to ensure script execution completes
        setTimeout(() => {
          // Debug: log what's available
          console.log('After delay - Looking for component. window.App:', window.App, 'window.Default:', window.Default, 'window.Component:', window.Component);
          
          // Find and render the component
          const component = window.App || window.Default || window.Component;
          
          if (component && typeof component === 'function') {
            const root = document.getElementById('root');
            root.innerHTML = '';
            try {
              // Reset state index before initial render
              stateIndex = 0;
              const element = component();
              if (element) {
                root.appendChild(element);
              }
            } catch (renderError) {
              console.error('Error rendering component:', renderError);
              document.getElementById('root').innerHTML = 
                '<div class="error">Error rendering component: ' + renderError.message + '</div>';
            }
          } else {
            // Show more debugging info
            document.getElementById('root').innerHTML = 
              '<div class="error">' +
                '<p>No component found to render.</p>' +
                '<p class="text-xs mt-2">Debug: Check console for available components.</p>' +
                '<details class="mt-2 text-xs">' +
                  '<summary>Code Preview (first 500 chars)</summary>' +
                  '<pre class="mt-1 p-2 bg-gray-100 rounded overflow-auto">' + 
                    code.substring(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
                  '</pre>' +
                '</details>' +
              '</div>';
          }
        }, 10);
      }
    } catch (error) {
      console.error('Preview error:', error);
      document.getElementById('root').innerHTML = 
        '<div class="error">Error: ' + error.message + '</div>';
    }
  </script>
</body>
</html>
  `

  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full border-0 bg-white"
      style={{ 
        height: '900px',
        display: 'block'
      }}
      title="UI Preview"
      sandbox="allow-scripts"
    />
  )
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
      return highlight(code, languages.jsx, 'jsx')
    } catch (e) {
      return code
    }
  }

  // Preprocess code to ensure it has a default export
  const preprocessCode = (code: string): string => {
    if (!code) return ''
    
    // Remove any markdown code blocks if present
    let cleanCode = code.replace(/```[\w]*\n?/g, '').trim();
    
    // Remove import statements (they can't be used in our context)
    cleanCode = cleanCode.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
    cleanCode = cleanCode.replace(/import\s+['"].*?['"];?\s*/g, '');
    
    // Remove export statements (we'll handle the component directly)
    cleanCode = cleanCode.replace(/export\s+default\s+/g, '');
    cleanCode = cleanCode.replace(/export\s+{\s*[^}]*\s*};?\s*/g, '');
    
    // If the code already has window.App assigned, return it as-is
    if (cleanCode.includes('window.App')) {
      return cleanCode;
    }
    
    // Helper function to convert JSX attributes to object
    const convertAttributes = (attrs: string): string => {
      const props: Record<string, string> = {};
      
      // Match attribute patterns
      const attrRegex = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|{([^}]*)}|\w+))?/g;
      let attrMatch;
      
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const [, name, doubleQuoted, singleQuoted, expression] = attrMatch;
        if (doubleQuoted !== undefined) {
          props[name] = `'${doubleQuoted}'`;
        } else if (singleQuoted !== undefined) {
          props[name] = `'${singleQuoted}'`;
        } else if (expression !== undefined) {
          props[name] = expression;
        } else {
          props[name] = 'true'; // Boolean attributes
        }
      }
      
      // Convert to object literal string
      const entries = Object.entries(props).map(([key, value]) => `${key}: ${value}`);
      return entries.length > 0 ? `{ ${entries.join(', ')} }` : 'null';
    };
    
    // Convert JSX to React.createElement (for backwards compatibility with existing projects)
    if (cleanCode.includes('<') && cleanCode.includes('>')) {
      console.log('Converting JSX to React.createElement...');
      
      // For simplicity and reliability, let's just create a warning component
      // We don't include the original JSX to avoid triggering JSX detection in the iframe
      const compatibilityCode = `
// JSX compatibility wrapper
// Create a simple component that renders a message
window.App = (() => {
  return React.createElement('div', { className: 'p-4' },
    React.createElement('div', { className: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4' },
      React.createElement('h3', { className: 'text-yellow-800 font-semibold mb-2' }, 'Preview Temporarily Unavailable'),
      React.createElement('p', { className: 'text-yellow-700 text-sm' }, 
        'This project was created with JSX syntax. Please generate a new project to see the preview.'
      ),
      React.createElement('p', { className: 'text-yellow-600 text-xs mt-2' }, 
        'New projects will use a compatible format that works with the preview.'
      )
    )
  );
});`;
      
      console.log('JSX conversion complete - showing compatibility message');
      return compatibilityCode; // Return immediately, don't process further
    }
    
    // Look for the main component - usually the last component defined or one with the most JSX
    const componentRegex = /(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)\s*(?:=|\(|extends)/g;
    const components: string[] = [];
    let componentMatch;
    while ((componentMatch = componentRegex.exec(cleanCode)) !== null) {
      components.push(componentMatch[1]);
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
    
    // Add assignment to App if we found a main component
    if (mainComponent) {
      return `${cleanCode}\n\nwindow.App = ${mainComponent};`;
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
        // Add assignment to App
        return `${cleanCode}\n\nwindow.App = ${componentName};`;
      }
    }
    
    // If nothing found, check if there's React.createElement in the code that we can wrap
    // But don't wrap if window.App is already assigned
    if (cleanCode.includes('React.createElement') && !cleanCode.includes('window.App')) {
      return `window.App = () => {
  return ${cleanCode};
};`;
    }
    
    // Last resort: Create an error component
    return `window.App = () => {
  return React.createElement('div', { className: 'p-4' },
    React.createElement('div', { className: 'bg-red-50 border border-red-200 rounded-lg p-4' },
      React.createElement('h3', { className: 'text-red-800 font-semibold mb-2' }, 'Preview Error'),
      React.createElement('p', { className: 'text-red-700 text-sm' }, 'Could not find a valid React component to render.')
    )
  );
};`;
  }

  // Move useMemo after preprocessCode is defined
  const processedCode = useMemo(() => {
    if (!currentProjectData?.uiCode) return '';
    return preprocessCode(currentProjectData.uiCode);
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
                      <PreviewIframe code={processedCode} refreshKey={refreshKey} />
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