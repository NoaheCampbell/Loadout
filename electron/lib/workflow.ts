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
  ChatMessage,
  UIFile
} from '../../src/types'
import { storage } from './storage'

// Initialize LLM
const llm = new ChatOpenAI({
  modelName: 'gpt-4-1106-preview',
  temperature: 0.7,
})

// Specialized LLM for code generation with balanced temperature
const codeLLM = new ChatOpenAI({
  modelName: 'gpt-4-1106-preview',
  temperature: 0.5, // Balanced temperature for creative but consistent code
})

// Progress callback type
type ProgressCallback = (node: string, status: 'pending' | 'in-progress' | 'success' | 'error', message?: string) => void

// Process idea into structured format for React app
async function processIdea(idea: string): Promise<ProjectIdea> {
  const response = await llm.invoke([
    new SystemMessage(
      'Extract a project title and clean description for a REACT WEB APPLICATION from the user\'s idea. ' +
      'The title should be concise (3-5 words). The description should clearly describe what this React app will do.'
    ),
    new HumanMessage(`Create a React web application for: ${idea}`),
  ])

  const content = response.content as string
  const lines = content.split('\n').filter(line => line.trim())
  const title = lines[0]?.replace(/^(Title:|#)\s*/i, '').trim() || 'Untitled React App'
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
- User account area with avatar/dropdown
- Responsive mobile design (hidden md:flex for desktop items)
- Styled with Tailwind: bg-white shadow-md, proper padding, flex layout
- Any search or action buttons that make sense for this app`
      
      case 'sidebar':
        return `Create a sidebar navigation component with:
- Menu items relevant to "${projectContext.title}"
- Organized sections with proper spacing (space-y-2)
- Icons where appropriate (use emoji or unicode symbols)
- Active state handling (bg-blue-50 text-blue-700 for active)
- Styled with Tailwind: w-64 bg-gray-50 p-4, hover effects
- Proper visual hierarchy with text-sm, font-medium`
      
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
- Centered positioning (flex items-center justify-center)`
      
      case 'form':
        return `Create a form component with:
- Input fields relevant to "${projectContext.title}"
- Proper Tailwind form styling (border rounded px-3 py-2 focus:outline-none focus:ring-2)
- Validation states (border-red-500 for errors, border-green-500 for success)
- Submit button (bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700)
- Clear labels (text-sm font-medium text-gray-700) and helper text
- Proper spacing between form elements (space-y-4)`
      
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
- Consistent styling`
      
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
- Ensure responsive design with proper breakpoints`
      
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

// Validate generated code for common issues
function validateGeneratedCode(code: string, componentName: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check for markdown code blocks
  if (code.includes('```')) {
    issues.push('Contains markdown code blocks')
  }
  
  // Check for explanatory text patterns
  const explanatoryPatterns = [
    /^(Here's|Here is|This is|I'll|I will|Let me)/m,
    /^(The following|Below is|Above is)/m,
    /(Error:|Sorry|I cannot|I can't|I'm unable)/i,
    /^(Note:|Important:|Please note)/m,
    /^(To use this|To implement)/m,
    /^(Step \d+:|First,|Second,|Finally,)/m,
    /^(This component|This function|This will)/mi,
    /^(You can|You should|You need to)/mi,
    /^(Make sure|Be sure|Ensure that)/mi,
    /^(Remember to|Don't forget)/mi,
    /^(Example:|For example:)/mi,
    /(as follows:|following code:|code below:)/i,
    /^\/\/ This is a/m,
    /^\/\/ Here's/m
  ]
  
  for (const pattern of explanatoryPatterns) {
    if (pattern.test(code)) {
      issues.push(`Contains explanatory text: "${pattern.source}"`)
    }
  }
  
  // Check for import/export statements (should not be in the code)
  if (code.includes('import ') || code.includes('export ')) {
    issues.push('Contains import/export statements')
  }
  
  // Check if it's missing the window assignment
  if (!code.includes(`window.${componentName}`)) {
    issues.push(`Missing window.${componentName} assignment`)
  }
  
  // Check if it's missing React.createElement (unless it's just a compatibility wrapper)
  if (!code.includes('React.createElement') && !code.includes('JSX compatibility wrapper')) {
    issues.push('Missing React.createElement calls')
  }
  
  // Check for common markdown patterns
  if (code.match(/^#{1,6}\s/m) || code.match(/^\*{1,3}\s/m) || code.match(/^-{3,}$/m)) {
    issues.push('Contains markdown formatting')
  }
  
  // Check if it's too short (likely a placeholder or error)
  if (code.length < 200) {
    issues.push('Code is too short - likely incomplete or placeholder')
  }
  
  // Check if it contains actual UI elements
  if (!code.includes("'div'") && !code.includes('"div"') && 
      !code.includes("'button'") && !code.includes('"button"') &&
      !code.includes("'span'") && !code.includes('"span"')) {
    issues.push('No UI elements found - component appears empty')
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

// Analyze UI plan to determine what files need to be created
function analyzeComponentsNeeded(uiPlan: UIPlan): Array<{ name: string; type: string }> {
  const componentsToGenerate: Array<{ name: string; type: string }> = []
  
  // Filter out the App component as we'll generate it separately
  const componentNames = uiPlan.components.filter(name => 
    !name.toLowerCase().includes('app') && 
    !name.toLowerCase().includes('main') &&
    !name.toLowerCase().includes('container')
  )
  
  // Analyze each component and determine its type
  componentNames.forEach(name => {
    const type = determineComponentType(name)
    componentsToGenerate.push({ name, type })
  })
  
  // Log what we're planning to generate
  console.log('Components to generate:', componentsToGenerate)
  
  return componentsToGenerate
}

// Generate multiple UI files by creating components sequentially
async function generateUIFiles(projectIdea: ProjectIdea, uiPlan: UIPlan, onProgress?: ProgressCallback): Promise<UIFile[]> {
  const files: UIFile[] = []
  
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
      
      // Validate the generated code
      const validation = validateGeneratedCode(content, component.name)
      isValid = validation.valid
      
      if (!isValid) {
        console.warn(`Validation failed for ${component.name}:`, validation.issues)
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
    
    if (!isValid) {
      console.error(`Failed to generate valid code for ${component.name} after ${maxRetries} attempts`)
      // Still add the file, but it might have issues
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
    
    // Validate the App component
    const appValidation = validateGeneratedCode(appContent, 'App')
    appIsValid = appValidation.valid
    
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
  
  return files
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
    let uiFiles: UIFile[] | undefined
    let v0Prompt: any | undefined
    
    if (uiStrategy === 'gpt') {
      console.log('Generating GPT UI code...')
      onProgress('GPTUICodeNode', 'in-progress', 'Generating UI code...')
      
      // Try to generate multiple files first
      try {
        uiFiles = await generateUIFiles(projectIdea, uiPlan, onProgress)
        console.log('UI files generated:', uiFiles.length, 'files')
        console.log('File details:', uiFiles.map(f => ({
          filename: f.filename,
          type: f.type,
          length: f.content.length,
          hasWindowAssignment: f.content.includes('window.')
        })))
        
        // Validate that we have an App.tsx file
        const hasAppFile = uiFiles.some(f => f.type === 'main' || f.filename.toLowerCase().includes('app'))
        if (!hasAppFile) {
          console.error('No App.tsx file found in generated files!')
        }
        
        // Also generate single file for backwards compatibility
        // Combine all files into one for legacy support
        uiCode = uiFiles.map(file => `// File: ${file.filename}\n${file.content}`).join('\n\n')
      } catch (error) {
        console.error('Multi-file generation failed, falling back to single file:', error)
        // Fall back to single file generation
        uiCode = await generateUICode(projectIdea, uiPlan)
        console.log('UI code generated (single file):', uiCode ? uiCode.length + ' characters' : 'none')
      }
      
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
      uiFiles,
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