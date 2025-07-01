import ReactMarkdown from 'react-markdown'
import { Copy, RefreshCw } from 'lucide-react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

export default function PrdTab() {
  const { currentProjectData, projects, selectedProjectId } = useStore()
  const currentProject = projects.find(p => p.id === selectedProjectId)

  const handleCopy = () => {
      if (currentProjectData?.prd) {
      // Format the PRD in the new structure
      const prdText = `# ${currentProject?.title || 'Project Name'}

## Project Description
${currentProjectData.prd.problem}

## Target Audience
${currentProjectData.prd.scope}

## Desired Features
${currentProjectData.prd.goals.join('\n\n')}

## Design Requests
${currentProjectData.prd.constraints.join('\n')}

## Other Notes
${currentProjectData.prd.success_criteria.map(criteria => `- ${criteria}`).join('\n')}`
      navigator.clipboard.writeText(prdText)
      toast.success('PRD copied to clipboard!')
    }
  }

  const handleRegenerate = () => {
    toast('Regenerate functionality coming soon!')
  }

  if (!currentProjectData?.prd) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No PRD generated yet. Start by entering your project idea in the Idea tab.</p>
      </div>
    )
  }

  const { prd } = currentProjectData

  return (
    <div className="h-full overflow-y-auto">
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
          <h1>{currentProject?.title || 'Product Requirements Document'}</h1>
          
          <h2>Project Description</h2>
          <ReactMarkdown>{prd.problem}</ReactMarkdown>

          <h2>Target Audience</h2>
          <ReactMarkdown>{prd.scope}</ReactMarkdown>

          <h2>Desired Features</h2>
          {prd.goals.map((goal, index) => (
            <div key={index} className="mb-4">
              <ReactMarkdown>{goal}</ReactMarkdown>
            </div>
          ))}

          <h2>Design Requests</h2>
          {prd.constraints.map((constraint, index) => (
            <div key={index} className="mb-2">
              <ReactMarkdown>{constraint}</ReactMarkdown>
            </div>
          ))}

          <h2>Other Notes</h2>
          <ul>
            {prd.success_criteria.map((criteria, index) => (
              <li key={index}>{criteria}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
} 