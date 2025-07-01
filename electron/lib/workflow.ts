import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { StateGraph, Annotation } from '@langchain/langgraph'
import { nanoid } from 'nanoid'
import type { 
  ProjectIdea, 
  PRD, 
  ChecklistItem,
  BrainliftLog, 
  UIPlan, 
  UIStrategy,
  ProjectFiles,
  ChatMessage,
  UIFile,
  FileValidationIssues
} from '../../src/types'
import { storage } from './storage'

// Define the workflow state using LangGraph Annotation
const WorkflowStateAnnotation = Annotation.Root({
  // Input
  idea: Annotation<string>,
  chatHistory: Annotation<ChatMessage[]>({
    reducer: (current, update) => update ?? current,
    default: () => []
  }),
  projectId: Annotation<string>,
  
  // Generated artifacts
  projectIdea: Annotation<ProjectIdea | undefined>,
  prd: Annotation<PRD | undefined>,
  checklist: Annotation<ChecklistItem[] | undefined>,
  brainlift: Annotation<BrainliftLog | undefined>,
  uiPlan: Annotation<UIPlan | undefined>,
  uiStrategy: Annotation<UIStrategy | undefined>,
  uiCode: Annotation<string | undefined>,
  uiFiles: Annotation<UIFile[] | undefined>,
  v0Prompt: Annotation<any>,
  validationIssues: Annotation<FileValidationIssues[] | undefined>,
  
  // Control
  error: Annotation<string | undefined>,
  onProgress: Annotation<ProgressCallback | undefined>
})

// Type alias for the state
type WorkflowState = typeof WorkflowStateAnnotation.State

// Initialize LLM
const llm = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0.7,
})

const codeLLM = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0.5,
})

// Progress callback type
type ProgressCallback = (node: string, status: 'pending' | 'in-progress' | 'success' | 'error', message?: string) => void

// ===== LangGraph Node Functions =====

// Process idea node
async function processIdeaNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    state.onProgress?.('IdeaInputNode', 'in-progress', 'Processing your idea...')
    const projectIdea = await processIdea(state.idea)
    state.onProgress?.('IdeaInputNode', 'success')
    return { projectIdea }
  } catch (error) {
    state.onProgress?.('IdeaInputNode', 'error', error instanceof Error ? error.message : 'Failed to process idea')
    return { error: error instanceof Error ? error.message : 'Failed to process idea' }
  }
}

// Generate PRD node
async function generatePRDNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.projectIdea) throw new Error('Project idea required')
    state.onProgress?.('PRDGeneratorNode', 'in-progress', 'Generating PRD...')
    const prd = await generatePRD(state.projectIdea)
    state.onProgress?.('PRDGeneratorNode', 'success')
    return { prd }
  } catch (error) {
    state.onProgress?.('PRDGeneratorNode', 'error', error instanceof Error ? error.message : 'Failed to generate PRD')
    return { error: error instanceof Error ? error.message : 'Failed to generate PRD' }
  }
}

// Generate checklist node
async function generateChecklistNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.prd) throw new Error('PRD required')
    state.onProgress?.('ChecklistGeneratorNode', 'in-progress', 'Creating development checklist...')
    const checklist = await generateChecklist(state.prd)
    state.onProgress?.('ChecklistGeneratorNode', 'success')
    return { checklist }
  } catch (error) {
    state.onProgress?.('ChecklistGeneratorNode', 'error', error instanceof Error ? error.message : 'Failed to generate checklist')
    return { error: error instanceof Error ? error.message : 'Failed to generate checklist' }
  }
}

// Generate brainlift node (optional)
async function generateBrainliftNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.projectIdea || !state.prd) return {} // Skip if prerequisites not met
    state.onProgress?.('BrainliftNode', 'in-progress', 'Documenting assumptions and decisions...')
    const brainlift = await generateBrainlift(state.projectIdea, state.prd)
    if (brainlift) {
      state.onProgress?.('BrainliftNode', 'success')
    }
    return { brainlift: brainlift || undefined }
  } catch (error) {
    console.error('Failed to generate brainlift:', error)
    return {} // Non-critical, don't set error
  }
}

// Generate UI plan node
async function generateUIPlanNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.projectIdea || !state.prd) throw new Error('Project idea and PRD required')
    state.onProgress?.('UIPlannerNode', 'in-progress', 'Planning UI components...')
    const uiPlan = await generateUIPlan(state.projectIdea, state.prd)
    state.onProgress?.('UIPlannerNode', 'success')
    return { uiPlan }
  } catch (error) {
    state.onProgress?.('UIPlannerNode', 'error', error instanceof Error ? error.message : 'Failed to generate UI plan')
    return { error: error instanceof Error ? error.message : 'Failed to generate UI plan' }
  }
}

// Determine strategy node
async function determineStrategyNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.uiPlan) throw new Error('UI plan required')
    state.onProgress?.('UIStrategyDecisionNode', 'in-progress', 'Determining UI generation strategy...')
    const uiStrategy = determineUIStrategy(state.uiPlan)
    state.onProgress?.('UIStrategyDecisionNode', 'success')
    return { uiStrategy }
  } catch (error) {
    state.onProgress?.('UIStrategyDecisionNode', 'error', error instanceof Error ? error.message : 'Failed to determine strategy')
    return { error: error instanceof Error ? error.message : 'Failed to determine strategy' }
  }
}

// Generate UI node
async function generateUINode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.projectIdea || !state.uiPlan || !state.uiStrategy) {
      throw new Error('Project idea, UI plan, and strategy required')
    }
    
    if (state.uiStrategy === 'gpt') {
      state.onProgress?.('GPTUICodeNode', 'in-progress', 'Generating UI code...')
      
      try {
        const generateResult = await generateUIFiles(state.projectIdea, state.uiPlan, state.onProgress)
        const uiFiles = generateResult.files
        const validationIssues = generateResult.validationIssues
        
        // Also generate single file for backwards compatibility
        const uiCode = uiFiles.map(file => `// File: ${file.filename}\n${file.content}`).join('\n\n')
        
        state.onProgress?.('GPTUICodeNode', 'success')
        return { uiFiles, uiCode, validationIssues }
      } catch (error) {
        console.error('Multi-file generation failed, falling back to single file:', error)
        const uiCode = await generateUICode(state.projectIdea, state.uiPlan)
        state.onProgress?.('GPTUICodeNode', 'success')
        return { uiCode }
      }
    } else {
      state.onProgress?.('V0PromptNode', 'in-progress', 'Generating v0 prompt...')
      const v0Prompt = await generateV0Prompt(state.projectIdea, state.uiPlan)
      state.onProgress?.('V0PromptNode', 'success')
      return { v0Prompt }
    }
  } catch (error) {
    const nodeName = state.uiStrategy === 'gpt' ? 'GPTUICodeNode' : 'V0PromptNode'
    state.onProgress?.(nodeName, 'error', error instanceof Error ? error.message : 'Failed to generate UI')
    return { error: error instanceof Error ? error.message : 'Failed to generate UI' }
  }
}

// Save project node
async function saveProjectNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.projectIdea) throw new Error('Project idea required to save')
    
    const projectFiles: Partial<ProjectFiles> = {
      idea: state.idea,
      prd: state.prd,
      checklist: state.checklist,
      brainlift: state.brainlift,
      uiPlan: state.uiPlan,
      uiStrategy: state.uiStrategy,
      uiCode: state.uiCode,
      uiFiles: state.uiFiles,
      uiValidationIssues: state.validationIssues,
      v0Prompt: state.v0Prompt,
      chatHistory: state.chatHistory,
    }
    
    await storage.saveProject(state.projectId, projectFiles, state.projectIdea.title)
    console.log('Project saved successfully:', state.projectId)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to save project' }
  }
}

// Create the LangGraph workflow
function createWorkflow() {
  const workflow = new StateGraph(WorkflowStateAnnotation)
    .addNode('processIdea', processIdeaNode)
    .addNode('generatePRD', generatePRDNode)
    .addNode('generateChecklist', generateChecklistNode)
    .addNode('generateBrainlift', generateBrainliftNode)
    .addNode('generateUIPlan', generateUIPlanNode)
    .addNode('determineStrategy', determineStrategyNode)
    .addNode('generateUI', generateUINode)
    .addNode('saveProject', saveProjectNode)
    
  // Sequential flow with some parallelization
  workflow.addEdge('__start__', 'processIdea')
  workflow.addEdge('processIdea', 'generatePRD')
  
  // These three can run in parallel after PRD
  workflow.addEdge('generatePRD', 'generateChecklist')
  workflow.addEdge('generatePRD', 'generateBrainlift')
  workflow.addEdge('generatePRD', 'generateUIPlan')
  
  // Wait for all three before determining strategy
  workflow.addEdge('generateChecklist', 'determineStrategy')
  workflow.addEdge('generateBrainlift', 'determineStrategy')
  workflow.addEdge('generateUIPlan', 'determineStrategy')
  
  // Then generate UI and save
  workflow.addEdge('determineStrategy', 'generateUI')
  workflow.addEdge('generateUI', 'saveProject')
  workflow.addEdge('saveProject', '__end__')
  
  return workflow.compile()
}

// Main workflow runner - now powered by LangGraph!
export async function runWorkflow(
  idea: string,
  onProgress: ProgressCallback,
  chatHistory?: ChatMessage[]
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const projectId = nanoid()
  console.log('🦜️🔗 Starting LangGraph workflow for project:', projectId)
  
  try {
    const workflow = createWorkflow()
    
    const result = await workflow.invoke({
      idea,
      chatHistory: chatHistory || [],
      projectId,
      onProgress
    })
    
    if (result.error) {
      throw new Error(result.error)
    }
    
    return { success: true, projectId }
  } catch (error) {
    console.error('Workflow error:', error)
    onProgress('unknown', 'error', error instanceof Error ? error.message : 'Unknown error')
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// Helper functions (unchanged)

// Process idea into structured format for React app
async function processIdea(idea: string): Promise<ProjectIdea> {
  const response = await llm.invoke([
    new SystemMessage('Generate a clear title and description for this React project idea.'),
    new HumanMessage(`Create a React web application for: ${idea}`),
  ])

  const content = response.content as string
  const lines = content.split('\n').filter(line => line.trim())
  
  // Extract and clean the title
  let title = lines[0]?.trim() || 'Untitled React App'
  
  // Remove common prefixes
  title = title.replace(/^(Title:|Project Title:|#|##|###)\s*/i, '').trim()
  
  // Remove markdown formatting
  title = title
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **text**
    .replace(/\*(.*?)\*/g, '$1')     // Remove italic *text*
    .replace(/`(.*?)`/g, '$1')       // Remove inline code `text`
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links [text](url)
    .replace(/^#+\s*/gm, '')         // Remove heading markers
    .trim()
  
  // If title is empty or still contains just "Project Title", generate a better one
  if (!title || title.toLowerCase() === 'project title' || title.length < 3) {
    // Try to extract a meaningful title from the idea itself
    const ideaWords = idea.trim().split(/\s+/)
    if (ideaWords.length > 0) {
      // Take first few words and capitalize properly
      title = ideaWords.slice(0, 5).join(' ')
      // Capitalize first letter
      title = title.charAt(0).toUpperCase() + title.slice(1)
      // Add "App" if it doesn't already contain it
      if (!title.toLowerCase().includes('app') && !title.toLowerCase().includes('application')) {
        title += ' App'
      }
    } else {
      title = 'Untitled React App'
    }
  }
  
  // Ensure title isn't too long
  if (title.length > 50) {
    title = title.slice(0, 47) + '...'
  }
  
  const description = lines.slice(1).join(' ').replace(/^(Description:)\s*/i, '').trim() || idea

  return { title, description }
}

// Generate PRD from project idea
async function generatePRD(projectIdea: ProjectIdea): Promise<PRD> {
  const prompt = `
Based on this project idea, create a detailed Product Requirements Document (PRD):

Title: ${projectIdea.title}
Description: ${projectIdea.description}

Generate a PRD with the following sections:
1. Problem Statement (1-2 paragraphs)
2. Goals (3-5 bullet points)
3. Scope (1 paragraph describing what's included)
4. Constraints (3-5 technical or business constraints)
5. Success Criteria (3-5 measurable outcomes)

Format your response as JSON with this structure:
{
  "problem": "...",
  "goals": ["goal1", "goal2", ...],
  "scope": "...",
  "constraints": ["constraint1", "constraint2", ...],
  "success_criteria": ["criteria1", "criteria2", ...]
}
`

  const response = await llm.invoke([
    new SystemMessage('You are a product manager creating a PRD. Return only valid JSON.'),
    new HumanMessage(prompt),
  ])

  const content = response.content as string
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  return JSON.parse(jsonMatch[0]) as PRD
}

// Generate brainlift (optional assumptions/decisions)
async function generateBrainlift(projectIdea: ProjectIdea, prd: PRD): Promise<BrainliftLog | null> {
  try {
    const prompt = `
Based on this project, identify key assumptions and technical decisions:

Project: ${projectIdea.title}
Problem: ${prd.problem}
Goals: ${prd.goals.join(', ')}

Generate:
1. Key assumptions being made
2. Important technical/architectural decisions
3. Relevant context or reference links

Format as JSON:
{
  "assumptions": ["assumption1", "assumption2", ...],
  "decisions": ["decision1", "decision2", ...],
  "contextLinks": ["link1", "link2", ...]
}
`

    const response = await llm.invoke([
      new SystemMessage('You are a technical architect documenting project decisions. Return only valid JSON.'),
      new HumanMessage(prompt),
    ])

    const content = response.content as string
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    return JSON.parse(jsonMatch[0]) as BrainliftLog
  } catch (error) {
    console.error('Failed to generate brainlift:', error)
    return null
  }
}

// Generate checklist from PRD
async function generateChecklist(prd: PRD): Promise<ChecklistItem[]> {
  const prompt = `
Based on this PRD, create a development checklist:

Problem: ${prd.problem}
Goals: ${prd.goals.join(', ')}
Scope: ${prd.scope}

Generate 8-12 specific, actionable development tasks. Focus on:
- Setup and infrastructure
- Core features from the goals
- Testing and validation
- Documentation

Format as JSON array:
[
  { "text": "Set up project repository and initial structure", "done": false },
  { "text": "...", "done": false }
]
`

  const response = await llm.invoke([
    new SystemMessage('You are a technical lead creating a development checklist. Return only valid JSON array.'),
    new HumanMessage(prompt),
  ])

  const content = response.content as string
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON array found in response')
  
  const items = JSON.parse(jsonMatch[0]) as Array<{ text: string; done: boolean }>
  return items.map(item => ({
    id: nanoid(),
    text: item.text,
    done: item.done || false,
  }))
}

// Generate UI plan for React application
async function generateUIPlan(projectIdea: ProjectIdea, prd: PRD): Promise<UIPlan> {
  const prompt = `
Based on this project, create a UI plan for a REACT WEB APPLICATION:

Title: ${projectIdea.title}
Problem: ${prd.problem}
Goals: ${prd.goals.join(', ')}

Generate a plan for a modern React application with:
1. List of specific React components needed - be explicit with component names (e.g., "UserDashboard" not just "Dashboard", "ProductListTable" not just "Table")
2. Layout structure (single page app, dashboard layout, etc.)
3. Key user interactions (clicks, forms, modals, etc.)

IMPORTANT: 
- List ALL major components needed for the app
- Use descriptive component names that indicate their purpose
- Include components like Header, Navigation, Sidebar, Footer, Modal, Form, List, Card, etc. as needed
- DO NOT include "App" or "Main" as these are generated automatically

For example, a task management app might have:
["TaskHeader", "TaskSidebar", "TaskList", "TaskCard", "AddTaskModal", "TaskDetailsPanel", "TaskFilters"]

Format as JSON:
{
  "components": ["specific", "component", "names", ...],
  "layout": "Detailed layout description",
  "user_interactions": ["specific interactions", ...]
}
`

  const response = await llm.invoke([
    new SystemMessage('You are a UI/UX designer planning the interface. Return only valid JSON. Be specific with component names that clearly indicate their purpose.'),
    new HumanMessage(prompt),
  ])

  const content = response.content as string
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  return JSON.parse(jsonMatch[0]) as UIPlan
}

// Always use GPT for React applications
function determineUIStrategy(uiPlan: UIPlan): UIStrategy {
  // We're focusing on React applications only, always use GPT
  return 'gpt'
}

// Generate v0 prompt
async function generateV0Prompt(projectIdea: ProjectIdea, uiPlan: UIPlan): Promise<any> {
  const prompt = `
Create a v0.dev prompt for this simple UI:

Project: ${projectIdea.title}
Components: ${uiPlan.components.join(', ')}
Layout: ${uiPlan.layout}

Generate a structured prompt that v0 can use to create the UI.
Format as JSON with sections for:
- Main description
- Component details
- Styling requirements
`

  const response = await llm.invoke([
    new SystemMessage('You are creating a prompt for v0.dev. Return a JSON object with prompt sections.'),
    new HumanMessage(prompt),
  ])

  const content = response.content as string
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { prompt: content }
  
  return JSON.parse(jsonMatch[0])
}

// Determine component type based on name
function determineComponentType(componentName: string): string {
  const name = componentName.toLowerCase()
  
  if (name.includes('header') || name.includes('navbar') || name.includes('navigation') || name.includes('topbar')) {
    return 'navigation'
  } else if (name.includes('sidebar') || name.includes('menu') || name.includes('drawer')) {
    return 'sidebar'
  } else if (name.includes('footer')) {
    return 'footer'
  } else if (name.includes('modal') || name.includes('dialog') || name.includes('popup')) {
    return 'modal'
  } else if (name.includes('form') || name.includes('input')) {
    return 'form'
  } else if (name.includes('list') || name.includes('table') || name.includes('grid')) {
    return 'datadisplay'
  } else if (name.includes('card') || name.includes('tile') || name.includes('widget')) {
    return 'card'
  } else if (name.includes('chart') || name.includes('graph') || name.includes('analytics')) {
    return 'visualization'
  } else if (name === 'app' || name.includes('main') || name.includes('container')) {
    return 'container'
  } else {
    return 'generic'
  }
}

// Generate a single React component file
async function generateComponentFile(
  componentName: string, 
  componentType: string,
  projectContext: { 
    title: string; 
    description: string; 
    otherComponents: string[];
    layout?: string;
    interactions?: string[];
  },
  retryAttempt: number = 0
): Promise<string> {
  // Generate contextual prompts based on component type
  const getComponentPrompt = () => {
    switch (componentType) {
      case 'navigation':
        return `Create a navigation/header component with:
- Brand/logo area (use text-2xl font-bold)
- Navigation items relevant to "${projectContext.title}" (use hover:text-blue-600)
- Settings or preferences dropdown (NO user accounts)
- Responsive mobile design (hidden md:flex for desktop items)
- Styled with Tailwind: bg-white shadow-md, proper padding, flex layout
- Any search or action buttons that make sense for this app
- Include navigation links to relevant pages like:
  onClick: () => window.Router.navigate('about')
  onClick: () => window.Router.navigate('features')
  onClick: () => window.Router.navigate('settings')
  (Choose page names that make sense for "${projectContext.title}")`
      
      case 'sidebar':
        return `Create a sidebar navigation component with:
- Menu items relevant to "${projectContext.title}"
- Organized sections with proper spacing (space-y-2)
- Icons where appropriate (use emoji or unicode symbols)
- Active state handling (bg-blue-50 text-blue-700 for active)
- Styled with Tailwind: w-64 bg-gray-50 p-4, hover effects
- Proper visual hierarchy with text-sm, font-medium
- Include clickable navigation items like:
  onClick: () => window.Router.navigate('dashboard')
  onClick: () => window.Router.navigate('analytics')
  onClick: () => window.Router.navigate('reports')
  (Choose menu items that make sense for "${projectContext.title}")`
      
      case 'footer':
        return `Create a footer component with:
- Links relevant to "${projectContext.title}"
- Copyright information
- Contact or support links
- Social media if appropriate`
      
      case 'modal':
        return `Create a modal/dialog component with:
- Proper overlay background (fixed inset-0 bg-black bg-opacity-50)
- Modal container (bg-white rounded-lg shadow-xl p-6)
- Close button (absolute top-2 right-2)
- Content area for "${projectContext.title}" functionality
- Appropriate action buttons (styled with Tailwind button classes)
- MUST be hidden by default (useState(false))
- Centered positioning (flex items-center justify-center)
- Focus on feature-specific modals (settings, confirmation, detail views)
- NO authentication or login modals`
      
      case 'form':
        return `Create a form component with:
- Input fields relevant to "${projectContext.title}" (NO password fields)
- Proper Tailwind form styling (border rounded px-3 py-2 focus:outline-none focus:ring-2)
- Validation states (border-red-500 for errors, border-green-500 for success)
- Submit button (bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700)
- Clear labels (text-sm font-medium text-gray-700) and helper text
- Proper spacing between form elements (space-y-4)
- Handle form submission with preventDefault
- Example submit handler for data forms:
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Process form data
    console.log('Form submitted:', data);
    // Save data or navigate
    window.AppState.set('formData', data);
    window.Router.navigate('success');
  }`
      
      case 'datadisplay':
        return `Create a data display component (list/table/grid) with:
- Mock data relevant to "${projectContext.title}"
- Sorting/filtering if appropriate
- Proper styling and spacing
- Empty state handling`
      
      case 'card':
        return `Create a card/widget component with:
- Content relevant to "${projectContext.title}"
- Proper visual hierarchy
- Interactive elements if needed
- Consistent styling
- May include action buttons that navigate to detail pages:
  onClick: () => window.Router.navigate('details')
  onClick: () => window.Router.navigate('edit')
  (Use routes that make sense for the card's content)`
      
      case 'visualization':
        return `Create a data visualization component with:
- Mock data visualization for "${projectContext.title}"
- Use simple CSS/HTML (no external chart libraries)
- Clear labels and legends
- Interactive if appropriate`
      
      case 'container':
        return `Create the main container/app component that:
- Uses all other components: ${projectContext.otherComponents.join(', ')}
- Implements the layout: ${projectContext.layout || 'appropriate layout for the app'}
- Reference other components as window.ComponentName in React.createElement
- Example: React.createElement(window.Header) NOT React.createElement(Header)
- MUST be named exactly "App" (const App = ...)
- MUST end with: window.App = App;
- Use proper Tailwind layout classes (min-h-screen, flex, grid, etc.)
- Apply appropriate background colors and spacing
- Ensure responsive design with proper breakpoints

ROUTING SUPPORT:
- You can use window.Router.navigate('routeName') to change pages
- Use window.Router.getCurrentRoute() to get current route
- Use window.Router.onRouteChange(callback) to listen for route changes
- Use window.AppState.set(key, value) to store application state
- Use window.AppState.get(key) to retrieve application state
- The App component should ALWAYS render the appropriate layout based on current route
- For routes that don't have specific page components, show the default home layout

Example App routing pattern:
const App = () => {
  const [currentRoute, setCurrentRoute] = React.useState(window.Router.getCurrentRoute() || 'home');
  
  React.useEffect(() => {
    const unsubscribe = window.Router.onRouteChange((newRoute) => {
      setCurrentRoute(newRoute);
    });
    return unsubscribe;
  }, []);
  
  // Route to different page components
  if (currentRoute === 'about' && window.AboutPage) {
    return React.createElement(window.AboutPage);
  } else if (currentRoute === 'settings' && window.SettingsPage) {
    return React.createElement(window.SettingsPage);
  }
  
  // Default home layout
  return React.createElement('div', { className: 'min-h-screen' },
    React.createElement(window.Header),
    // ... rest of home page
  );
};`
      
      default:
        return `Create a ${componentName} component that:
- Serves its purpose in the "${projectContext.title}" application
- Has appropriate content and functionality
- Follows React best practices
- Includes any necessary state management`
    }
  }

  const componentPrompt = getComponentPrompt()

  const retryWarning = retryAttempt > 0 ? `

⚠️ CRITICAL - PREVIOUS ATTEMPT FAILED ⚠️
DO NOT include any of the following:
- NO markdown formatting (no #, *, ---, or \`\`\`)
- NO explanatory text (no "Here's", "This is", "Let me", etc.)
- NO import/export statements
- NO comments explaining what the code does
- ONLY pure React component code
- MUST include window.${componentName} = ${componentName}; at the end
- MUST use React.createElement() for ALL elements

RETURN ONLY THE COMPONENT CODE!` : ''

  const prompt = `Create a React component for: ${projectContext.title}
${projectContext.description ? `Project Description: ${projectContext.description}` : ''}

Component: ${componentName}
Requirements: ${componentPrompt}

${projectContext.otherComponents.length > 0 ? `Other components in this app: ${projectContext.otherComponents.join(', ')}` : ''}
${projectContext.interactions ? `Key interactions: ${projectContext.interactions.slice(0, 3).join(', ')}` : ''}

Rules:
- Use React.createElement() - NO JSX
- Use React.useState and React.useEffect (NOT just useState/useEffect)
- All React APIs must be prefixed with React. (e.g., React.useState, React.useEffect, React.useCallback)
- CRITICAL: Use { className: 'value' } NEVER { class: 'value' }
- The word "class" should NEVER appear except in "className"
- IMPORTANT: Use Tailwind CSS classes for ALL styling (e.g., className: 'bg-blue-500 text-white p-4 rounded-lg')
- DO NOT use custom CSS class names - ONLY use Tailwind utility classes
- Add rich, realistic mock data relevant to "${projectContext.title}"
- Include proper event handlers and state management
- Make it visually appealing with proper spacing, colors, and layout using Tailwind
- Minimum 80-150 lines of actual component code
- End with: window.${componentName} = ${componentName};
- NO destructuring of React (no const {useState} = React)

CRITICAL - NO AUTHENTICATION:
- DO NOT create login, signup, or authentication screens
- DO NOT include password fields or login forms
- DO NOT implement user authentication logic
- DO NOT create user registration or sign-in flows
- Focus on the core functionality without authentication

NAVIGATION & STATE:
- Use window.Router.navigate('routeName') to change pages
- Use window.Router.getCurrentRoute() to get current route
- Use window.Router.onRouteChange(callback) to listen for route changes
- Use window.AppState.set(key, value) to store global data
- Use window.AppState.get(key) to retrieve global data
- Navigate between functional pages like 'home', 'about', 'products', 'contact', etc.
${componentType === 'container' ? `- When using other components, reference them as window.ComponentName
- Example: React.createElement(window.${projectContext.otherComponents[0] || 'Header'})
- Arrange components according to: ${projectContext.layout}` : ''}

Example of CORRECT syntax:
const [count, setCount] = React.useState(0);
React.useEffect(() => { ... }, []);
React.createElement('div', { className: 'bg-white p-6 rounded-lg shadow-md' }, ...)
React.createElement('button', { className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700' }, 'Click')
${componentType === 'container' ? `React.createElement(window.${projectContext.otherComponents[0] || 'Header'}, null)` : ''}
${retryWarning}
Return ONLY the component code, no explanations.`

  const systemMessage = retryAttempt > 0 
    ? `You are a React code generator. YOUR PREVIOUS ATTEMPT FAILED.

STRICT OUTPUT REQUIREMENTS:
- Output ONLY valid JavaScript code
- NO markdown formatting or code blocks (\`\`\`)
- NO explanatory text before, after, or within the code
- NO comments explaining what you're doing
- Start directly with the component code
- End with window.${componentName} = ${componentName};

FOLLOW ALL REACT RULES:
- Use React.createElement() for ALL elements
- Use React.useState, React.useEffect (NOT useState, useEffect)
- Use className for CSS classes, NEVER use 'class'
- Use Tailwind CSS utility classes only

RETURN ONLY THE COMPONENT CODE!`
    : `You are a React expert. Generate ONLY component code. No markdown, no explanations.
CRITICAL RULES - MUST FOLLOW:
1. Use React.useState NOT useState
2. Use React.useEffect NOT useEffect  
3. Use React.createElement NOT createElement
4. End with window.${componentName} = ${componentName};
5. NEVER use the word 'class' anywhere - ALWAYS use 'className' instead
6. For CSS classes: { className: 'my-class' } NEVER { class: 'my-class' }
7. The word 'class' should NOT appear ANYWHERE in your code except as part of 'className'
8. Create FULLY FUNCTIONAL components with rich content and realistic data
9. Components should demonstrate the actual functionality of the ${projectContext.title} app
10. Include appropriate state management, event handlers, and mock data
11. USE TAILWIND CSS CLASSES for ALL styling - no custom CSS classes
12. Make components visually appealing with proper Tailwind classes for:
    - Colors (bg-blue-500, text-white, border-gray-300)
    - Spacing (p-4, m-2, space-y-4)
    - Layout (flex, grid, absolute)
    - Typography (text-xl, font-bold)
    - Effects (shadow-lg, rounded-lg, hover:bg-blue-600)
NO import statements, NO export statements.`

  const response = await codeLLM.invoke([
    new SystemMessage(systemMessage),
    new HumanMessage(prompt)
  ])

  let code = response.content as string
  
  // Clean up any markdown or extra text
  code = code.replace(/```[\w]*\n?/g, '').trim()
  code = code.replace(/```/g, '').trim()
  
  // Remove any destructuring of React (const { useState } = React)
  code = code.replace(/const\s*{\s*[^}]+\s*}\s*=\s*React\s*;?\s*/g, '')
  
  // Remove any import statements
  code = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
  
  // Remove any leading explanatory text
  const firstConstOrFunction = code.search(/(?:const|function)\s+\w+/)
  if (firstConstOrFunction > 0) {
    console.log(`Component ${componentName}: Removing ${firstConstOrFunction} chars of leading text`)
    code = code.substring(firstConstOrFunction)
  }
  
  // Ensure the component has window assignment
  if (!code.includes(`window.${componentName}`)) {
    console.warn(`Component ${componentName} missing window assignment, adding it...`)
    code = code.trim() + `\n\nwindow.${componentName} = ${componentName};`
  }
  
  // Fix common issues
  if (code.includes('useState(') && !code.includes('React.useState(')) {
    console.warn(`Component ${componentName} uses useState instead of React.useState, fixing...`)
    // Replace common React hooks with proper syntax
    code = code.replace(/\buseState\(/g, 'React.useState(')
    code = code.replace(/\buseEffect\(/g, 'React.useEffect(')
    code = code.replace(/\buseCallback\(/g, 'React.useCallback(')
    code = code.replace(/\buseMemo\(/g, 'React.useMemo(')
    code = code.replace(/\buseRef\(/g, 'React.useRef(')
    code = code.replace(/\buseContext\(/g, 'React.useContext(')
    code = code.replace(/\buseReducer\(/g, 'React.useReducer(')
  }
  
  // Also fix createElement if needed
  if (code.includes('createElement(') && !code.includes('React.createElement(')) {
    console.warn(`Component ${componentName} uses createElement instead of React.createElement, fixing...`)
    code = code.replace(/\bcreateElement\(/g, 'React.createElement(')
  }
  
  // Fix all potential class/className issues
  const originalCode = code
  
  // Pattern 1: { class: 'value' } or { class: "value" }
  code = code.replace(/{\s*class\s*:\s*(['"])/g, '{ className: $1')
  
  // Pattern 2: , class: 'value' or , class: "value"
  code = code.replace(/,\s*class\s*:\s*(['"])/g, ', className: $1')
  
  // Pattern 3: "class": or 'class': (quoted key)
  code = code.replace(/["']class["']\s*:/g, '"className":')
  
  // Pattern 4: Plain class: at start of line or after whitespace
  code = code.replace(/(\s)class\s*:\s*/g, '$1className: ')
  
  // Pattern 5: More aggressive - any object property "class"
  // This catches { someProperty, class: 'value' } patterns
  code = code.replace(/([,{]\s*)class(\s*:)/g, '$1className$2')
  
  // Pattern 6: Fix any remaining bare "class" that might be interpreted as keyword
  // But preserve className
  code = code.replace(/\bclass\b(?!Name)/g, 'className')
  
  if (code !== originalCode) {
    console.warn(`Component ${componentName} had class/className issues that were fixed`)
  }
  
  // Check for any remaining problematic patterns
  if (code.match(/\bclass\b(?!Name)/)) {
    console.error(`Component ${componentName} still contains problematic "class" keyword`)
    // Log all contexts where class appears
    const classRegex = /\bclass\b(?!Name)/g
    let match
    while ((match = classRegex.exec(code)) !== null) {
      const start = Math.max(0, match.index - 30)
      const end = Math.min(code.length, match.index + 30)
      console.error(`  Context: "${code.substring(start, end).replace(/\n/g, '\\n')}"`)
    }
  }
  
  return code
}

// Validate generated code for common issues with detailed location info
function validateGeneratedCode(code: string, componentName: string): { 
  valid: boolean; 
  issues: Array<{ 
    type: string; 
    message: string; 
    line?: number; 
    context?: string 
  }> 
} {
  const issues: Array<{ type: string; message: string; line?: number; context?: string }> = []
  
  // First, check for actual JavaScript syntax errors using Node's parser
  try {
    // Create a test environment with mock React
    const testCode = `
      const React = {
        createElement: () => {},
        useState: () => [null, () => {}],
        useEffect: () => {},
        useCallback: () => {},
        useMemo: () => {},
        useRef: () => ({ current: null }),
        useContext: () => {},
        useReducer: () => [null, () => {}]
      };
      const window = { Router: { navigate: () => {}, getCurrentRoute: () => 'home', onRouteChange: () => () => {} } };
      ${code}
    `;
    
    // Use Function constructor to check syntax
    new Function(testCode);
    console.log(`Component ${componentName}: Syntax is valid`)
  } catch (error: any) {
    // Extract line number from error if possible
    let lineNumber: number | undefined;
    const errorMessage = error.message || '';
    
    // Try to extract line number from error message
    const lineMatch = errorMessage.match(/at line (\d+)|:(\d+):|line (\d+)/i);
    if (lineMatch) {
      lineNumber = parseInt(lineMatch[1] || lineMatch[2] || lineMatch[3]) - 11; // Subtract the test wrapper lines
    }
    
    issues.push({
      type: 'syntax_error',
      message: `JavaScript syntax error: ${errorMessage}`,
      line: lineNumber,
      context: error.stack ? error.stack.split('\n')[0] : undefined
    })
  }
  
  // Only check for markdown if there are no syntax errors
  if (issues.length === 0 && code.includes('```')) {
    const lines = code.split('\n')
    const lineIndex = lines.findIndex(line => line.includes('```'))
    issues.push({
      type: 'markdown',
      message: 'Contains markdown code blocks',
      line: lineIndex + 1,
      context: lines[lineIndex]?.trim()
    })
  }
  
  // Check if it's missing the window assignment (still useful)
  if (!code.includes(`window.${componentName}`)) {
    issues.push({
      type: 'missing_window_assignment',
      message: `Missing window.${componentName} assignment`,
      line: undefined,
      context: 'End of file'
    })
  }
  
  // Only check for too short code if no syntax errors
  if (issues.length === 0 && code.length < 200) {
    issues.push({
      type: 'incomplete_code',
      message: 'Code is too short - likely incomplete or placeholder',
      line: 1,
      context: `Only ${code.length} characters`
    })
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

// Helper function to check if a component name is auth-related
function isAuthRelatedComponent(componentName: string): boolean {
  const authPatterns = [
    /login/i,
    /signin/i,
    /sign-in/i,
    /signup/i,
    /sign-up/i,
    /register/i,
    /registration/i,
    /auth/i,
    /authenticate/i,
    /password/i,
    /credential/i,
    /logout/i,
    /signout/i,
    /sign-out/i
  ]
  
  return authPatterns.some(pattern => pattern.test(componentName))
}

// Helper function to clean auth-related code from generated content
function cleanAuthArtifacts(code: string, componentName: string): string {
  console.log(`Cleaning auth artifacts from ${componentName}...`)
  
  // Remove password input fields
  code = code.replace(
    /React\.createElement\s*\(\s*['"]input['"]\s*,\s*\{[^}]*type\s*:\s*['"]password['"][^}]*\}[^)]*\)/g,
    'React.createElement("div", { className: "text-gray-500" }, "Auth field removed")'
  )
  
  // Remove buttons with auth-related text
  const authButtonPattern = /React\.createElement\s*\(\s*['"]button['"]\s*,\s*\{[^}]*\}\s*,\s*['"](Log\s*[Ii]n|Sign\s*[Ii]n|Sign\s*[Uu]p|Register|Log\s*[Oo]ut|Sign\s*[Oo]ut)['"]\s*\)/g
  code = code.replace(authButtonPattern, 'React.createElement("span", null)')
  
  // Remove auth-related event handlers
  code = code.replace(/handle(Login|Signin|SignIn|Signup|SignUp|Register|Auth|Logout|SignOut)/g, 'handleAction')
  
  // Remove auth-related state variables
  code = code.replace(/\b(isAuthenticated|isLoggedIn|authToken|userToken|credentials)\b/g, 'appState')
  
  // Remove auth-related routes from navigation
  code = code.replace(
    /window\.Router\.navigate\s*\(\s*['"](login|signin|signup|register|auth|logout)['"]\s*\)/g,
    'window.Router.navigate("home")'
  )
  
  // Remove auth-related conditional rendering
  code = code.replace(
    /currentRoute\s*===\s*['"](login|signin|signup|register|auth)['"]/g,
    'false'
  )
  
  return code
}

// Analyze UI plan to determine what files need to be created
function analyzeComponentsNeeded(uiPlan: UIPlan): Array<{ name: string; type: string }> {
  const componentsToGenerate: Array<{ name: string; type: string }> = []
  
  // Filter out the App component as we'll generate it separately
  // ALSO filter out auth-related components
  const componentNames = uiPlan.components.filter(name => {
    const nameLower = name.toLowerCase()
    
    // Skip app/main/container components
    if (nameLower.includes('app') || 
        nameLower.includes('main') || 
        nameLower.includes('container')) {
      return false
    }
    
    // Skip auth-related components
    if (isAuthRelatedComponent(name)) {
      console.log(`Filtering out auth component: ${name}`)
      return false
    }
    
    return true
  })
  
  // Analyze each component and determine its type
  componentNames.forEach(name => {
    const type = determineComponentType(name)
    componentsToGenerate.push({ name, type })
  })
  
  // Log what we're planning to generate
  console.log('Components to generate:', componentsToGenerate)
  
  return componentsToGenerate
}

// Extract route references from generated code
function extractRouteReferences(code: string): string[] {
  const routes = new Set<string>()
  
  // Pattern to match window.Router.navigate calls
  const navigatePattern = /window\.Router\.navigate\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  let match
  
  while ((match = navigatePattern.exec(code)) !== null) {
    const route = match[1]
    // Skip common routes that might be the default
    // ALSO skip auth-related routes
    if (route && route !== 'home' && route !== '/' && !isAuthRelatedComponent(route)) {
      routes.add(route)
    }
  }
  
  // Also check for route references in conditional rendering
  const routeCheckPattern = /getCurrentRoute\s*\(\s*\)\s*===\s*['"`]([^'"`]+)['"`]/g
  while ((match = routeCheckPattern.exec(code)) !== null) {
    const route = match[1]
    if (route && route !== 'home' && route !== '/' && !isAuthRelatedComponent(route)) {
      routes.add(route)
    }
  }
  
  return Array.from(routes)
}

// Generate a page component for a specific route
async function generatePageComponent(
  routeName: string,
  projectContext: { 
    title: string; 
    description: string;
    existingComponents: string[];
  }
): Promise<{ name: string; content: string }> {
  // Convert route name to component name (e.g., 'profile' -> 'ProfilePage')
  const componentName = routeName.charAt(0).toUpperCase() + routeName.slice(1) + 'Page'
  
  const prompt = `Create a React page component for the "${routeName}" route in the "${projectContext.title}" application.

This is a full page component that will be shown when the user navigates to the "${routeName}" route.
The application already has these components: ${projectContext.existingComponents.join(', ')}

Requirements:
- Create a complete page layout with relevant content for "${routeName}"
- Include navigation back to other pages using window.Router.navigate()
- Use the existing components where appropriate (reference as window.ComponentName)
- Add rich, meaningful content that fits the "${projectContext.title}" application
- Include appropriate interactions and state management
- Use Tailwind CSS for all styling
- Make it look like a real, functional page

Example structure for a profile page:
const ProfilePage = () => {
  const [userData, setUserData] = React.useState({
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Administrator'
  });
  
  return React.createElement('div', { className: 'min-h-screen bg-gray-50' },
    React.createElement(window.Header),
    React.createElement('div', { className: 'max-w-4xl mx-auto p-6' },
      React.createElement('h1', { className: 'text-3xl font-bold mb-6' }, 'Profile'),
      // ... rest of the page content
    )
  );
};

window.${componentName} = ${componentName};

IMPORTANT: 
- This should be a FULL PAGE component, not just a section
- Include proper layout and spacing
- Reference other components as window.ComponentName
- Add navigation options to go to other pages
- NO authentication screens or password fields
- Return ONLY the component code`

  const response = await codeLLM.invoke([
    new SystemMessage(`You are a React expert creating page components. Generate ONLY component code, no explanations.
Follow all the same rules as component generation:
- Use React.createElement() for ALL elements
- Use React.useState, React.useEffect (NOT useState, useEffect)
- Use className for CSS classes, NEVER use 'class'
- NO authentication or login functionality
- End with window.${componentName} = ${componentName};`),
    new HumanMessage(prompt)
  ])

  let code = response.content as string
  code = code.replace(/```[\w]*\n?/g, '').trim()
  code = code.replace(/```/g, '').trim()
  
  // Fix common issues
  code = code.replace(/\buseState\(/g, 'React.useState(')
  code = code.replace(/\buseEffect\(/g, 'React.useEffect(')
  code = code.replace(/\bcreateElement\(/g, 'React.createElement(')
  
  // Fix class/className issues
  code = code.replace(/{\s*class\s*:\s*(['"])/g, '{ className: $1')
  code = code.replace(/,\s*class\s*:\s*(['"])/g, ', className: $1')
  code = code.replace(/["']class["']\s*:/g, '"className":')
  code = code.replace(/\bclass\b(?!Name)/g, 'className')
  
  return {
    name: componentName,
    content: code
  }
}

// Generate multiple UI files by creating components sequentially
async function generateUIFiles(projectIdea: ProjectIdea, uiPlan: UIPlan, onProgress?: ProgressCallback): Promise<{
  files: UIFile[];
  validationIssues: Array<{
    filename: string;
    componentName: string;
    issues: Array<{ type: string; message: string; line?: number; context?: string }>;
  }>;
}> {
  const files: UIFile[] = []
  const validationIssues: Array<{
    filename: string;
    componentName: string;
    issues: Array<{ type: string; message: string; line?: number; context?: string }>;
  }> = []
  
  // Analyze what components we need based on the UI plan
  const componentsToGenerate = analyzeComponentsNeeded(uiPlan)
  
  // If no components were identified, use sensible defaults based on the layout
  if (componentsToGenerate.length === 0) {
    console.log('No specific components found in UI plan, using defaults based on layout')
    
    // Analyze the layout description to determine defaults
    const layoutLower = (uiPlan.layout || '').toLowerCase()
    
    if (layoutLower.includes('dashboard')) {
      componentsToGenerate.push(
        { name: 'Header', type: 'navigation' },
        { name: 'Sidebar', type: 'sidebar' },
        { name: 'Dashboard', type: 'datadisplay' }
      )
    } else if (layoutLower.includes('single page')) {
      componentsToGenerate.push(
        { name: 'Navigation', type: 'navigation' },
        { name: 'Hero', type: 'generic' },
        { name: 'Features', type: 'generic' },
        { name: 'Footer', type: 'footer' }
      )
    } else {
      // Generic default
      componentsToGenerate.push(
        { name: 'Header', type: 'navigation' },
        { name: 'MainContent', type: 'generic' }
      )
    }
  }
  
  const componentNames = componentsToGenerate.map(c => c.name)
  
      // Generate each component file with validation and retry
    for (const component of componentsToGenerate) {
      console.log(`Generating ${component.name} component (type: ${component.type})...`)
      
      let retryCount = 0
      const maxRetries = 3
      let content = ''
      let isValid = false
      let lastValidation: any = null
      
      while (!isValid && retryCount < maxRetries) {
        if (retryCount > 0) {
          console.log(`Retrying ${component.name} generation (attempt ${retryCount + 1}/${maxRetries})...`)
        }
        
        content = await generateComponentFile(
          component.name,
          component.type,
          { 
            title: projectIdea.title, 
            description: projectIdea.description,
            otherComponents: componentNames.filter(n => n !== component.name),
            layout: uiPlan.layout,
            interactions: uiPlan.user_interactions
          },
          retryCount
        )
        
        // Clean auth artifacts from the generated content
        content = cleanAuthArtifacts(content, component.name)
        
        // Validate the generated code
        lastValidation = validateGeneratedCode(content, component.name)
        isValid = lastValidation.valid
        
        // Filter out auth validation issues if the component itself isn't auth-related
        if (!isValid && lastValidation.issues) {
          lastValidation.issues = lastValidation.issues.filter((issue: { type: string; message: string; line?: number; context?: string }) => {
            // Keep non-auth issues
            if (issue.type !== 'authentication') return true
            // For auth issues, only keep them if it's a major problem
            return false
          })
          // Re-evaluate validity after filtering
          isValid = lastValidation.issues.length === 0
        }
        
        if (!isValid) {
          console.warn(`Validation failed for ${component.name}:`, lastValidation.issues)
          if (onProgress && retryCount < maxRetries - 1) {
            onProgress(`UI-${component.name}`, 'error', `Validation failed, retrying...`)
          }
          retryCount++
          
          // Add a small delay before retrying to avoid rate limits
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } else {
          console.log(`${component.name} generated successfully`)
          if (onProgress) {
            onProgress(`UI-${component.name}`, 'success', `Component validated`)
          }
        }
      }
      
      if (!isValid && lastValidation) {
        console.error(`Failed to generate valid code for ${component.name} after ${maxRetries} attempts`)
        // Track validation issues for this component
        validationIssues.push({
          filename: `${component.name}.tsx`,
          componentName: component.name,
          issues: lastValidation.issues
        })
      }
      
      files.push({
        filename: `${component.name}.tsx`,
        type: 'component',
        content: content.trim()
      })
    }
  
  // Generate App.tsx last with validation and retry
  console.log('Generating App component...')
  
  let appRetryCount = 0
  const appMaxRetries = 3
  let appContent = ''
  let appIsValid = false
  
  while (!appIsValid && appRetryCount < appMaxRetries) {
    if (appRetryCount > 0) {
      console.log(`Retrying App generation (attempt ${appRetryCount + 1}/${appMaxRetries})...`)
    }
    
    appContent = await generateComponentFile(
      'App',
      'container',
      { 
        title: projectIdea.title, 
        description: projectIdea.description,
        otherComponents: componentNames,
        layout: uiPlan.layout,
        interactions: uiPlan.user_interactions
      },
      appRetryCount
    )
    
    // Clean auth artifacts from App component too
    appContent = cleanAuthArtifacts(appContent, 'App')
    
    // Validate the App component
    const appValidation = validateGeneratedCode(appContent, 'App')
    appIsValid = appValidation.valid
    
    // Filter out auth validation issues for App component
    if (!appIsValid && appValidation.issues) {
      const filteredIssues = appValidation.issues.filter(issue => issue.type !== 'authentication')
      appIsValid = filteredIssues.length === 0
    }
    
    if (!appIsValid) {
      console.warn('Validation failed for App component:', appValidation.issues)
      if (onProgress && appRetryCount < appMaxRetries - 1) {
        onProgress('UI-App', 'error', 'Validation failed, retrying...')
      }
      appRetryCount++
      
      // Add a small delay before retrying to avoid rate limits
      if (appRetryCount < appMaxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } else {
      console.log('App component generated successfully')
      if (onProgress) {
        onProgress('UI-App', 'success', 'App component validated')
      }
    }
  }
  
  if (!appIsValid) {
    console.error(`Failed to generate valid App component after ${appMaxRetries} attempts`)
  }
  
  // Extra validation for App component
  if (!appContent.includes('const App') && !appContent.includes('function App')) {
    console.error('App component not properly named! Content:', appContent.substring(0, 200))
    // Try to fix by finding the main component and renaming it
    const componentMatch = appContent.match(/(?:const|function)\s+(\w+)\s*[=(]/)
    if (componentMatch && componentMatch[1] !== 'App') {
      console.log(`Renaming ${componentMatch[1]} to App`)
      appContent = appContent.replace(
        new RegExp(`\\b${componentMatch[1]}\\b`, 'g'),
        'App'
      )
    }
  }
  
  // Verify the App content one more time
  if (!appContent.includes('window.App')) {
    console.error('App component missing window.App assignment! Adding it...')
    appContent = appContent.trim() + '\n\nwindow.App = App;'
  }
  
  // Fix component references to use window - more aggressive
  componentNames.forEach(name => {
    // Pattern 1: React.createElement(ComponentName
    const pattern1 = new RegExp(`React\\.createElement\\(${name}(?=[,\\)])`, 'g')
    if (appContent.match(pattern1)) {
      console.log(`Fixing reference to ${name} to use window.${name}`)
      appContent = appContent.replace(pattern1, `React.createElement(window.${name}`)
    }
    
    // Pattern 2: React.createElement( ComponentName (with space)
    const pattern2 = new RegExp(`React\\.createElement\\(\\s*${name}(?=[,\\)])`, 'g')
    if (appContent.match(pattern2)) {
      console.log(`Fixing spaced reference to ${name} to use window.${name}`)
      appContent = appContent.replace(pattern2, `React.createElement(window.${name}`)
    }
    
    // Pattern 3: Just in case - any remaining bare component references
    const pattern3 = new RegExp(`(React\\.createElement\\([^)]*?)\\b${name}\\b`, 'g')
    appContent = appContent.replace(pattern3, `$1window.${name}`)
  })
  
  // Double check
  componentNames.forEach(name => {
    if (appContent.includes(`React.createElement(${name}`) && !appContent.includes(`React.createElement(window.${name}`)) {
      console.error(`App still has bare reference to ${name}!`)
    }
  })
  
  // Log what we're actually storing
  console.log('App component preview:', appContent.substring(0, 300))
  console.log('App contains window.App?', appContent.includes('window.App'))
  console.log('App contains React.createElement(window.Header)?', appContent.includes('React.createElement(window.Header)'))
  
  files.push({
    filename: 'App.tsx',
    type: 'main',
    content: appContent.trim()
  })
  
  // Step 2: Analyze all generated components for route references
  console.log('Analyzing components for route references...')
  const allRoutes = new Set<string>()
  
  // Check all component files for route references
  files.forEach(file => {
    const routes = extractRouteReferences(file.content)
    routes.forEach(route => allRoutes.add(route))
  })
  
  console.log('Found route references:', Array.from(allRoutes))
  
  // Step 3: Generate page components for each referenced route
  if (allRoutes.size > 0) {
    console.log('Generating page components for referenced routes...')
    const existingComponentNames = files.map(f => f.filename.replace('.tsx', ''))
    
    for (const route of allRoutes) {
      try {
        console.log(`Generating page component for route: ${route}`)
        if (onProgress) {
          onProgress(`UI-${route}Page`, 'in-progress', `Generating ${route} page...`)
        }
        
        const pageComponent = await generatePageComponent(route, {
          title: projectIdea.title,
          description: projectIdea.description,
          existingComponents: existingComponentNames
        })
        
        files.push({
          filename: `${pageComponent.name}.tsx`,
          type: 'page',
          content: pageComponent.content.trim()
        })
        
        console.log(`${pageComponent.name} generated successfully`)
        if (onProgress) {
          onProgress(`UI-${route}Page`, 'success', `${route} page created`)
        }
      } catch (error) {
        console.error(`Failed to generate page component for route ${route}:`, error)
        if (onProgress) {
          onProgress(`UI-${route}Page`, 'error', `Failed to generate ${route} page`)
        }
      }
    }
    
    // Step 4: Update App component to include routing logic for new pages
    console.log('Updating App component with routing logic...')
    const appFile = files.find(f => f.filename === 'App.tsx')
    if (appFile) {
      appFile.content = updateAppWithRouting(appFile.content, Array.from(allRoutes))
    }
  }
  
  return {
    files,
    validationIssues
  }
}

// Update App component to handle routing to generated pages
function updateAppWithRouting(appContent: string, routes: string[]): string {
  // Check if App already has proper routing logic
  if (appContent.includes('window.Router.onRouteChange') && appContent.includes('setCurrentRoute')) {
    console.log('App already has proper routing logic, skipping update')
    return appContent
  }
  
  // Generate routing conditions for each page
  const routingConditions = routes.map(route => {
    const pageName = route.charAt(0).toUpperCase() + route.slice(1) + 'Page'
    return `  if (currentRoute === '${route}' && window.${pageName}) {
    return React.createElement(window.${pageName});
  }`
  }).join(' else ')
  
  // Find the App component definition
  const appMatch = appContent.match(/const\s+App\s*=\s*\(\s*\)\s*=>\s*{/)
  if (!appMatch) {
    console.log('Could not find App component definition')
    return appContent
  }
  
  // Find where to insert the routing logic
  const appStartIndex = appMatch.index! + appMatch[0].length
  
  // Check if there's already a currentRoute state
  if (!appContent.includes('currentRoute')) {
    // Insert routing state and logic at the beginning of App component
    const routingSetup = `
  // Routing state
  const [currentRoute, setCurrentRoute] = React.useState(window.Router.getCurrentRoute() || 'home');
  
  // Listen for route changes
  React.useEffect(() => {
    const unsubscribe = window.Router.onRouteChange((newRoute) => {
      setCurrentRoute(newRoute);
    });
    return unsubscribe;
  }, []);
  
  // Route to page components
  ${routingConditions}
  
  // Default layout for home or unknown routes
  `
    
    return appContent.substring(0, appStartIndex) + routingSetup + appContent.substring(appStartIndex)
  }
  
  return appContent
}

// Legacy: Generate single UI file
async function generateUICode(projectIdea: ProjectIdea, uiPlan: UIPlan): Promise<string> {
  const prompt = `
Create a fully functional React component with Tailwind CSS that actually implements the project concept:

Project: ${projectIdea.title}
Components needed: ${uiPlan.components.join(', ')}
Layout: ${uiPlan.layout}
Interactions: ${uiPlan.user_interactions.join(', ')}

IMPORTANT: Create a REALISTIC, FUNCTIONAL interface that users would actually want to use for "${projectIdea.title}". Include:
1. Rich, meaningful content (not just placeholder text)
2. Multiple interactive elements that demonstrate the app's purpose
3. Realistic data/examples that show what the app does
4. Proper visual hierarchy and modern design
5. All components should serve the project's core functionality

CRITICAL LAYOUT REQUIREMENTS:
1. Use flexbox or grid for layouts - avoid absolute/fixed positioning unless necessary
2. If using fixed/absolute positioning, ensure components don't overlap:
   - Navigation: top of screen
   - Sidebars: left or right side
   - Modals/overlays: hidden by default with state management
   - Floating buttons: use specific corners with proper spacing
3. All modals, popups, and overlays MUST be conditionally rendered with state (default: hidden)
4. Use proper z-index layering when needed
5. Ensure responsive design with proper mobile layouts

Technical Requirements:
- Use React functional components with hooks for state management
- Use React.createElement() for ALL elements - NO JSX SYNTAX
- Style with Tailwind CSS classes in className props (REQUIRED for ALL elements)
- Use proper Tailwind classes for colors, spacing, layout, typography, and effects
- Include mock data for display
- NO imports - React will be available globally
- End with: window.App = YourMainComponent;

EXAMPLE - Newsletter Editor with rich content and functionality:
const App = () => {
  const [activeTab, setActiveTab] = React.useState('content');
  const [showPreview, setShowPreview] = React.useState(false);
  
  return React.createElement('div', { className: 'min-h-screen flex flex-col bg-gray-50' },
    // Header with project branding and actions
    React.createElement('header', { className: 'bg-white border-b px-6 py-4 flex justify-between items-center' },
      React.createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Newsletter Editor Pro'),
      React.createElement('div', { className: 'flex gap-3' },
        React.createElement('button', { 
          className: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
          onClick: () => setShowPreview(!showPreview)
        }, showPreview ? 'Edit' : 'Preview'),
        React.createElement('button', { className: 'px-4 py-2 bg-green-600 text-white rounded-lg' }, 'Send Newsletter')
      )
    ),
    // Main content with tabs and editor
    React.createElement('main', { className: 'flex-1 flex' },
      React.createElement('div', { className: 'flex-1 p-6' },
        // Tab navigation
        React.createElement('div', { className: 'flex gap-1 mb-6 border-b' },
          ['content', 'design', 'recipients'].map(tab =>
            React.createElement('button', {
              key: tab,
              className: 'px-4 py-2 capitalize ' + (activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'),
              onClick: () => setActiveTab(tab)
            }, tab)
          )
        ),
        // Content area based on active tab
        React.createElement('div', { className: 'bg-white rounded-lg p-6 shadow-sm' },
          activeTab === 'content' ? 'Newsletter content editor here...' : 
          activeTab === 'design' ? 'Design customization options...' :
          'Recipient management...'
        )
      )
    )
  );
};

window.App = App;

IMPORTANT: Return ONLY the React component code using React.createElement. NO JSX, NO angle brackets like <div>.
`

  const response = await codeLLM.invoke([
    new SystemMessage(`You are an expert UI developer creating production-ready React components.

QUALITY REQUIREMENTS:
1. Create interfaces that look professional and modern
2. Include realistic content, data, and examples (not just "Content here...")
3. Implement actual functionality that demonstrates the app's purpose
4. Use proper visual hierarchy with headers, sections, cards, etc.
5. Add multiple interactive elements that make sense for the project
6. DON'T show raw state values in the UI (like "false" or "true")
7. Make components that users would actually want to use

LAYOUT RULES:
1. Use flexbox/grid layouts - avoid overlapping components
2. Navigation bars: use sticky/fixed top-0 with proper z-index
3. Sidebars: use flex layouts, not absolute positioning
4. Modals/overlays: MUST be hidden by default with useState(false)
5. Floating buttons: position in corners with margin, avoid overlap
6. NO multiple components with same fixed position (e.g., multiple fixed right-0 top-0)

CODE RULES:
1. Use React.createElement() for ALL elements - NO JSX syntax allowed
2. NO import statements - React is globally available
3. NO markdown code blocks (no \`\`\`)
4. NO explanatory text before, after, or within the code
5. NO comments about what the code does
6. Use React.useState for state management when needed
7. End with: window.App = YourMainComponentName;
8. ONLY valid JavaScript that can run directly`),
    new HumanMessage(prompt + '\n\nCRITICAL: Create a RICH, FUNCTIONAL interface that truly represents what this app would look like in production. Include sample data, multiple features, and realistic interactions. NO placeholder text like "Content here" - make it look like a real app!\n\nRemember: Output ONLY the code using React.createElement, NO JSX. Avoid overlapping components!'),
  ])

  let code = response.content as string
  
  // Clean up the response in case it still contains markdown or extra text
  // Remove markdown code blocks
  code = code.replace(/```(?:jsx?|javascript|typescript|tsx?)?\n?/g, '')
  code = code.replace(/```\n?/g, '')
  
  // Remove any leading/trailing non-code text
  const firstConstOrFunction = code.search(/(?:const|function)\s+\w+/)
  if (firstConstOrFunction > 0) {
    code = code.substring(firstConstOrFunction)
  }
  
      // DISABLED: This truncation was causing "Unexpected end of input" errors
      // The AI-generated code is already properly formatted, don't truncate it
      console.log('Skipping code truncation - trusting AI output')
  
      // Ensure the code ends with App assignment and makes it global
    code = code.trim()
    if (!code.includes('const App =')) {
      // Try to find the main component name and add assignment
      const componentMatch = code.match(/(?:function|const)\s+(\w+)\s*[=(]/)
      if (componentMatch) {
        code += `\n\nconst App = ${componentMatch[1]};\nwindow.App = App;`
      }
    } else if (!code.includes('window.App')) {
      // App is defined but not made global
      code += '\nwindow.App = App;'
    }
  
  console.log('UI code cleaned, length:', code.length)
  return code
}

// Helper functions (extractTitle, cleanProjectTitle, etc.)

// ... existing code ... 