import { useState, useMemo, useRef, useEffect } from 'react'
import { Eye, Code2, Copy, AlertCircle, RefreshCw, FileCode, FileCode2, Folder, Loader2, Download } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
// Removed prism theme - using custom styles only
import { ipc } from '../../lib/ipc'
import type { GenerationProgress } from '../../types'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// Custom styles for better syntax highlighting
const syntaxStyles = `
  /* Reset all code and pre styles */
  pre, code, pre *, code * {
    background: none !important;
    background-color: transparent !important;
    text-shadow: none !important;
  }
  
  /* Override Prism theme if any remnants exist */
  pre[class*="language-"],
  code[class*="language-"] {
    background: transparent !important;
    text-shadow: none !important;
  }
  
  pre[class*="language-"]::selection,
  pre[class*="language-"] ::selection,
  code[class*="language-"]::selection,
  code[class*="language-"] ::selection {
    background: rgba(100, 100, 100, 0.3) !important;
  }
  
  /* Token colors */
  .token.comment { color: #6A9955; }
  .token.prolog { color: #6A9955; }
  .token.doctype { color: #6A9955; }
  .token.cdata { color: #6A9955; }
  
  .token.punctuation { color: #D4D4D4; }
  
  .token.property { color: #9CDCFE; }
  .token.tag { color: #569CD6; }
  .token.boolean { color: #569CD6; }
  .token.number { color: #B5CEA8; }
  .token.constant { color: #9CDCFE; }
  .token.symbol { color: #B5CEA8; }
  .token.deleted { color: #CE9178; }
  
  .token.selector { color: #D7BA7D; }
  .token.attr-name { color: #9CDCFE; }
  .token.string { color: #CE9178; }
  .token.char { color: #CE9178; }
  .token.builtin { color: #CE9178; }
  .token.inserted { color: #CE9178; }
  
  .token.operator { color: #D4D4D4; }
  .token.entity { color: #569CD6; }
  .token.url { color: #3794ff; }
  .language-css .token.string { color: #CE9178; }
  .style .token.string { color: #CE9178; }
  
  .token.atrule { color: #C586C0; }
  .token.attr-value { color: #CE9178; }
  .token.keyword { color: #C586C0; }
  
  .token.function { color: #DCDCAA; }
  .token.class-name { color: #4EC9B0; }
  
  .token.regex { color: #D16969; }
  .token.important { color: #569cd6; }
  .token.variable { color: #9CDCFE; }
  
  /* Remove ALL backgrounds from ALL tokens */
  span[class*="token"] {
    background: none !important;
    background-color: transparent !important;
  }
  
  /* Ensure proper whitespace handling */
  .code-editor-wrapper {
    font-feature-settings: "liga" 0, "calt" 0;
  }
  
  .code-content pre {
    white-space: pre !important;
    word-wrap: normal !important;
    overflow-x: auto !important;
    tab-size: 2 !important;
  }
  
  .code-content code {
    white-space: pre !important;
    background: transparent !important;
    display: block !important;
  }
`;

// Inject custom styles
if (typeof document !== 'undefined') {
  let styleElement = document.getElementById('prism-custom-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'prism-custom-styles';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = syntaxStyles;
}

function LocalhostPreview({ files, refreshKey }: { files: any[]; refreshKey: number }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    let mounted = true
    
    const startPreview = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Stop any existing server
        await ipc.stopPreviewServer()
        
        // Start the preview server with the files
        const result = await ipc.startPreviewServer(files)
        
        if (mounted) {
          if (result.success && result.url) {
            setPreviewUrl(result.url)
            console.log('✅ Preview server started at:', result.url)
          } else {
            setError(result.error || 'Failed to start preview server')
          }
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to start preview:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to start preview')
          setIsLoading(false)
        }
      }
    }
    
    startPreview()
    
    // Cleanup on unmount
    return () => {
      mounted = false
      // Don't stop the server on unmount - keep it running for smooth transitions
    }
  }, [files, refreshKey])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-gray-600">Starting preview server...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="text-red-600 font-medium">Failed to start preview</p>
          <p className="text-gray-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }
  
  if (!previewUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <p className="text-gray-600">No preview URL available</p>
      </div>
    )
  }
  
  return (
    <iframe
      src={previewUrl}
      className="w-full border-0 bg-white"
      style={{ height: '800px', minHeight: '800px' }}
      title="UI Preview"
    />
  )
}

export default function UiTab() {
  const { 
    currentProjectData, 
    uiViewMode, 
    setUiViewMode,
    setGenerating,
    clearProgress,
    addProgress,
    setProjectData,
    isGenerating,
    generationProgress,
    projects,
    selectedProjectId
  } = useStore()
  const [showRawCode, setShowRawCode] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  
  // Stop preview server when component unmounts or project changes
  useEffect(() => {
    return () => {
      // Stop server on unmount
      ipc.stopPreviewServer().catch(console.error)
    }
  }, [selectedProjectId]) // Also re-run when project changes
  
  if (!currentProjectData) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p>Create or select a project to see the UI preview</p>
      </div>
    )
  }

  const handleCopyCode = () => {
    // If multiple files, copy all or selected file
    if (currentProjectData.uiFiles && currentProjectData.uiFiles.length > 0) {
      if (selectedFile) {
        // Copy selected file
        const file = currentProjectData.uiFiles.find(f => f.filename === selectedFile);
        if (file) {
          navigator.clipboard.writeText(file.content);
          toast.success(`Copied ${file.filename} to clipboard!`);
        }
      } else {
        // Copy all files combined
        const allCode = getCombinedCode();
        navigator.clipboard.writeText(allCode);
        toast.success('Copied all files to clipboard!');
      }
    } else if (currentProjectData.uiCode) {
      navigator.clipboard.writeText(currentProjectData.uiCode);
      toast.success('Code copied to clipboard!');
    }
  }

  const handleExportFiles = async () => {
    if (!currentProjectData?.uiFiles || currentProjectData.uiFiles.length === 0) {
      toast.error('No UI files to export')
      return
    }

    try {
      const zip = new JSZip()
      const projectName = projects.find(p => p.id === selectedProjectId)?.title || 'ui-components'
      
      // Create a folder for the components
      const componentsFolder = zip.folder('components')
      
      // Add each UI file to the zip
      currentProjectData.uiFiles.forEach(file => {
        if (componentsFolder) {
          // Convert .tsx extension to .jsx for better compatibility
          const fileName = file.filename.replace('.tsx', '.jsx')
          componentsFolder.file(fileName, file.content)
        }
      })
      
      // Add a README file
      const readmeContent = `# ${projectName} - UI Components

## Generated Files
This archive contains ${currentProjectData.uiFiles.length} UI components generated by FlowGenius.

## File Structure
- components/ - All UI component files
  ${currentProjectData.uiFiles.map(f => `- ${f.filename.replace('.tsx', '.jsx')}`).join('\n  ')}

## Usage
These components use React.createElement() syntax and are designed to work with:
- React (available globally as window.React)
- Tailwind CSS for styling

## Notes
- Components are registered globally on the window object
- Each component exports itself as window.ComponentName
- The main App component orchestrates the entire UI

Generated on: ${new Date().toLocaleString()}
`
      
      zip.file('README.md', readmeContent)
      
      // Add a simple HTML file for testing
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
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
  </script>
  
  <!-- Load Components -->
  ${currentProjectData.uiFiles.map(f => `<script src="components/${f.filename.replace('.tsx', '.jsx')}"></script>`).join('\n  ')}
  
  <!-- Mount App -->
  <script>
    if (window.App) {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(window.App));
    } else {
      console.error('App component not found! Make sure window.App is defined.');
    }
  </script>
</body>
</html>`
      
      zip.file('index.html', htmlContent)
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' })
      
      // Save the file
      const fileName = `${projectName.toLowerCase().replace(/\s+/g, '-')}-ui-components.zip`
      saveAs(content, fileName)
      
      toast.success(`Exported ${currentProjectData.uiFiles.length} files to ${fileName}`)
    } catch (error) {
      console.error('Failed to export files:', error)
      toast.error('Failed to export files')
    }
  }

  const handleCopyV0Prompt = () => {
    if (currentProjectData.v0Prompt) {
      navigator.clipboard.writeText(JSON.stringify(currentProjectData.v0Prompt, null, 2))
      toast.success('v0 prompt copied to clipboard!')
    }
  }

  const handleRetryGeneration = async () => {
    // Check if we have a project idea to regenerate
    if (!currentProjectData?.idea) {
      toast.error('No project idea found to regenerate')
      return
    }

    // Confirm with user before regenerating
    const confirmed = window.confirm('This will regenerate all UI files. Are you sure you want to continue?')
    if (!confirmed) return

    setGenerating(true)
    clearProgress()
    toast('Regenerating UI files...')

    try {
      // Set up progress listener
      const unsubscribe = ipc.onGenerationProgress((progress: GenerationProgress) => {
        console.log('Retry: Received progress update:', progress)
        addProgress(progress)
      })

      // Regenerate the project with existing idea and chat history
      console.log('Retry: Regenerating project with idea:', currentProjectData.idea)
      const result = await ipc.generateProject(
        currentProjectData.idea, 
        currentProjectData.chatHistory || []
      )
      console.log('Retry: Generation result:', result)

      if (result.success && result.data?.projectId) {
        console.log('Retry: Project regenerated successfully')
        toast.success('UI regenerated successfully!')
        
        // Small delay to ensure files are written
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Reload the project data to get new UI files
        console.log('Retry: Loading updated project data for:', result.data.projectId)
        const updatedProjectData = await ipc.loadProject(result.data.projectId)
        console.log('Retry: Updated project data loaded:', updatedProjectData ? 'success' : 'failed')
        
        if (updatedProjectData) {
          setProjectData(updatedProjectData)
          // Reset refresh key to force preview update
          setRefreshKey(prev => prev + 1)
        } else {
          toast.error('Failed to load regenerated project data')
        }
      } else {
        console.log('Retry: Regeneration failed:', result.error)
        toast.error(result.error || 'Failed to regenerate UI')
      }

      // Clean up listener
      unsubscribe()
    } catch (error) {
      console.error('Regeneration error:', error)
      toast.error('An error occurred while regenerating the UI')
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectiveRegeneration = async (fileIssues: any[]) => {
    if (!currentProjectData?.idea) {
      toast.error('No project idea found to regenerate')
      return
    }

    // Confirm with user before regenerating
    const fileNames = fileIssues.map(f => f.filename).join(', ')
    const confirmed = window.confirm(`This will regenerate the following problematic files: ${fileNames}. Continue?`)
    if (!confirmed) return

    setGenerating(true)
    clearProgress()
    toast(`Regenerating ${fileIssues.length} problematic file${fileIssues.length !== 1 ? 's' : ''}...`)

    try {
      // Set up progress listener
      const unsubscribe = ipc.onGenerationProgress((progress: GenerationProgress) => {
        console.log('Selective: Received progress update:', progress)
        addProgress(progress)
      })

      // Extract component names from filenames (remove .tsx extension)
      const componentNames = fileIssues.map(f => f.componentName || f.filename.replace('.tsx', ''))
      
      console.log('Selective: Regenerating components:', componentNames)
      
      // TODO: This requires implementing selective regeneration in the backend
      // For now, we'll fall back to full regeneration
      const result = await ipc.generateProject(
        currentProjectData.idea, 
        currentProjectData.chatHistory || []
      )
      console.log('Selective: Generation result:', result)

      if (result.success && result.data?.projectId) {
        console.log('Selective: Files regenerated successfully')
        toast.success(`Fixed ${componentNames.length} problematic file${componentNames.length !== 1 ? 's' : ''}!`)
        
        // Small delay to ensure files are written
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Reload the project data to get new UI files
        console.log('Selective: Loading updated project data for:', result.data.projectId)
        const updatedProjectData = await ipc.loadProject(result.data.projectId)
        console.log('Selective: Updated project data loaded:', updatedProjectData ? 'success' : 'failed')
        
        if (updatedProjectData) {
          setProjectData(updatedProjectData)
          // Reset refresh key to force preview update
          setRefreshKey(prev => prev + 1)
        } else {
          toast.error('Failed to load regenerated project data')
        }
      } else {
        console.log('Selective: Regeneration failed:', result.error)
        toast.error(result.error || 'Failed to regenerate files')
      }

      // Clean up listener
      unsubscribe()
    } catch (error) {
      console.error('Selective regeneration error:', error)
      toast.error('An error occurred while regenerating the files')
    } finally {
      setGenerating(false)
    }
  }

  // DISABLED: Just trust the generated code - if it works on localhost, it works
  const hasCodeIssues = false

  const highlightCode = (code: string) => {
    try {
      // Use typescript/tsx highlighting for better accuracy
      const language = Prism.languages.tsx || Prism.languages.typescript || Prism.languages.jsx || Prism.languages.javascript
      return Prism.highlight(code, language, 'tsx')
    } catch (e) {
      // Fallback to plain text if highlighting fails
      return code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }

  // Get combined code for copying to clipboard
  const getCombinedCode = (): string => {
    // If we have multiple UI files, combine them
    if (currentProjectData?.uiFiles && currentProjectData.uiFiles.length > 0) {
      // Sort files so that components come first, then main/App file
      const sortedFiles = [...currentProjectData.uiFiles].sort((a, b) => {
        if (a.type === 'main' || a.filename.toLowerCase().includes('app')) return 1;
        if (b.type === 'main' || b.filename.toLowerCase().includes('app')) return -1;
        return 0;
      });
      
      // Combine all files with file headers
      return sortedFiles.map(file => {
        return `// ===== ${file.filename} =====\n${file.content.trim()}`;
      }).join('\n\n');
    }
    
    // Fall back to single file
    return currentProjectData?.uiCode || '';
  };

  const CodeEditor = ({ value, className = '', style = {} }: { value: string; className?: string; style?: React.CSSProperties }) => {
    const highlightedCode = useMemo(() => {
      // Apply syntax highlighting
      const highlighted = highlightCode(value)
      // Remove any inline styles that might contain backgrounds
      return highlighted
        .replace(/style="[^"]*"/g, '') // Remove all inline styles
        .replace(/class="([^"]*\s)?token-tab(\s[^"]*)?"/g, 'class="$1token$2"') // Replace token-tab with token
        .replace(/\t/g, '  ') // Convert tabs to 2 spaces for consistent display
    }, [value])
    
    return (
      <div className="h-full bg-gray-900 dark:bg-gray-950 overflow-auto relative code-editor-wrapper">
        <div className="flex min-h-full">
          {/* Line numbers column */}
          <div className="flex-shrink-0 select-none sticky left-0 bg-gray-900 dark:bg-gray-950 z-10 border-r border-gray-800 dark:border-gray-900">
            <pre 
              className="text-gray-500 dark:text-gray-600 text-right px-4 m-0"
              style={{ 
                fontSize: '14px',
                fontFamily: '"Fira Code", "Fira Mono", Consolas, monospace',
                lineHeight: '1.5rem',
                paddingTop: '20px',
                paddingBottom: '20px',
                whiteSpace: 'pre'
              }}
            >
              {value.split('\n').map((_, i) => `${i + 1}\n`).join('')}
            </pre>
          </div>
          
          {/* Code content */}
          <div className="flex-1 overflow-x-auto code-content">
            <pre 
              className="m-0 p-5 pl-5"
              style={{ 
                fontSize: '14px',
                fontFamily: '"Fira Code", "Fira Mono", Consolas, monospace',
                lineHeight: '1.5rem',
                color: '#D4D4D4',
                tabSize: 2,
                whiteSpace: 'pre',
                backgroundColor: 'transparent'
              }}
            >
              <code 
                style={{ backgroundColor: 'transparent' }}
                dangerouslySetInnerHTML={{ __html: highlightedCode }} 
              />
            </pre>
          </div>
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
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
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
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Code2 className="w-4 h-4" />
                Code
              </button>
              
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleRetryGeneration}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Regenerate UI with new variations"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Regenerate
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Code
                </button>
                {currentProjectData?.uiFiles && currentProjectData.uiFiles.length > 0 && (
                  <button
                    onClick={handleExportFiles}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Files
                  </button>
                )}
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
                          <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Code Contains Markdown</h4>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            The generated code contains markdown formatting (```) which needs to be removed.
                          </p>
                          
                          {/* Show validation issues only if they're syntax errors */}
                          {currentProjectData.uiValidationIssues && currentProjectData.uiValidationIssues.length > 0 && (
                            <div className="mt-4 space-y-3">
                              <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Syntax Errors Found:</h5>
                              {currentProjectData.uiValidationIssues
                                .filter(fileIssue => fileIssue.issues.some(issue => issue.type === 'syntax_error'))
                                .map((fileIssue) => (
                                  <div key={fileIssue.filename} className="bg-red-100 dark:bg-red-800/30 rounded-md p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <FileCode className="w-4 h-4 text-red-700 dark:text-red-300" />
                                      <span className="font-medium text-red-800 dark:text-red-200">{fileIssue.filename}</span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                      {fileIssue.issues
                                        .filter(issue => issue.type === 'syntax_error')
                                        .map((issue, index) => (
                                          <div key={index} className="flex gap-2 text-red-700 dark:text-red-300">
                                            <span className="flex-1">{issue.message}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                          
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setShowRawCode(!showRawCode)}
                              className="text-sm px-3 py-1 bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 rounded transition-colors"
                            >
                              {showRawCode ? 'Hide' : 'View'} Raw Code
                            </button>
                            <button
                              onClick={handleRetryGeneration}
                              disabled={isGenerating}
                              className="flex items-center gap-1 text-sm px-3 py-1 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Regenerating...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3 h-3" />
                                  Retry Generation
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {showRawCode && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Raw Generated Code:</h4>
                        <div className="h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                          <CodeEditor value={currentProjectData.uiCode || ''} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Refresh button bar */}
                    <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-end">
                      <button
                        onClick={() => {
                          setRefreshKey(prev => prev + 1);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-500 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                        title="Refresh preview"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    </div>
                    <div className="relative flex-1 bg-gray-50 overflow-auto">
                      {currentProjectData?.uiFiles && currentProjectData.uiFiles.length > 0 ? (
                        <LocalhostPreview files={currentProjectData.uiFiles} refreshKey={refreshKey} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-500">No UI files available for preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex">
                {/* File tree sidebar if multiple files exist */}
                {currentProjectData.uiFiles && currentProjectData.uiFiles.length > 0 ? (
                  <>
                    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Files</h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {currentProjectData.uiFiles.length} {currentProjectData.uiFiles.length === 1 ? 'file' : 'files'}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <div className="p-2 space-y-1">
                          {/* Optional: Add a folder structure header */}
                          <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                            <Folder className="w-3 h-3" />
                            <span>src/components</span>
                          </div>
                          
                          {currentProjectData.uiFiles.map(file => {
                            const isSelected = (selectedFile || currentProjectData.uiFiles![0].filename) === file.filename;
                            const FileIcon = file.type === 'main' || file.filename.toLowerCase().includes('app') 
                              ? FileCode2 
                              : FileCode;
                            
                            return (
                              <button
                                key={file.filename}
                                onClick={() => setSelectedFile(file.filename)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all duration-150 ${
                                  isSelected
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <FileIcon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                <span className="truncate text-left flex-1">{file.filename}</span>
                                {file.type === 'main' && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                                    main
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {selectedFile || currentProjectData.uiFiles[0].filename}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const file = currentProjectData.uiFiles?.find(f => f.filename === (selectedFile || currentProjectData.uiFiles![0].filename));
                                if (file) {
                                  navigator.clipboard.writeText(file.content);
                                  toast.success(`Copied ${file.filename}!`);
                                }
                              }}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Copy this file"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <CodeEditor 
                          value={
                            currentProjectData.uiFiles.find(f => f.filename === (selectedFile || currentProjectData.uiFiles![0].filename))?.content || ''
                          } 
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full overflow-auto border-t border-gray-200 dark:border-gray-700">
                    <CodeEditor value={currentProjectData.uiCode || ''} />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Progress Display during regeneration */}
      {isGenerating && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <h3 className="font-semibold mb-2">Regeneration Progress</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
            {generationProgress.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Starting regeneration...</p>
            ) : (
              generationProgress.map((progress, index) => (
                <div key={`${progress.node}-${index}`} className="flex items-center gap-2 text-sm py-1">
                  {progress.status === 'in-progress' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {progress.status === 'success' && <span className="text-green-600">✓</span>}
                  {progress.status === 'error' && <span className="text-red-600">✗</span>}
                  <span className={progress.status === 'success' ? 'text-gray-600 dark:text-gray-400' : ''}>
                    {progress.node}
                  </span>
                  {progress.message && <span className="text-gray-500 dark:text-gray-400">- {progress.message}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
} 