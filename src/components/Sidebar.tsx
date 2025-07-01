import { useState, useRef, useEffect } from 'react'
import { Plus, Folder, Loader2, Trash2, ChevronRight, ChevronDown, CheckCircle, AlertCircle, GripVertical } from 'lucide-react'
import { useStore } from '../store'
import { format } from 'date-fns'
import { ipc } from '../lib/ipc'
import toast from 'react-hot-toast'
import { GenerationProgress } from '../types'

// Helper function to clean markdown and format project titles
function cleanProjectTitle(title: string): string {
  if (!title) return 'Untitled Project'
  
  // Remove markdown formatting
  let cleanTitle = title
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **text**
    .replace(/\*(.*?)\*/g, '$1')     // Remove italic *text*
    .replace(/`(.*?)`/g, '$1')       // Remove inline code `text`
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links [text](url)
    .replace(/^#+\s*/gm, '')         // Remove heading markers
    .replace(/^(Title:|Project Title:)\s*/i, '') // Remove title prefixes
    .trim()
  
  // Handle edge cases
  if (!cleanTitle || cleanTitle.toLowerCase() === 'project title' || cleanTitle.length < 3) {
    return 'Untitled Project'
  }
  
  // Ensure title isn't too long
  if (cleanTitle.length > 40) {
    return cleanTitle.slice(0, 37) + '...'
  }
  
  return cleanTitle
}

// Get a user-friendly node name
function getNodeDisplayName(node: string): string {
  const nodeNames: Record<string, string> = {
    'IdeaInputNode': 'Processing Idea',
    'PRDGeneratorNode': 'Generating PRD',
    'ChecklistGeneratorNode': 'Creating Checklist',
    'BrainliftNode': 'Documenting Decisions',
    'UIPlannerNode': 'Planning UI',
    'UIStrategyDecisionNode': 'Determining Strategy',
    'UIGenerationNode': 'UI Generation',
    'GPTUICodeNode': 'Generating Code',
    'V0PromptNode': 'Creating v0 Prompt',
    'saveProject': 'Saving Project'
  }
  
  // If it's a known node, return the friendly name
  if (nodeNames[node]) {
    return nodeNames[node]
  }
  
  // Otherwise, it's likely a component name - just return it as-is
  // but maybe add .tsx or Page suffix handling
  if (node.endsWith('Page')) {
    return node // Keep "AboutPage", "SettingsPage" etc as-is
  }
  
  // For component names, keep them as-is
  return node
}

export default function Sidebar() {
  const { 
    projects, 
    selectedProjectId, 
    selectProject, 
    setProjectData, 
    setCurrentTab, 
    deleteProject, 
    setProjects,
    isGenerating,
    generationProgress 
  } = useStore()
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['UIGenerationNode']))
  
  // Resize states with localStorage persistence
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('loadout-sidebar-width')
    return saved ? parseInt(saved, 10) : 256
  })
  const [workflowHeight, setWorkflowHeight] = useState(() => {
    const saved = localStorage.getItem('loadout-workflow-height')
    return saved ? parseInt(saved, 10) : 256
  })
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isResizingSidebar = useRef(false)
  const isResizingWorkflow = useRef(false)

  // Load saved dimensions from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('loadout-sidebar-width')
    if (savedWidth) setSidebarWidth(parseInt(savedWidth))
    
    const savedHeight = localStorage.getItem('loadout-workflow-height')
    if (savedHeight) setWorkflowHeight(parseInt(savedHeight))
  }, [])
  
  // Save dimensions to localStorage when they change
  useEffect(() => {
    if (sidebarWidth !== 280) {
      localStorage.setItem('loadout-sidebar-width', sidebarWidth.toString())
    }
    
    if (workflowHeight !== 300) {
      localStorage.setItem('loadout-workflow-height', workflowHeight.toString())
    }
  }, [sidebarWidth, workflowHeight])

  // Define the main workflow nodes that should always be visible
  const mainWorkflowNodes = [
    'IdeaInputNode',
    'PRDGeneratorNode',
    'ChecklistGeneratorNode',
    'BrainliftNode',
    'UIPlannerNode',
    'UIStrategyDecisionNode',
    'UIGenerationNode',
    'saveProject'
  ]

  // Handle sidebar resize
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingSidebar.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Handle workflow section resize
  const handleWorkflowMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingWorkflow.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) {
        const newWidth = Math.max(200, Math.min(400, e.clientX))
        setSidebarWidth(newWidth)
      } else if (isResizingWorkflow.current && sidebarRef.current) {
        const sidebarRect = sidebarRef.current.getBoundingClientRect()
        const relativeY = e.clientY - sidebarRect.top
        // Subtract heights of new project button and workflow header (approximately 180px)
        const maxHeight = sidebarRect.height - 300
        const newHeight = Math.max(100, Math.min(maxHeight, relativeY - 180))
        setWorkflowHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      isResizingSidebar.current = false
      isResizingWorkflow.current = false
      document.body.style.cursor = 'auto'
      document.body.style.userSelect = 'auto'
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const toggleNodeExpansion = (node: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(node)) {
        newSet.delete(node)
      } else {
        newSet.add(node)
      }
      return newSet
    })
  }

  const renderProgressNode = (progress: GenerationProgress, childNodes: GenerationProgress[] = []) => {
    const isExpanded = expandedNodes.has(progress.node)
    const hasChildren = childNodes.length > 0
    
    return (
      <div key={progress.node}>
        <div className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          {/* Fixed width container for expand/collapse button */}
          <div className="w-5 flex items-center justify-center flex-shrink-0">
            {hasChildren && (
              <button
                onClick={() => toggleNodeExpansion(progress.node)}
                className="p-0.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
          </div>
          
          {/* Fixed width container for status icon */}
          <div className="w-5 flex items-center justify-center flex-shrink-0">
            {progress.status === 'in-progress' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            {progress.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
            {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
            {progress.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
          </div>
          
          <span className={`flex-1 ${progress.status === 'success' ? 'text-gray-600 dark:text-gray-400' : ''}`}>
            {getNodeDisplayName(progress.node)}
          </span>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-9 border-l border-gray-200 dark:border-gray-700 pl-2">
            {childNodes.map(child => renderProgressNode(child))}
          </div>
        )}
      </div>
    )
  }

  const handleNewProject = () => {
    // Reset to show new project form
    selectProject(null)
    setProjectData(null)
    setCurrentTab('idea')
  }

  const handleSelectProject = async (projectId: string) => {
    if (loadingProjectId || deletingProjectId) return // Prevent actions during loading/deleting
    
    setLoadingProjectId(projectId)
    selectProject(projectId)
    setCurrentTab('idea')
    
    // Load project data
    try {
      const projectData = await ipc.loadProject(projectId)
      if (projectData) {
        setProjectData(projectData)
      } else {
        console.error('No project data returned for:', projectId)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
    } finally {
      setLoadingProjectId(null)
    }
  }

  const handleDeleteProject = async (projectId: string, projectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent project selection
    
    const cleanedTitle = cleanProjectTitle(projectTitle)
    if (!confirm(`Are you sure you want to delete "${cleanedTitle}"? This action cannot be undone.`)) {
      return
    }
    
    setDeletingProjectId(projectId)
    
    try {
      const result = await ipc.deleteProject(projectId)
      if (result.success) {
        deleteProject(projectId)
        if (result.projects) {
          setProjects(result.projects)
        }
        toast.success('Project deleted successfully')
      } else {
        toast.error(result.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('Failed to delete project')
    } finally {
      setDeletingProjectId(null)
    }
  }

  // Get the status of a node from progress or default to pending
  const getNodeProgress = (nodeName: string): GenerationProgress => {
    const found = generationProgress.find(p => p.node === nodeName)
    return found || { node: nodeName, status: 'pending' }
  }

  // Organize progress nodes hierarchically
  const getChildNodes = (parentNode: string) => 
    generationProgress.filter(p => p.parentNode === parentNode)

  return (
    <aside 
      ref={sidebarRef}
      className="relative border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* New Project Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewProject}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Workflow Progress (when generating) */}
      {isGenerating && (
        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="p-4 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              🦜️🔗 LangGraph Workflow
            </h3>
          </div>
          <div 
            className="overflow-y-auto px-4 pb-4"
            style={{ height: `${workflowHeight}px` }}
          >
            <div className="space-y-1">
              {mainWorkflowNodes.map(nodeName => {
                const progress = getNodeProgress(nodeName)
                const childNodes = getChildNodes(nodeName)
                return renderProgressNode(progress, childNodes)
              })}
            </div>
          </div>
          
          {/* Workflow resize handle */}
          <div 
            className="h-2 cursor-row-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors relative group"
            onMouseDown={handleWorkflowMouseDown}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-8 h-0.5 bg-gray-400 dark:bg-gray-500 group-hover:bg-white rounded-full transition-colors" />
                <div className="w-8 h-0.5 bg-gray-400 dark:bg-gray-500 group-hover:bg-white rounded-full transition-colors" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-2">
            Project History
          </h3>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No React apps yet</p>
              <p className="text-xs">Create your first React app!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  disabled={deletingProjectId === project.id}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                    selectedProjectId === project.id
                      ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-sm'
                  } ${deletingProjectId === project.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {loadingProjectId === project.id ? (
                      <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                    ) : (
                      <Folder className="w-4 h-4 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cleanProjectTitle(project.title || 'Untitled Project')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(project.created), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, project.title, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-all"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar resize handle */}
      <div 
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors group"
        onMouseDown={handleSidebarMouseDown}
      >
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col gap-1">
          <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 group-hover:bg-white rounded-full transition-colors" />
          <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 group-hover:bg-white rounded-full transition-colors" />
        </div>
      </div>
    </aside>
  )
} 