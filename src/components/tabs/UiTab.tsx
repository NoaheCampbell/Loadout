import { useState } from 'react'
import { Code, Eye } from 'lucide-react'
import { useStore } from '../../store'
import MonacoEditor from '@monaco-editor/react'
import { Sandpack } from '@codesandbox/sandpack-react'
import { dracula } from '@codesandbox/sandpack-themes'

export default function UiTab() {
  const { currentProjectData, uiViewMode, setUiViewMode, theme } = useStore()
  
  if (!currentProjectData?.uiCode) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No UI generated yet. Complete the PRD generation first!</p>
      </div>
    )
  }

  const { uiCode } = currentProjectData

  return (
    <div className="flex-1 flex flex-col">
      {/* View Toggle */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-1 px-6 py-2">
          <button
            onClick={() => setUiViewMode('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              uiViewMode === 'preview'
                ? 'bg-gray-100 dark:bg-gray-700'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setUiViewMode('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              uiViewMode === 'code'
                ? 'bg-gray-100 dark:bg-gray-700'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Code className="w-4 h-4" />
            Code
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {uiViewMode === 'preview' ? (
          <div className="h-full p-4">
            <Sandpack
              template="react"
              theme={theme === 'dark' ? dracula : undefined}
              files={{
                '/App.js': uiCode,
              }}
              options={{
                showNavigator: false,
                showTabs: false,
                showLineNumbers: true,
                showInlineErrors: true,
                wrapContent: true,
                editorHeight: "100%",
              }}
              customSetup={{
                dependencies: {
                  'lucide-react': 'latest',
                  'clsx': 'latest',
                },
              }}
            />
          </div>
        ) : (
          <MonacoEditor
            height="100%"
            language="typescript"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={uiCode}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
            }}
          />
        )}
      </div>
    </div>
  )
} 