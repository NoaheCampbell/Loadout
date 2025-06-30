import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { nanoid } from 'nanoid'
import type { 
  ProjectIdea, 
  PRD, 
  ChecklistItem,
  BrainliftLog, 
  UIPlan, 
  UIStrategy,
  ProjectFiles,
  ChatMessage 
} from '../../src/types'
import { storage } from './storage'

// Initialize LLM
const llm = new ChatOpenAI({
  modelName: 'gpt-4-1106-preview',
  temperature: 0.7,
})

// Specialized LLM for code generation with lower temperature
const codeLLM = new ChatOpenAI({
  modelName: 'gpt-4-1106-preview',
  temperature: 0.3, // Lower temperature for more consistent code generation
})

// Progress callback type
type ProgressCallback = (node: string, status: 'pending' | 'in-progress' | 'success' | 'error', message?: string) => void

// Process idea into structured format
async function processIdea(idea: string): Promise<ProjectIdea> {
  const response = await llm.invoke([
    new SystemMessage(
      'Extract a project title and clean description from the user\'s raw idea. ' +
      'The title should be concise (3-5 words). The description should be clear and actionable.'
    ),
    new HumanMessage(idea),
  ])

  const content = response.content as string
  const lines = content.split('\n').filter(line => line.trim())
  const title = lines[0]?.replace(/^(Title:|#)\s*/i, '').trim() || 'Untitled Project'
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

// Generate UI plan
async function generateUIPlan(projectIdea: ProjectIdea, prd: PRD): Promise<UIPlan> {
  const prompt = `
Based on this project, create a UI plan:

Title: ${projectIdea.title}
Problem: ${prd.problem}
Goals: ${prd.goals.join(', ')}

Generate:
1. List of main UI components needed
2. Overall layout structure
3. Key user interactions

Format as JSON:
{
  "components": ["ComponentName", ...],
  "layout": "Description of the layout structure",
  "user_interactions": ["interaction1", "interaction2", ...]
}
`

  const response = await llm.invoke([
    new SystemMessage('You are a UI/UX designer planning the interface. Return only valid JSON.'),
    new HumanMessage(prompt),
  ])

  const content = response.content as string
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  return JSON.parse(jsonMatch[0]) as UIPlan
}

// Determine UI generation strategy
function determineUIStrategy(uiPlan: UIPlan): UIStrategy {
  const componentCount = uiPlan.components.length
  const hasComplexInteractions = uiPlan.user_interactions.some(
    interaction => interaction.toLowerCase().includes('drag') ||
                   interaction.toLowerCase().includes('real-time') ||
                   interaction.toLowerCase().includes('complex')
  )

  return (componentCount <= 3 && !hasComplexInteractions) ? 'v0' : 'gpt'
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

// Generate UI code
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
- Style with Tailwind CSS classes in className props
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
  
      // Find the last 'window.App = ' assignment or 'const App = ' assignment
    const windowAppMatch = code.match(/window\.App\s*=\s*\w+\s*;?\s*$/m)
    const appAssignmentMatch = code.match(/const\s+App\s*=\s*\w+\s*;?\s*$/m)
    
    if (windowAppMatch) {
      const endIndex = code.lastIndexOf(windowAppMatch[0]) + windowAppMatch[0].length
      code = code.substring(0, endIndex)
    } else if (appAssignmentMatch) {
      // Found App assignment but might need to add window.App
      const endIndex = code.lastIndexOf(appAssignmentMatch[0]) + appAssignmentMatch[0].length
      code = code.substring(0, endIndex)
    } else {
      // If no App assignment, look for the last closing brace
      const lastBraceIndex = code.lastIndexOf('}')
      if (lastBraceIndex !== -1) {
        code = code.substring(0, lastBraceIndex + 1)
        // Try to find the main component and add App assignment
        const componentMatch = code.match(/(?:function|const)\s+(\w+)\s*(?:\(|=)/)
        if (componentMatch) {
          code += `\n\nconst App = ${componentMatch[1]};`
        }
      }
    }
  
      // Ensure the code ends with App assignment and makes it global
    code = code.trim()
    if (!code.includes('const App =')) {
      // Try to find the main component name and add assignment
      const componentMatch = code.match(/(?:function|const)\s+(\w+)\s*(?:\(|=)/)
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

// Main workflow runner
export async function runWorkflow(
  idea: string,
  onProgress: ProgressCallback,
  chatHistory?: ChatMessage[]
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const projectId = nanoid()
  console.log('Starting workflow for project:', projectId)
  if (chatHistory) {
    console.log('Chat history provided:', chatHistory.length, 'messages')
  }
  
  try {
    // Step 1: Process idea
    console.log('Step 1: Processing idea...')
    onProgress('IdeaInputNode', 'in-progress', 'Processing your idea...')
    const projectIdea = await processIdea(idea)
    console.log('Idea processed:', projectIdea)
    onProgress('IdeaInputNode', 'success')

    // Step 2: Generate PRD
    console.log('Step 2: Generating PRD...')
    onProgress('PRDGeneratorNode', 'in-progress', 'Generating PRD...')
    const prd = await generatePRD(projectIdea)
    console.log('PRD generated:', { problem: prd.problem.substring(0, 100) + '...' })
    onProgress('PRDGeneratorNode', 'success')

    // Step 3: Generate checklist
    console.log('Step 3: Generating checklist...')
    onProgress('ChecklistGeneratorNode', 'in-progress', 'Creating development checklist...')
    const checklist = await generateChecklist(prd)
    console.log('Checklist generated:', checklist.length, 'items')
    onProgress('ChecklistGeneratorNode', 'success')

    // Step 3.5: Generate brainlift (optional)
    console.log('Step 3.5: Generating brainlift...')
    onProgress('BrainliftNode', 'in-progress', 'Documenting assumptions and decisions...')
    const brainlift = await generateBrainlift(projectIdea, prd)
    console.log('Brainlift result:', brainlift ? 'generated' : 'skipped')
    if (brainlift) {
      onProgress('BrainliftNode', 'success')
    }

    // Step 4: Generate UI plan
    console.log('Step 4: Planning UI...')
    onProgress('UIPlannerNode', 'in-progress', 'Planning UI components...')
    const uiPlan = await generateUIPlan(projectIdea, prd)
    console.log('UI plan generated:', { components: uiPlan.components })
    onProgress('UIPlannerNode', 'success')

    // Step 5: Determine UI strategy
    console.log('Step 5: Determining UI strategy...')
    onProgress('UIStrategyDecisionNode', 'in-progress', 'Determining UI generation strategy...')
    const uiStrategy = determineUIStrategy(uiPlan)
    console.log('UI strategy determined:', uiStrategy)
    onProgress('UIStrategyDecisionNode', 'success')

    // Step 6: Generate UI code or v0 prompt
    console.log('Step 6: Generating UI...')
    let uiCode: string | undefined
    let v0Prompt: any | undefined
    
    if (uiStrategy === 'gpt') {
      console.log('Generating GPT UI code...')
      onProgress('GPTUICodeNode', 'in-progress', 'Generating UI code...')
      uiCode = await generateUICode(projectIdea, uiPlan)
      console.log('UI code generated:', uiCode ? uiCode.length + ' characters' : 'none')
      onProgress('GPTUICodeNode', 'success')
    } else {
      console.log('Generating v0 prompt...')
      onProgress('V0PromptNode', 'in-progress', 'Generating v0 prompt...')
      v0Prompt = await generateV0Prompt(projectIdea, uiPlan)
      console.log('v0 prompt generated:', v0Prompt)
      onProgress('V0PromptNode', 'success')
    }

    // Save project to storage
    console.log('Saving project to storage...')
    const projectFiles: Partial<ProjectFiles> = {
      idea,
      prd,
      checklist,
      brainlift: brainlift || undefined,
      uiPlan,
      uiStrategy,
      uiCode,
      v0Prompt,
      chatHistory,
    }

    await storage.saveProject(projectId, projectFiles, projectIdea.title)
    console.log('Project saved successfully:', projectId)

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