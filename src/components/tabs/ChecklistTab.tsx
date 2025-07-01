import { Copy, Check } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

export default function ChecklistTab() {
  const { currentProjectData } = useStore()

  const handleCopy = () => {
    if (currentProjectData?.checklist) {
      const checklistText = currentProjectData.checklist
        .map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`)
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
        <div className="space-y-3">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded border-2 ${
                item.done 
                  ? 'bg-blue-600 border-blue-600' 
                  : 'border-gray-300 dark:border-gray-600'
              } flex items-center justify-center`}>
                {item.done && <Check className="w-4 h-4 text-white" />}
              </div>
              <p className={`flex-1 ${item.done ? 'line-through text-gray-500' : ''}`}>
                {item.text}
              </p>
            </div>
          ))}
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