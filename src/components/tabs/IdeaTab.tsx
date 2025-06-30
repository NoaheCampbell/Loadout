import { useState, useEffect } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { ipc } from '../../lib/ipc'
import toast from 'react-hot-toast'

interface IdeaTabProps {
  isNewProject?: boolean
}

export default function IdeaTab({ isNewProject = false }: IdeaTabProps) {
  const { 
    isGenerating, 
    setGenerating, 
    addProgress, 
    clearProgress, 
    selectProject, 
    setCurrentTab,
    setProjects,
    setProjectData,
    currentProjectData,
    generationProgress 
  } = useStore()
  
  const [idea, setIdea] = useState(currentProjectData?.idea || '')

  // Update idea when project changes
  useEffect(() => {
    setIdea(currentProjectData?.idea || '')
  }, [currentProjectData])

  const handleGenerate = async () => {
    if (!idea.trim()) {
      toast.error('Please enter a project idea')
      return
    }

    // Confirm if regenerating
    if (currentProjectData?.prd) {
      const confirmed = window.confirm('This will replace the existing PRD and all generated content. Continue?')
      if (!confirmed) return
    }

    setGenerating(true)
    clearProgress()

    try {
      // Set up progress listener
      const unsubscribe = ipc.onGenerationProgress((progress) => {
        console.log('Frontend: Received progress update:', progress)
        addProgress(progress)
      })

      // Generate the project
      console.log('Frontend: Calling generate project...')
      const result = await ipc.generateProject(idea)
      console.log('Frontend: Generation result:', result)

      if (result.success && result.data?.projectId) {
        console.log('Frontend: Project generated successfully')
        toast.success('Project generated successfully!')
        
        // Update projects list if provided
        if (result.data.projects) {
          console.log('Frontend: Updating projects list:', result.data.projects.length, 'projects')
          setProjects(result.data.projects)
        }
        
        // Small delay to ensure files are written
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Load the new project data
        console.log('Frontend: Loading project data for:', result.data.projectId)
        const projectData = await ipc.loadProject(result.data.projectId)
        console.log('Frontend: Project data loaded:', projectData ? 'success' : 'failed')
        
        if (projectData) {
          setProjectData(projectData)
          selectProject(result.data.projectId)
          setCurrentTab('prd')
          
          // Clear the idea input for new projects
          if (isNewProject) {
            setIdea('')
          }
        } else {
          toast.error('Failed to load generated project data')
        }
      } else {
        console.log('Frontend: Generation failed:', result.error)
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
                {currentProjectData?.prd ? 'Regenerate PRD' : 'Generate PRD'}
              </>
            )}
          </button>
        </div>

        {/* Progress Display */}
        {(isGenerating || generationProgress.length > 0) && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Generation Progress</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
              {generationProgress.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Starting generation...</p>
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
    </div>
  )
} 