import { FileText, CheckSquare, Palette, Brain, Download, GitBranch } from 'lucide-react'
import { useStore } from '../store'
import IdeaTab from './tabs/IdeaTab'
import PrdTab from './tabs/PrdTab'
import ChecklistTab from './tabs/ChecklistTab'
import UiTab from './tabs/UiTab'
import { WorkflowTab } from './tabs/WorkflowTab'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

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
      { id: 'workflow' as const, label: 'Workflow', icon: GitBranch, color: 'purple' },
]

export default function Workspace() {
  const { selectedProjectId, currentTab, setCurrentTab, currentProjectData, projects } = useStore()

  const handleExportProject = async () => {
    if (!currentProjectData) {
      toast.error('No project data to export')
      return
    }

    try {
      const zip = new JSZip()
      const currentProject = projects.find(p => p.id === selectedProjectId)
      const projectName = currentProject?.title || 'project-export'
      const sanitizedProjectName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      
      // Create project folder
      const projectFolder = zip.folder(sanitizedProjectName)
      if (!projectFolder) {
        throw new Error('Failed to create project folder')
      }
      
      // Add PRD
      if (currentProjectData.prd) {
        const prdContent = `# Product Requirements Document

## Project: ${projectName}

### Problem Statement
${currentProjectData.prd.problem}

### Goals
${currentProjectData.prd.goals.map((goal, i) => `${i + 1}. ${goal}`).join('\n')}

### Scope
${currentProjectData.prd.scope}

### Constraints
${currentProjectData.prd.constraints.map((constraint, i) => `${i + 1}. ${constraint}`).join('\n')}

### Success Criteria
${currentProjectData.prd.success_criteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}
`
        projectFolder.file('PRD.md', prdContent)
      }
      
      // Add Checklist
      if (currentProjectData.checklist && currentProjectData.checklist.length > 0) {
        const checklistContent = currentProjectData.checklist
          .map(item => {
            // For items with checkboxes, update their done status
            if (item.text.includes('[ ]')) {
              return item.text.replace(/\[ \]/g, `[${item.done ? 'x' : ' '}]`)
            }
            return item.text
          })
          .join('\n')
        
        projectFolder.file('Checklist.md', checklistContent)
      }
      
      // Add Brainlift
      if (currentProjectData.brainlift) {
        const brainliftContent = `# Brainlift - Technical Decisions & Assumptions

## Assumptions
${currentProjectData.brainlift.assumptions?.map((assumption, i) => `${i + 1}. ${assumption}`).join('\n') || 'No assumptions documented'}

## Technical Decisions
${currentProjectData.brainlift.decisions?.map((decision, i) => `${i + 1}. ${decision}`).join('\n') || 'No decisions documented'}

## Context & References
${currentProjectData.brainlift.contextLinks?.map((link, i) => `${i + 1}. ${link}`).join('\n') || 'No references documented'}
`
        projectFolder.file('Brainlift.md', brainliftContent)
      }
      
      // Add UI Files
      if (currentProjectData.uiFiles && currentProjectData.uiFiles.length > 0) {
        const uiFolder = projectFolder.folder('ui-components')
        
        currentProjectData.uiFiles.forEach(file => {
          if (uiFolder) {
            // Convert .tsx to .js for better compatibility
            const fileName = file.filename.replace('.tsx', '.js')
            uiFolder.file(fileName, file.content)
          }
        })
        
        // Add UI Build Guide if available
        const uiBuildGuide = currentProjectData.uiFiles.find(f => f.filename === 'UI_BUILD_GUIDE.md')
        if (uiBuildGuide && uiFolder) {
          uiFolder.file('UI_BUILD_GUIDE.md', uiBuildGuide.content)
        }
      } else if (currentProjectData.uiCode) {
        // Fallback to single UI file
        projectFolder.file('UI.jsx', currentProjectData.uiCode)
      }
      
      // Add v0 Prompt if using v0 strategy
      if (currentProjectData.v0Prompt) {
        projectFolder.file('v0-prompt.json', JSON.stringify(currentProjectData.v0Prompt, null, 2))
      }
      
      // Add README
      const readmeContent = `# ${projectName}

Generated by Loadout on ${new Date().toLocaleString()}

This project contains:
- Product Requirements Document (PRD.md)
- Development Checklist (Checklist.md)  
- Technical Assumptions (Brainlift.md)
- UI Components (ui-components/)
${currentProjectData.v0Prompt ? '- v0 Prompt (v0-prompt.json)\n' : ''}

## How to use these files

1. **Start with PRD.md** - Understand the project requirements
2. **Review Checklist.md** - Follow the development phases
3. **Check Brainlift.md** - Review technical assumptions
4. **Use UI Components** - Implement the generated UI code

## UI Preview

To preview the generated UI:
1. Open the exported ui-components folder
2. Open index.html in a web browser
3. All components will be loaded and the app will render

${currentProjectData.uiStrategy === 'v0' ? '## v0.dev Integration\n\nThis project was designed for v0.dev. Use the v0-prompt.json file to generate the UI on v0.dev.' : ''}
`
      
      projectFolder.file('README.md', readmeContent)
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' })
      
      // Save the file
      const fileName = `${sanitizedProjectName}-export.zip`
      saveAs(content, fileName)
      
      toast.success(`Exported project to ${fileName}`)
    } catch (error) {
      console.error('Failed to export project:', error)
      toast.error('Failed to export project')
    }
  }

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

  const renderTab = () => {
    switch (currentTab) {
      case 'idea':
        return <IdeaTab />
      case 'prd':
        return <PrdTab />
      case 'checklist':
        return <ChecklistTab />
      case 'ui':
        return <UiTab />
      case 'workflow':
        return <WorkflowTab />
      default:
        return <IdeaTab />
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Project Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {projectTitle}
          </h2>
          {currentProjectData && (
            <button
              onClick={handleExportProject}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              title="Export entire project"
            >
              <Download className="w-4 h-4" />
              Export Project
            </button>
          )}
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
        {renderTab()}
      </div>
    </div>
  )
} 