import { FileText, CheckSquare, Palette, Brain } from 'lucide-react'
import { useStore } from '../store'
import IdeaTab from './tabs/IdeaTab'
import PrdTab from './tabs/PrdTab'
import ChecklistTab from './tabs/ChecklistTab'
import UiTab from './tabs/UiTab'

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
  if (cleanTitle.length > 50) {
    return cleanTitle.slice(0, 47) + '...'
  }
  
  return cleanTitle
}

const tabs = [
  { id: 'idea' as const, label: 'Idea', icon: Brain, color: 'purple' },
  { id: 'prd' as const, label: 'PRD', icon: FileText, color: 'blue' },
  { id: 'checklist' as const, label: 'Checklist', icon: CheckSquare, color: 'green' },
  { id: 'ui' as const, label: 'UI', icon: Palette, color: 'pink' },
]

export default function Workspace() {
  const { selectedProjectId, currentTab, setCurrentTab, currentProjectData, projects } = useStore()

  // Show new project form if no project selected
  if (!selectedProjectId) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <IdeaTab isNewProject />
      </div>
    )
  }

  // Find the current project from the projects list
  const currentProject = projects.find(p => p.id === selectedProjectId)
  const projectTitle = currentProject ? cleanProjectTitle(currentProject.title) : 'Loading...'

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Project Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {projectTitle}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            const colorClasses = {
              purple: isActive 
                ? 'bg-purple-500 dark:bg-purple-600 text-white border-purple-400 dark:border-purple-500' 
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 border-purple-200 dark:border-purple-800',
              blue: isActive 
                ? 'bg-blue-500 dark:bg-blue-600 text-white border-blue-400 dark:border-blue-500' 
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800',
              green: isActive 
                ? 'bg-green-500 dark:bg-green-600 text-white border-green-400 dark:border-green-500' 
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 border-green-200 dark:border-green-800',
              pink: isActive 
                ? 'bg-pink-500 dark:bg-pink-600 text-white border-pink-400 dark:border-pink-500' 
                : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900/50 border-pink-200 dark:border-pink-800',
            }
            
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all duration-200 border ${
                  colorClasses[tab.color as keyof typeof colorClasses]
                } ${isActive ? 'shadow-lg -mb-px font-semibold' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 min-h-0">
        {currentTab === 'idea' && <IdeaTab />}
        {currentTab === 'prd' && <PrdTab />}
        {currentTab === 'checklist' && <ChecklistTab />}
        {currentTab === 'ui' && <UiTab />}
      </div>
    </div>
  )
} 