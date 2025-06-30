import ReactMarkdown from 'react-markdown'
import { Copy, RefreshCw } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

export default function PrdTab() {
  const { currentProjectData } = useStore()

  const handleCopy = () => {
    if (currentProjectData?.prd) {
      const prdText = `# Product Requirements Document\n\n## Problem\n${currentProjectData.prd.problem}\n\n## Goals\n${currentProjectData.prd.goals.join('\n- ')}\n\n## Scope\n${currentProjectData.prd.scope}\n\n## Constraints\n${currentProjectData.prd.constraints.join('\n- ')}\n\n## Success Criteria\n${currentProjectData.prd.success_criteria.join('\n- ')}`
      navigator.clipboard.writeText(prdText)
      toast.success('PRD copied to clipboard!')
    }
  }

  const handleRegenerate = () => {
    toast('Regenerate functionality coming soon!')
  }

  if (!currentProjectData?.prd) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No PRD generated yet. Start by entering your project idea in the Idea tab.</p>
      </div>
    )
  }

  const { prd } = currentProjectData

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Actions */}
      <div className="flex justify-end gap-2 mb-6">
        <button
          onClick={handleRegenerate}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>
      </div>

      {/* PRD Content */}
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <h1>Product Requirements Document</h1>
        
        <h2>Problem</h2>
        <p>{prd.problem}</p>

        <h2>Goals</h2>
        <ul>
          {prd.goals.map((goal, index) => (
            <li key={index}>{goal}</li>
          ))}
        </ul>

        <h2>Scope</h2>
        <p>{prd.scope}</p>

        <h2>Constraints</h2>
        <ul>
          {prd.constraints.map((constraint, index) => (
            <li key={index}>{constraint}</li>
          ))}
        </ul>

        <h2>Success Criteria</h2>
        <ul>
          {prd.success_criteria.map((criteria, index) => (
            <li key={index}>{criteria}</li>
          ))}
        </ul>
      </div>
    </div>
  )
} 