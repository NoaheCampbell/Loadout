import { useState } from 'react'
import { Plus, Folder, Loader2, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { format } from 'date-fns'
import { ipc } from '../lib/ipc'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const { projects, selectedProjectId, selectProject, setProjectData, setCurrentTab, deleteProject, setProjects } = useStore()
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

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
    
    if (!confirm(`Are you sure you want to delete "${projectTitle}"? This action cannot be undone.`)) {
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

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col">
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
                      <p className="text-sm font-medium truncate">{project.title || 'Untitled Project'}</p>
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
    </aside>
  )
} 