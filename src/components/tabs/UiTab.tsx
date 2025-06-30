import { useState } from 'react'
import { Copy, Code2, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'

export default function UiTab() {
  const { currentProjectData, uiViewMode, setUiViewMode } = useStore()
  const [showRawCode, setShowRawCode] = useState(false)
  
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
    
    // Check if code already has a default export
    if (code.includes('export default') || code.includes('exports.default')) {
      return code
    }
    
    // Try to find the main component name
    const componentMatch = code.match(/(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)\s*(?:=|\(|extends)/);
    if (componentMatch) {
      const componentName = componentMatch[1];
      // Add export default at the end
      return `${code}\n\nexport default ${componentName};`;
    }
    
    // If we can't find a component, wrap everything in a default component
    return `import React from 'react';
${code}

const App = () => {
  return (
    <div className="p-4">
      <p className="text-red-500">Error: Could not find a React component to render.</p>
      <p className="text-sm text-gray-600">Make sure your code exports a React component.</p>
    </div>
  );
};

export default App;`;
  }

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
    <div className="flex-1 flex flex-col">
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
          <div className="flex-1 overflow-hidden">
            {uiViewMode === 'preview' ? (
              <div className="h-full">
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
                  <SandpackProvider
                    template="react"
                    theme="dark"
                    files={{
                      '/App.js': preprocessCode(currentProjectData.uiCode || ''),
                      '/styles.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`
                    }}
                    customSetup={{
                      dependencies: {
                        'react': '^18.0.0',
                        'react-dom': '^18.0.0',
                        'lucide-react': 'latest',
                        'clsx': 'latest',
                        'tailwindcss': 'latest',
                      }
                    }}
                    options={{
                      externalResources: [
                        "https://cdn.tailwindcss.com"
                      ]
                    }}
                  >
                    <SandpackPreview 
                      className="h-full"
                      showOpenInCodeSandbox={false}
                      showRefreshButton={true}
                    />
                  </SandpackProvider>
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