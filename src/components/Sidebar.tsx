import { Plus, Folder } from 'lucide-react'
import { useStore } from '../store'
import { format } from 'date-fns'

export default function Sidebar() {
  const { projects, selectedProjectId, selectProject } = useStore()

  const handleNewProject = () => {
    // For now, just select null to show new project form
    selectProject(null)
  }

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col">
      {/* New Project Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewProject}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
              <p className="text-sm">No projects yet</p>
              <p className="text-xs">Create your first project!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedProjectId === project.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(project.created), 'MMM d, yyyy')}
                      </p>
                    </div>
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