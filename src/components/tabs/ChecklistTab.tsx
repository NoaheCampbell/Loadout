import { Copy, Check } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

export default function ChecklistTab() {
  const { currentProjectData } = useStore()

  const handleCopy = () => {
    if (currentProjectData?.checklist) {
      // Preserve the original markdown formatting
      const checklistText = currentProjectData.checklist
        .map(item => {
          // For items with checkboxes, update their done status
          if (item.text.includes('[ ]')) {
            return item.text.replace(/\[ \]/g, `[${item.done ? 'x' : ' '}]`)
          }
          return item.text
        })
        .join('\n')
      navigator.clipboard.writeText(checklistText)
      toast.success('Checklist copied to clipboard!')
    }
  }

  if (!currentProjectData?.checklist) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No checklist generated yet. Generate a PRD first!</p>
      </div>
    )
  }

  const { checklist } = currentProjectData

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Development Checklist</h1>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>

        {/* Checklist Items */}
        <div className="space-y-1">
          {checklist.map((item) => {
            // Determine the type of item based on content
            const isPhaseOverview = item.text.startsWith('## Phases Overview')
            const isPhaseHeader = item.text.startsWith('## Phase')
            const isCriteria = item.text.startsWith('**Criteria:**')
            const isFeature = item.text.match(/^\[ \] Feature \d+:/)
            const isSubFeature = item.text.match(/^\s{4,}- \[ \]/)
            const isPhaseCheckbox = item.text.match(/^- \[ \] Phase \d+:/)
            const isEmpty = item.text.trim() === ''
            
            // Skip rendering empty lines in the list view
            if (isEmpty) return null
            
            // Render different styles based on item type
            if (isPhaseOverview || isPhaseHeader) {
              return (
                <div key={item.id} className="mt-8 mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {item.text.replace(/^##\s*/, '')}
                  </h2>
                </div>
              )
            }
            
            if (isCriteria) {
              return (
                <div key={item.id} className="mb-3 text-sm text-gray-600 dark:text-gray-400 italic">
                  {item.text.replace(/\*\*/g, '')}
                </div>
              )
            }
            
            // Regular checkbox items
            const indent = isSubFeature ? 'ml-8' : isFeature ? 'ml-0' : isPhaseCheckbox ? 'ml-4' : 'ml-0'
            const bgColor = isFeature ? 'bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-gray-800'
            const borderColor = isFeature ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'
            
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 ${bgColor} rounded-lg border ${borderColor} ${indent}`}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 ${
                  item.done 
                    ? 'bg-green-600 border-green-600' 
                    : 'border-gray-300 dark:border-gray-600'
                } flex items-center justify-center`}>
                  {item.done && <Check className="w-3 h-3 text-white" />}
                </div>
                <p className={`flex-1 text-sm ${item.done ? 'line-through text-gray-500' : ''}`}>
                  {item.text
                    .replace(/^\[ \] /, '')
                    .replace(/^- \[ \] /, '')
                    .replace(/^\s{4,}- \[ \] /, '')
                    .trim()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {checklist.filter(item => item.done).length} of {checklist.length} items completed
          </p>
        </div>
      </div>
    </div>
  )
} 