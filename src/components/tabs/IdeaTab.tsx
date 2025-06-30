import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { ipc } from '../../lib/ipc'
import toast from 'react-hot-toast'
import { nanoid } from 'nanoid'

interface IdeaTabProps {
  isNewProject?: boolean
}

export default function IdeaTab({ isNewProject = false }: IdeaTabProps) {
  const [idea, setIdea] = useState('')
  const { isGenerating, setGenerating, addProgress, clearProgress, selectProject, setCurrentTab } = useStore()

  const handleGenerate = async () => {
    if (!idea.trim()) {
      toast.error('Please enter a project idea')
      return
    }

    setGenerating(true)
    clearProgress()

    try {
      // Create a new project ID
      const projectId = nanoid()
      
      // Set up progress listener
      const unsubscribe = ipc.onGenerationProgress((progress) => {
        addProgress(progress)
      })

      // Generate the project
      const result = await ipc.generateProject(idea)

      if (result.success) {
        toast.success('Project generated successfully!')
        selectProject(projectId)
        setCurrentTab('prd')
      } else {
        toast.error(result.error || 'Failed to generate project')
      }

      // Clean up listener
      unsubscribe()
    } catch (error) {
      console.error('Generation error:', error)
      toast.error('An error occurred while generating the project')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {isNewProject ? "What's your project idea?" : "Project Idea"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Describe your project in a few sentences. Be specific about what you want to build.
          </p>
        </div>

        <div>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="I want to build a web app that..."
            className="w-full h-64 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isGenerating}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !idea.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate PRD
              </>
            )}
          </button>
        </div>

        {/* Progress Display */}
        {isGenerating && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Generation Progress</h3>
            <div className="space-y-2">
              {useStore.getState().generationProgress.map((progress, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  {progress.status === 'in-progress' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {progress.status === 'success' && <span className="text-green-600">✓</span>}
                  {progress.status === 'error' && <span className="text-red-600">✗</span>}
                  <span>{progress.node}</span>
                  {progress.message && <span className="text-gray-500">- {progress.message}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 