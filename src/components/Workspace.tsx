import { FileText, CheckSquare, Palette, Brain } from 'lucide-react'
import { useStore } from '../store'
import IdeaTab from './tabs/IdeaTab'
import PrdTab from './tabs/PrdTab'
import ChecklistTab from './tabs/ChecklistTab'
import UiTab from './tabs/UiTab'

const tabs = [
  { id: 'idea' as const, label: 'Idea', icon: Brain },
  { id: 'prd' as const, label: 'PRD', icon: FileText },
  { id: 'checklist' as const, label: 'Checklist', icon: CheckSquare },
  { id: 'ui' as const, label: 'UI', icon: Palette },
]

export default function Workspace() {
  const { selectedProjectId, currentTab, setCurrentTab, currentProjectData } = useStore()

  // Show new project form if no project selected
  if (!selectedProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <IdeaTab isNewProject />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Project Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold">
            {currentProjectData?.idea ? 
              currentProjectData.idea.split('\n')[0].slice(0, 50) + 
              (currentProjectData.idea.split('\n')[0].length > 50 ? '...' : '') : 
              'New Project'}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
                  currentTab === tab.id
                    ? 'bg-gray-50 dark:bg-gray-900 border-t border-l border-r border-gray-200 dark:border-gray-700 -mb-px'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        {currentTab === 'idea' && <IdeaTab />}
        {currentTab === 'prd' && <PrdTab />}
        {currentTab === 'checklist' && <ChecklistTab />}
        {currentTab === 'ui' && <UiTab />}
      </div>
    </div>
  )
} 