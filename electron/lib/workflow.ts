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
  uiGuidelines: Annotation<string | undefined>,
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

// Progress callback type with support for hierarchical nodes
type ProgressCallback = (
  node: string, 
  status: 'pending' | 'in-progress' | 'success' | 'error', 
  message?: string,
  isParent?: boolean,
  parentNode?: string
) => void

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
    if (!state.projectIdea) {
      console.warn('Project idea not available, cannot generate PRD')
      return {} // Skip PRD generation
    }
    state.onProgress?.('PRDGeneratorNode', 'in-progress', 'Generating PRD...')
    const prd = await generatePRD(state.projectIdea)
    state.onProgress?.('PRDGeneratorNode', 'success')
    return { prd }
  } catch (error) {
    console.error('PRD generation error:', error)
    state.onProgress?.('PRDGeneratorNode', 'error', error instanceof Error ? error.message : 'Failed to generate PRD')
    // Don't propagate error to avoid workflow failure
    return {}
  }
}

// Generate checklist node
async function generateChecklistNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.prd) {
      console.warn('PRD not available, skipping checklist generation')
      return { checklist: [] } // Return empty checklist instead of error
    }
    state.onProgress?.('ChecklistGeneratorNode', 'in-progress', 'Creating development checklist...')
    const checklist = await generateChecklist(state.prd)
    state.onProgress?.('ChecklistGeneratorNode', 'success')
    return { checklist }
  } catch (error) {
    console.error('Failed to generate checklist:', error)
    state.onProgress?.('ChecklistGeneratorNode', 'error', error instanceof Error ? error.message : 'Failed to generate checklist')
    // Return empty checklist instead of propagating error to avoid concurrent update issues
    return { checklist: [] }
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
    if (!state.projectIdea || !state.prd) {
      console.warn('Project idea or PRD not available, using minimal UI plan')
      // Return a minimal UI plan instead of error
      return { 
        uiPlan: {
          components: ['Header', 'MainContent', 'Footer'],
          layout: 'simple layout',
          user_interactions: ['navigation', 'content interaction']
        }
      }
    }
    state.onProgress?.('UIPlannerNode', 'in-progress', 'Planning UI components...')
    const uiPlan = await generateUIPlan(state.projectIdea, state.prd)
    state.onProgress?.('UIPlannerNode', 'success')
    
    // After planning, show all components that will be generated as pending
    const componentsToGenerate = analyzeComponentsNeeded(uiPlan)
    const nonAuthComponents = componentsToGenerate.filter(comp => !isAuthRelatedComponent(comp.name))
    
    // Send pending status for all components that will be generated
    for (const comp of nonAuthComponents) {
      state.onProgress?.(comp.name, 'pending', undefined, false, 'UIGenerationNode')
    }
    
    // Also show App.tsx as pending
    state.onProgress?.('App', 'pending', undefined, false, 'UIGenerationNode')
    
    // Generate UI guidelines based on the plan
    const uiGuidelines = generateUIBuildGuidelines(state.projectIdea, uiPlan)
    
    return { uiPlan, uiGuidelines }
  } catch (error) {
    console.error('Failed to generate UI plan:', error)
    state.onProgress?.('UIPlannerNode', 'error', error instanceof Error ? error.message : 'Failed to generate UI plan')
    // Return minimal UI plan instead of propagating error
    return { 
      uiPlan: {
        components: ['Header', 'MainContent', 'Footer'],
        layout: 'simple layout',
        user_interactions: ['navigation', 'content interaction']
      }
    }
  }
}

// Determine strategy node
async function determineStrategyNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.uiPlan) {
      console.warn('UI plan not available, defaulting to GPT strategy')
      return { uiStrategy: 'gpt' }
    }
    state.onProgress?.('UIStrategyDecisionNode', 'in-progress', 'Determining UI generation strategy...')
    const uiStrategy = determineUIStrategy(state.uiPlan)
    state.onProgress?.('UIStrategyDecisionNode', 'success')
    return { uiStrategy }
  } catch (error) {
    console.error('Failed to determine strategy:', error)
    state.onProgress?.('UIStrategyDecisionNode', 'error', error instanceof Error ? error.message : 'Failed to determine strategy')
    // Default to GPT strategy instead of failing
    return { uiStrategy: 'gpt' }
  }
}

// Generate UI node
async function generateUINode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.projectIdea || !state.uiPlan || !state.uiStrategy) {
      throw new Error('Project idea, UI plan, and strategy required')
    }
    
    if (state.uiStrategy === 'gpt') {
      // Don't send GPTUICodeNode progress - it's redundant with UIGenerationNode
      try {
        const generateResult = await generateUIFiles(state.projectIdea, state.uiPlan, state.onProgress, state.uiGuidelines)
        const uiFiles = generateResult.files
        const validationIssues = generateResult.validationIssues
        
        // Also generate single file for backwards compatibility
        const uiCode = uiFiles.map(file => `// File: ${file.filename}\n${file.content}`).join('\n\n')
        
        return { uiFiles, uiCode, validationIssues }
      } catch (error) {
        console.error('Multi-file generation failed, falling back to single file:', error)
        const uiCode = await generateUICode(state.projectIdea, state.uiPlan)
        return { uiCode }
      }
    } else {
      state.onProgress?.('V0PromptNode', 'in-progress', 'Generating v0 prompt...')
      const v0Prompt = await generateV0Prompt(state.projectIdea, state.uiPlan)
      state.onProgress?.('V0PromptNode', 'success')
      return { v0Prompt }
    }
  } catch (error) {
    const nodeName = state.uiStrategy === 'gpt' ? 'UIGenerationNode' : 'V0PromptNode'
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
    .addNode('updateImplementationChecklist', generateImplementationChecklistNode)
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
  
  // Then generate UI, update checklist with implementation details, and save
  workflow.addEdge('determineStrategy', 'generateUI')
  workflow.addEdge('generateUI', 'updateImplementationChecklist')
  workflow.addEdge('updateImplementationChecklist', 'saveProject')
  workflow.addEdge('saveProject', '__end__')
  
  return workflow.compile()
}

// Generate Mermaid diagram of the workflow with validation details
export function visualizeWorkflow(): string {
  const mermaid = `graph TD
    Start([Start]) --> ProcessIdea["processIdea<br/>✓ Validate idea text<br/>✓ Clean title formatting<br/>✓ Generate description"]
    
    ProcessIdea -->|Success| GeneratePRD["generatePRD<br/>✓ Parse JSON response<br/>✓ Validate PRD structure<br/>✓ Fallback for missing fields"]
    ProcessIdea -->|Error| ErrorEnd[["❌ Error: Failed to<br/>process idea"]]
    
    GeneratePRD -->|Success| Parallel{Parallel Execution}
    GeneratePRD -->|Error<br/>Continue anyway| Parallel
    
    Parallel --> GenerateChecklist["generateChecklist<br/>✓ Check PRD exists<br/>✓ Generate phase-based tasks<br/>✓ Return empty array on fail"]
    Parallel --> GenerateBrainlift["generateBrainlift<br/>✓ Check PRD.goals array<br/>✓ Parse assumptions/decisions<br/>✓ Skip if prerequisites missing"]
    Parallel --> GenerateUIPlan["generateUIPlan<br/>✓ Validate component specs<br/>✓ Check for duplicates<br/>✓ Generate guidelines<br/>✓ Fallback to minimal plan"]
    
    GenerateChecklist --> DetermineStrategy["determineStrategy<br/>✓ Check UI plan exists<br/>✓ Analyze complexity<br/>✓ Default to GPT strategy"]
    GenerateBrainlift --> DetermineStrategy
    GenerateUIPlan --> DetermineStrategy
    
    DetermineStrategy -->|GPT Strategy| GenerateUI["generateUI (GPT)<br/>✓ Analyze components needed<br/>✓ Filter auth components<br/>✓ Generate in parallel<br/>✓ Validate each file<br/>✓ Retry on errors<br/>✓ Create helper files"]
    DetermineStrategy -->|v0 Strategy| GenerateV0["generateUI (v0)<br/>Generate v0 prompt"]
    
    GenerateUI --> ValidateUI{"Validation<br/>✓ Check syntax<br/>✓ Verify imports<br/>✓ No undefined refs<br/>✓ Clean auth artifacts"}
    
    ValidateUI -->|Valid| UpdateChecklist["updateImplementationChecklist<br/>✓ Add technical tasks<br/>✓ Component-specific items<br/>✓ Hook implementations"]
    ValidateUI -->|Has Issues| RetryGeneration["Retry with fixes<br/>(max 2 attempts)"]
    
    RetryGeneration --> ValidateUI
    GenerateV0 --> UpdateChecklist
    
    UpdateChecklist --> SaveProject["saveProject<br/>✓ Save all artifacts<br/>✓ Include validation issues<br/>✓ Update storage"]
    
    SaveProject -->|Success| End([End])
    SaveProject -->|Error| SaveError[["❌ Error: Failed to<br/>save project"]]
    
    %% Sub-process for UI Generation
    subgraph "UI Generation Details"
        UIComponents["Components:<br/>• Header<br/>• Sidebar<br/>• MainContent<br/>• Footer<br/>• Custom components"]
        UIValidation["Each component:<br/>1. Generate code<br/>2. Validate syntax<br/>3. Check imports<br/>4. Clean auth refs<br/>5. Retry if needed"]
        UIHelpers["Helper files:<br/>• _setup.js<br/>• _ComponentManifest.js<br/>• index.html"]
    end
    
    %% Styling
    classDef error fill:#ff6b6b,stroke:#c92a2a,color:#fff
    classDef validation fill:#fab005,stroke:#f08c00,color:#000
    classDef success fill:#51cf66,stroke:#2b8a3e,color:#fff
    classDef parallel fill:#be4bdb,stroke:#9c36b5,color:#fff
    classDef process fill:#4dabf7,stroke:#1864ab,color:#fff
    
    class ErrorEnd,SaveError error
    class ValidateUI,RetryGeneration,UIValidation validation
    class End,SaveProject success
    class Parallel,GenerateChecklist,GenerateBrainlift,GenerateUIPlan parallel
    class ProcessIdea,GeneratePRD,DetermineStrategy,GenerateUI,UpdateChecklist process`
  
  return mermaid
}

// Get detailed workflow state for debugging
export function getWorkflowDebugInfo(): {
  nodes: Array<{ name: string; description: string; validations: string[] }>
  edges: Array<{ from: string; to: string; condition?: string }>
  parallelGroups: Array<{ name: string; nodes: string[] }>
} {
  return {
    nodes: [
      {
        name: 'processIdea',
        description: 'Process raw idea into structured format',
        validations: [
          'Validate idea text is not empty',
          'Clean title from markdown formatting',
          'Remove common prefixes (Title:, Project Title:, etc.)',
          'Ensure title is not too long (max 50 chars)',
          'Generate description if missing'
        ]
      },
      {
        name: 'generatePRD',
        description: 'Generate Product Requirements Document',
        validations: [
          'Parse JSON response from LLM',
          'Check for required fields (problem, goals, scope, constraints, success_criteria)',
          'Ensure goals and constraints are arrays',
          'Provide fallback values for missing fields',
          'Validate no nested checkboxes in requirements'
        ]
      },
      {
        name: 'generateChecklist',
        description: 'Create phase-based development checklist',
        validations: [
          'Check if PRD exists',
          'Verify PRD has goals and constraints arrays',
          'Generate 7 phases with features and sub-features',
          'Ensure proper checkbox formatting',
          'Return empty array on failure (not error)'
        ]
      },
      {
        name: 'generateBrainlift',
        description: 'Document assumptions and technical decisions',
        validations: [
          'Check if PRD has goals array',
          'Parse assumptions, decisions, and context links',
          'Skip gracefully if prerequisites missing',
          'Return null on any error (non-critical)'
        ]
      },
      {
        name: 'generateUIPlan',
        description: 'Plan UI components and architecture',
        validations: [
          'Validate component specifications',
          'Check for duplicate responsibilities',
          'Detect overlapping content between components',
          'Check for navigation/branding conflicts',
          'Generate UI build guidelines',
          'Fallback to minimal plan (Header, MainContent, Footer)'
        ]
      },
      {
        name: 'determineStrategy',
        description: 'Choose UI generation strategy',
        validations: [
          'Check if UI plan exists',
          'Analyze component complexity',
          'Default to GPT strategy on any error'
        ]
      },
      {
        name: 'generateUI',
        description: 'Generate UI component files',
        validations: [
          'Analyze components needed from UI plan',
          'Filter out auth-related components',
          'Generate each component with validation',
          'Check for React syntax errors',
          'Verify all imports are defined',
          'Remove undefined window references',
          'Clean auth artifacts from code',
          'Retry generation up to 2 times on validation failure',
          'Generate helper files (_setup.js, _ComponentManifest.js, index.html)',
          'Fall back to single-file generation if multi-file fails'
        ]
      },
      {
        name: 'updateImplementationChecklist',
        description: 'Add implementation tasks to checklist',
        validations: [
          'Check if UI files were generated',
          'Parse generated code for hooks and state',
          'Add component-specific tasks',
          'Handle both array and non-array checklist formats'
        ]
      },
      {
        name: 'saveProject',
        description: 'Save all artifacts to storage',
        validations: [
          'Ensure projectIdea exists',
          'Bundle all artifacts (PRD, checklist, UI files, etc.)',
          'Save to file system',
          'Handle missing optional fields gracefully'
        ]
      }
    ],
    edges: [
      { from: '__start__', to: 'processIdea' },
      { from: 'processIdea', to: 'generatePRD', condition: 'Always (errors stop workflow)' },
      { from: 'generatePRD', to: 'generateChecklist', condition: 'Always (even on error)' },
      { from: 'generatePRD', to: 'generateBrainlift', condition: 'Always (even on error)' },
      { from: 'generatePRD', to: 'generateUIPlan', condition: 'Always (even on error)' },
      { from: 'generateChecklist', to: 'determineStrategy' },
      { from: 'generateBrainlift', to: 'determineStrategy' },
      { from: 'generateUIPlan', to: 'determineStrategy' },
      { from: 'determineStrategy', to: 'generateUI' },
      { from: 'generateUI', to: 'updateImplementationChecklist' },
      { from: 'updateImplementationChecklist', to: 'saveProject' },
      { from: 'saveProject', to: '__end__' }
    ],
    parallelGroups: [
      {
        name: 'Post-PRD Processing',
        nodes: ['generateChecklist', 'generateBrainlift', 'generateUIPlan']
      }
    ]
  }
}

// Main workflow runner - now powered by LangGraph!
export async function runWorkflow(
  idea: string,
  onProgress: ProgressCallback,
  chatHistory?: ChatMessage[]
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const projectId = nanoid()
  console.log('🦜️🔗 Starting LangGraph workflow for project:', projectId)
  
  // Create a wrapped progress callback that adds hierarchical info
  const wrappedProgress: ProgressCallback = (node, status, message, isParent, parentNode) => {
    onProgress(node, status, message, isParent, parentNode)
  }
  
  try {
    const workflow = createWorkflow()
    
    const result = await workflow.invoke({
      idea,
      chatHistory: chatHistory || [],
      projectId,
      onProgress: wrappedProgress
    })
    
    // Check if we have the minimum required outputs
    if (!result.projectIdea) {
      throw new Error('Failed to process project idea')
    }
    
    // Log if some nodes used fallbacks
    if (!result.prd || Object.keys(result.prd).length === 0) {
      console.warn('PRD generation failed, some features may be limited')
    }
    if (!result.checklist || result.checklist.length === 0) {
      console.warn('Checklist generation failed or returned empty')
    }
    if (!result.uiPlan || result.uiPlan.components.length <= 3) {
      console.warn('UI plan generation used minimal fallback')
    }
    
    // Even with degraded results, the workflow is considered successful
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
  try {
    const prompt = `
Based on this project idea, create a detailed Product Requirements Document (PRD) that follows this EXACT format:

Title: ${projectIdea.title}
Description: ${projectIdea.description}

You must generate a comprehensive PRD with these sections:

# Project Name
## Project Description
[A detailed 2-3 paragraph description of what the project is, its purpose, and value proposition]

## Target Audience
[Describe the primary and secondary users in detail - who they are, their needs, pain points, and how this solution helps them]

## Desired Features
Create 3-5 feature categories, each with 5-8 high-level requirements. Use checkbox format but NO SUB-ITEMS:

### [Feature Category 1]
- [ ] [High-level requirement 1]
- [ ] [High-level requirement 2]
- [ ] [High-level requirement 3]
- [ ] [High-level requirement 4]
- [ ] [High-level requirement 5]

### [Feature Category 2]
- [ ] [High-level requirement 1]
- [ ] [High-level requirement 2]
- [ ] [High-level requirement 3]

(Continue for all feature categories)

## Design Requests
List 5-8 high-level design and UX requirements:
- [ ] [Design requirement 1]
- [ ] [Design requirement 2]
- [ ] [Design requirement 3]
- [ ] [Design requirement 4]
- [ ] [Design requirement 5]

## Other Notes
- [Technical consideration or constraint]
- [Future enhancement possibility]
- [Integration requirement]
- [Performance requirement]
- [Any other important note]

IMPORTANT RULES:
1. NO sub-requirements or nested checkboxes (no indented items)
2. Keep requirements at a high level - they will be broken down into detailed tasks later
3. Each checkbox item should be a complete, standalone requirement
4. Be specific about features but don't drill into implementation details
5. Design requests should focus on user experience and visual aspects

Format your response as JSON with this structure. IMPORTANT: Preserve the FULL markdown content including headers and checkboxes:
{
  "problem": "# [Project Name]\\n\\n## Project Description\\n[Full Project Description content - multiple paragraphs]",
  "goals": [
    "### Feature Category 1\\n- [ ] Requirement 1\\n- [ ] Requirement 2\\n- [ ] Requirement 3\\n- [ ] Requirement 4\\n- [ ] Requirement 5",
    "### Feature Category 2\\n- [ ] Requirement 1\\n- [ ] Requirement 2\\n- [ ] Requirement 3"
  ],
  "scope": "[Full Target Audience description - who they are, their needs, pain points, and how this solution helps them]",
  "constraints": [
    "- [ ] Design requirement 1",
    "- [ ] Design requirement 2",
    "- [ ] Design requirement 3",
    "- [ ] Design requirement 4",
    "- [ ] Design requirement 5"
  ],
  "success_criteria": ["Technical consideration", "Future enhancement", "Integration requirement", "Performance requirement"]
}

CRITICAL: 
- The "goals" array should have one string per feature category, with ALL requirements for that category
- The "constraints" array should have simple checkbox items for design requirements
- NO nested checkboxes or sub-items anywhere
- Use \\n for line breaks within strings
- Make the content specific to "${projectIdea.title}" but keep requirements high-level`

    const response = await llm.invoke([
      new SystemMessage('You are an expert product manager creating a comprehensive PRD. Return valid JSON that preserves markdown formatting with checkboxes. Keep requirements at a high level without sub-items or nested checkboxes.'),
      new HumanMessage(prompt),
    ])

    const content = response.content as string
    console.log('PRD Generation - Raw AI response:', content.substring(0, 500) + '...')
    
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    
    const prd = JSON.parse(jsonMatch[0]) as PRD
    console.log('PRD Generation - Parsed JSON:', JSON.stringify(prd, null, 2).substring(0, 500) + '...')
    
    // Ensure all required fields are present and are arrays/strings
    const finalPrd = {
      problem: prd.problem || projectIdea.description,
      goals: Array.isArray(prd.goals) && prd.goals.length > 0 ? prd.goals : [
        `### Core Functionality\n- [ ] Implement ${projectIdea.title}\n- [ ] Set up project structure\n- [ ] Create main components\n- [ ] Add basic user interface\n- [ ] Design responsive layout\n- [ ] Implement navigation`
      ],
      scope: prd.scope || `Users who need ${projectIdea.title}. The target audience includes individuals and teams looking for a solution to efficiently manage their workflow.`,
      constraints: Array.isArray(prd.constraints) && prd.constraints.length > 0 ? prd.constraints : [
        `- [ ] Modern and intuitive user interface`,
        `- [ ] Mobile-responsive design`,
        `- [ ] Fast load times and smooth interactions`,
        `- [ ] Accessibility compliance`,
        `- [ ] Cross-browser compatibility`
      ],
      success_criteria: Array.isArray(prd.success_criteria) && prd.success_criteria.length > 0 ? prd.success_criteria : [
        'Successfully implement core functionality',
        'Provide intuitive user experience',
        'Ensure application stability and performance'
      ]
    }
    
    console.log('PRD Generation - Final PRD:', JSON.stringify(finalPrd, null, 2).substring(0, 500) + '...')
    return finalPrd
  } catch (error) {
    console.error('Failed to generate PRD, using fallback:', error)
    // Return a minimal but valid PRD structure
    return {
      problem: projectIdea.description,
      goals: [`Build ${projectIdea.title}`],
      scope: 'General users',
      constraints: ['Time and resource constraints'],
      success_criteria: ['Successfully launch the application']
    }
  }
}

// Generate brainlift (optional assumptions/decisions)
async function generateBrainlift(projectIdea: ProjectIdea, prd: PRD): Promise<BrainliftLog | null> {
  try {
    // Ensure PRD has required properties
    if (!prd.goals || !Array.isArray(prd.goals)) {
      console.warn('PRD missing goals property, skipping brainlift generation')
      return null
    }
    
    const prompt = `
Based on this project, identify key assumptions and technical decisions:

Project: ${projectIdea.title}
Problem: ${prd.problem || 'Not specified'}
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
  // Ensure PRD has required properties
  if (!prd.goals || !Array.isArray(prd.goals) || !prd.constraints || !Array.isArray(prd.constraints)) {
    console.warn('PRD missing required properties (goals/constraints), using defaults')
    // Provide default values
    prd.goals = prd.goals || []
    prd.constraints = prd.constraints || []
  }
  
  const prompt = `
Based on this PRD, create a comprehensive development checklist organized by phases:

Problem: ${prd.problem || 'Not specified'}
Goals: ${prd.goals.join('\n')}
Scope: ${prd.scope || 'Not specified'}
Constraints: ${prd.constraints.join('\n')}

Create a detailed checklist following this EXACT phase-based structure:

## Phases Overview
- [ ] Phase 1: Foundation & Core Infrastructure
- [ ] Phase 2: Data Management & Storage
- [ ] Phase 3: User Interface & Experience
- [ ] Phase 4: Business Logic & Processing
- [ ] Phase 5: Integration & External Services
- [ ] Phase 6: Analytics & Monitoring
- [ ] Phase 7: Optimization & Enhancement

For EACH phase, create 3-5 features, and for EACH feature create 3-5 sub-features.

## Phase 1: Foundation & Core Infrastructure
**Criteria:** Essential systems that the application cannot function without.

[ ] Feature 1: [Specific feature name related to foundation]
    - [ ] Sub-feature 1.1: [Specific implementation] (independent - no dependencies)
    - [ ] Sub-feature 1.2: [Specific implementation] (independent - no dependencies)
    - [ ] Sub-feature 1.3: [Specific implementation] (independent - no dependencies)

[ ] Feature 2: [Another foundation feature]
    - [ ] Sub-feature 2.1: [Specific task] (independent - no dependencies)
    - [ ] Sub-feature 2.2: [Specific task] (independent - no dependencies)

(Continue for all features in Phase 1)

## Phase 2: Data Management & Storage
**Criteria:** Systems for storing, retrieving, and managing application data.

[ ] Feature 1: [Data-related feature specific to this project]
    - [ ] Sub-feature 1.1: [Specific implementation] (independent - no dependencies)
    - [ ] Sub-feature 1.2: [Specific implementation] (independent - no dependencies)

(Continue this pattern for ALL 7 phases)

IMPORTANT REQUIREMENTS:
1. Make features SPECIFIC to the project "${prd.problem}"
2. Each sub-feature must be independently implementable (no dependencies between items)
3. Use the exact checkbox format: [ ] for unchecked, - [ ] for sub-items
4. Include "(independent - no dependencies)" note for each sub-feature
5. Be extremely detailed and specific - avoid generic terms
6. Each phase should have 3-5 features
7. Each feature should have 3-5 sub-features
8. Total items should be comprehensive (aim for 100+ total checkboxes across all phases)

Format as JSON array where each item represents a line of text with proper indentation:
[
  { "text": "## Phases Overview", "done": false },
  { "text": "- [ ] Phase 1: Foundation & Core Infrastructure", "done": false },
  { "text": "- [ ] Phase 2: Data Management & Storage", "done": false },
  { "text": "", "done": false },
  { "text": "## Phase 1: Foundation & Core Infrastructure", "done": false },
  { "text": "**Criteria:** Essential systems that the application cannot function without.", "done": false },
  { "text": "", "done": false },
  { "text": "[ ] Feature 1: Authentication System", "done": false },
  { "text": "    - [ ] Sub-feature 1.1: User registration (independent - no dependencies)", "done": false },
  { "text": "    - [ ] Sub-feature 1.2: User login (independent - no dependencies)", "done": false },
  ...
]

Generate a COMPLETE and DETAILED checklist for all 7 phases.`

  const response = await llm.invoke([
    new SystemMessage('You are an expert technical architect creating a comprehensive phase-based development checklist. Return only valid JSON array. Be extremely detailed and specific to the project. Include ALL 7 phases with multiple features and sub-features for each.'),
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

// Validate component specifications to prevent content duplication
function validateComponentSpecs(uiPlan: UIPlan): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  if (!uiPlan.component_specs || !Array.isArray(uiPlan.component_specs)) {
    return { valid: true, issues: [] }
  }
  
  // Check for overlapping responsibilities
  const responsibilities = uiPlan.component_specs.map(spec => spec.responsibility?.toLowerCase() || '')
  const duplicateResponsibilities = responsibilities.filter((resp, index) => 
    resp && responsibilities.indexOf(resp) !== index
  )
  
  if (duplicateResponsibilities.length > 0) {
    issues.push(`Duplicate responsibilities found: ${duplicateResponsibilities.join(', ')}`)
  }
  
  // Check for overlapping content
  const allContent = uiPlan.component_specs.flatMap(spec => 
    Array.isArray(spec.contains) ? spec.contains.map(c => c.toLowerCase()) : []
  )
  const duplicateContent = allContent.filter((content, index) => 
    allContent.indexOf(content) !== index
  )
  
  if (duplicateContent.length > 0) {
    issues.push(`Overlapping content detected: ${duplicateContent.join(', ')}. This may cause duplicate UI elements.`)
  }
  
  // Check for navigation/branding conflicts
  const navigationComponents = uiPlan.component_specs.filter(spec => 
    spec.name && (
      spec.name.toLowerCase().includes('navigation') || 
      spec.name.toLowerCase().includes('header')
    )
  )
  
  if (navigationComponents.length > 1) {
    const brandingComponents = navigationComponents.filter(comp => 
      Array.isArray(comp.contains) && comp.contains.some(content => 
        content.toLowerCase().includes('logo') || 
        content.toLowerCase().includes('brand')
      )
    )
    
    if (brandingComponents.length > 1) {
      issues.push(`Multiple components handling branding: ${brandingComponents.map(c => c.name).join(', ')}. This will cause duplicate headers.`)
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

// Generate UI plan for React application
async function generateUIPlan(projectIdea: ProjectIdea, prd: PRD): Promise<UIPlan> {
  // Ensure PRD has required properties
  if (!prd.goals || !Array.isArray(prd.goals)) {
    console.warn('PRD missing goals property, using empty array')
    prd.goals = []
  }
  
  const prompt = `
Based on this project, create a comprehensive UI plan for a REACT WEB APPLICATION:

Title: ${projectIdea.title}
Problem: ${prd.problem || 'Not specified'}
Goals: ${prd.goals.join(', ')}

Create a detailed plan that includes:

1. DESIGN SYSTEM:
   - Primary color palette (main brand color + supporting colors)
   - Typography hierarchy (headings, body text, captions)
   - Spacing scale (consistent padding/margins)
   - Component styling patterns

2. COMPONENT ARCHITECTURE:
   - List of specific React components needed with clear responsibilities
   - Content ownership (which component handles what content)
   - Component hierarchy (parent-child relationships)
   - Interaction patterns between components

3. LAYOUT STRUCTURE:
   - Overall page layout (header, main, sidebar, footer areas)
   - Content flow and organization
   - Responsive design considerations

CRITICAL REQUIREMENTS:
- Each component should have ONE clear responsibility
- Avoid content duplication between components
- Use descriptive component names (e.g., "TaskDashboard" not "Dashboard")
- Include components like Navigation, ContentArea, ActionPanel, etc. as needed
- DO NOT include "App" or "Main" as these are generated automatically

Example for a task management app:
{
  "design_system": {
    "primary_color": "blue",
    "accent_color": "green", 
    "background_color": "gray-50",
    "text_hierarchy": ["text-3xl font-bold", "text-xl font-semibold", "text-base"],
    "spacing_scale": ["p-2", "p-4", "p-6", "p-8"],
    "component_patterns": ["rounded-lg", "shadow-md", "border border-gray-200"]
  },
  "components": [
    {
      "name": "TaskNavigation",
      "responsibility": "Main navigation and app branding only",
      "contains": ["logo", "navigation menu", "user settings"]
    },
    {
      "name": "TaskSidebar", 
      "responsibility": "Project and filter navigation",
      "contains": ["project list", "filters", "views"]
    },
    {
      "name": "TaskWorkspace",
      "responsibility": "Main task display and editing area", 
      "contains": ["task list", "task details", "editing forms"]
    }
  ],
  "layout": {
    "structure": "dashboard with fixed navigation, collapsible sidebar, and main workspace",
    "content_areas": ["navigation: app branding", "sidebar: project navigation", "main: task management"],
    "interactions": ["sidebar toggle", "task creation", "task editing"]
  }
}

Format as JSON with this exact structure.
`

  const response = await llm.invoke([
    new SystemMessage('You are a UI/UX architect creating comprehensive design plans. Return only valid JSON. Ensure clear component responsibilities to avoid content duplication.'),
    new HumanMessage(prompt),
  ])

  const content = response.content as string
  console.log('UI Plan Generation - Raw AI response:', content.substring(0, 800) + '...')
  
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  
  const plan = JSON.parse(jsonMatch[0]) as any
  console.log('UI Plan Generation - Parsed JSON:', JSON.stringify(plan, null, 2))
  
  // Convert enhanced plan to current UIPlan format for compatibility with safety checks
  const uiPlan: UIPlan = {
    components: Array.isArray(plan.components?.map((c: any) => c.name)) ? plan.components.map((c: any) => c.name) : [],
    layout: plan.layout?.structure || 'dashboard layout',
    user_interactions: Array.isArray(plan.layout?.interactions) ? plan.layout.interactions : [],
    // Add enhanced properties with safety checks
    design_system: plan.design_system || {
      primary_color: 'blue',
      accent_color: 'green',
      background_color: 'gray-50',
      text_hierarchy: ['text-3xl font-bold', 'text-xl font-semibold', 'text-base'],
      spacing_scale: ['p-2', 'p-4', 'p-6', 'p-8'],
      component_patterns: ['rounded-lg', 'shadow-md', 'border border-gray-200']
    },
    component_specs: Array.isArray(plan.components) ? plan.components.map((c: any) => ({
      name: c.name || 'Component',
      responsibility: c.responsibility || 'Component functionality',
      contains: Array.isArray(c.contains) ? c.contains : []
    })) : [],
    layout_details: plan.layout || {
      structure: 'Standard layout',
      content_areas: [],
      interactions: []
    }
  }
  
  // Ensure all arrays are valid
  if (!Array.isArray(uiPlan.component_specs)) {
    uiPlan.component_specs = []
  }
  
  console.log('UI Plan Generation - Final UIPlan:', JSON.stringify(uiPlan, null, 2).substring(0, 500) + '...')
  
  // Validate component specifications to prevent content duplication
  const validation = validateComponentSpecs(uiPlan)
  if (!validation.valid) {
    console.warn('UI Plan validation issues detected:')
    validation.issues.forEach(issue => console.warn(`  - ${issue}`))
    
    // For now, log warnings but don't fail - we can improve this iteratively
    // In the future, we could regenerate the plan or provide specific fixes
  }
  
  return uiPlan
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
  retryAttempt: number = 0,
  uiPlan?: UIPlan,  // Add UI plan parameter for design system access
  uiGuidelines?: string  // Add UI guidelines parameter
): Promise<string> {
  // Extract design system information
  const designSystem = uiPlan?.design_system || {
    primary_color: 'blue',
    accent_color: 'green',
    background_color: 'gray-50',
    text_hierarchy: ['text-3xl font-bold', 'text-xl font-semibold', 'text-base'],
    spacing_scale: ['p-2', 'p-4', 'p-6', 'p-8'],
    component_patterns: ['rounded-lg', 'shadow-md', 'border border-gray-200']
  }
  
  // Find component specification
  const componentSpec = uiPlan?.component_specs?.find(spec => spec.name === componentName)
  
  // Generate contextual prompts based on component type
  const getComponentPrompt = () => {
    const baseStyles = `
DESIGN SYSTEM (use these consistently):
- Primary color: ${designSystem.primary_color} (bg-${designSystem.primary_color}-600, text-${designSystem.primary_color}-600, etc.)
- Accent color: ${designSystem.accent_color} (bg-${designSystem.accent_color}-500, text-${designSystem.accent_color}-500, etc.)  
- Background: ${designSystem.background_color}
- Text hierarchy: ${designSystem.text_hierarchy.join(', ')}
- Spacing: ${designSystem.spacing_scale.join(', ')}
- Component patterns: ${designSystem.component_patterns.join(', ')}

COMPONENT RESPONSIBILITY: ${componentSpec?.responsibility || 'Handle specific functionality for this component'}
COMPONENT SHOULD CONTAIN: ${componentSpec?.contains?.join(', ') || 'Content appropriate for this component type'}
`
    
    switch (componentType) {
      case 'navigation':
        return `Create a navigation/header component with:
${baseStyles}
- Brand/logo area (use ${designSystem.text_hierarchy[0]} for branding)
- Navigation items relevant to "${projectContext.title}" (use hover:text-${designSystem.primary_color}-600)
- Settings or preferences dropdown (NO user accounts)
- Responsive mobile design (hidden md:flex for desktop items)
- Styled with design system colors: bg-white shadow-md, proper spacing from design system
- Any search or action buttons that make sense for this app
- Include navigation links to relevant pages like:
  onClick: () => window.Router.navigate('about')
  onClick: () => window.Router.navigate('features')
  onClick: () => window.Router.navigate('settings')
  (Choose page names that make sense for "${projectContext.title}")
  
CRITICAL: This component should ONLY handle navigation and branding. Do NOT duplicate any main content that belongs in other components.`
      
      case 'sidebar':
        return `Create a sidebar navigation component with:
${baseStyles}
- Menu items relevant to "${projectContext.title}"
- Organized sections with proper spacing from design system
- Icons where appropriate (use emoji or unicode symbols)
- Active state handling (bg-${designSystem.primary_color}-50 text-${designSystem.primary_color}-700 for active)
- Styled with design system: w-64 bg-${designSystem.background_color} ${designSystem.spacing_scale[2]}, hover effects
- Proper visual hierarchy with ${designSystem.text_hierarchy[2]}, font-medium
- Include clickable navigation items like:
  onClick: () => window.Router.navigate('dashboard')
  onClick: () => window.Router.navigate('analytics')
  onClick: () => window.Router.navigate('reports')
  (Choose menu items that make sense for "${projectContext.title}")`
      
      case 'footer':
        return `Create a footer component with:
${baseStyles}
- Links relevant to "${projectContext.title}"
- Copyright information using design system colors
- Contact or support links
- Social media if appropriate
- Consistent spacing and typography from design system`
      
      case 'modal':
        return `Create a modal/dialog component with:
${baseStyles}
- Proper overlay background (fixed inset-0 bg-black bg-opacity-50)
- Modal container (bg-white ${designSystem.component_patterns.join(' ')})
- Close button (absolute top-2 right-2)
- Content area for "${projectContext.title}" functionality
- Action buttons styled with design system colors (bg-${designSystem.primary_color}-600 text-white hover:bg-${designSystem.primary_color}-700)
- MUST be hidden by default (useState(false))
- Centered positioning (flex items-center justify-center)
- Focus on feature-specific modals (settings, confirmation, detail views)
- NO authentication or login modals`
      
      case 'form':
        return `Create a form component with:
${baseStyles}
- Input fields relevant to "${projectContext.title}" (NO password fields)
- Form styling using design system (border ${designSystem.component_patterns.join(' ')} focus:outline-none focus:ring-2 focus:ring-${designSystem.primary_color}-500)
- Validation states (border-red-500 for errors, border-${designSystem.accent_color}-500 for success)
- Submit button (bg-${designSystem.primary_color}-600 text-white ${designSystem.spacing_scale[1]} ${designSystem.component_patterns.join(' ')} hover:bg-${designSystem.primary_color}-700)
- Clear labels (${designSystem.text_hierarchy[2]} font-medium text-gray-700) and helper text
- Proper spacing between form elements using design system
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
${baseStyles}
- Mock data relevant to "${projectContext.title}"
- Sorting/filtering if appropriate
- Styling consistent with design system
- Empty state handling
- Interactive elements using design system colors`
      
      case 'card':
        return `Create a card/widget component with:
${baseStyles}
- Content relevant to "${projectContext.title}"
- Visual hierarchy using design system typography
- Interactive elements if needed
- Consistent styling with design system patterns
- May include action buttons that navigate to detail pages:
  onClick: () => window.Router.navigate('details')
  onClick: () => window.Router.navigate('edit')
  (Use routes that make sense for the card's content)`
      
      case 'visualization':
        return `Create a data visualization component with:
${baseStyles}
- Mock data visualization for "${projectContext.title}"
- Use simple CSS/HTML (no external chart libraries)
- Clear labels and legends using design system typography
- Colors consistent with design system
- Interactive if appropriate`
      
      case 'container':
        return `Create the main container/app component that:
${baseStyles}
- Uses all other components: ${projectContext.otherComponents.join(', ')}
- Implements the layout: ${projectContext.layout || 'appropriate layout for the app'}
- Reference other components as window.ComponentName in React.createElement
- MUST be named exactly "App" (const App = ...)
- MUST end with: window.App = App;
- Use design system layout classes (min-h-screen, flex, grid, etc.)
- Apply design system background: bg-${designSystem.background_color}
- Ensure responsive design with proper breakpoints

CRITICAL SAFETY RULES:
- ALWAYS check if a component exists before using it
- Use this pattern: window.ComponentName ? React.createElement(window.ComponentName) : null
- Example: window.${projectContext.otherComponents[0] || 'Header'} ? React.createElement(window.${projectContext.otherComponents[0] || 'Header'}) : null
- This prevents "Element type is invalid" errors

CRITICAL COORDINATION RULES:
- Do NOT duplicate content that belongs in other components
- Navigation component handles: app branding, navigation menu, user actions
- Sidebar component handles: secondary navigation, filters, project lists  
- Content components handle: main functionality and data display
- The App component should ONLY coordinate layout and routing, not duplicate content

${uiPlan?.layout_details?.content_areas ? `
CONTENT AREA ASSIGNMENTS:
${uiPlan.layout_details.content_areas.map(area => `- ${area}`).join('\n')}
` : ''}

ROUTING SUPPORT:
- You can use window.Router.navigate('routeName') to change pages
- Use window.Router.getCurrentRoute() to get current route
- Use window.Router.onRouteChange(callback) to listen for route changes
- Use window.AppState.set(key, value) to store application state
- Use window.AppState.get(key) to retrieve application state
- The App component should ALWAYS render the appropriate layout based on current route
- For routes that don't have specific page components, show the default home layout

Example App with SAFE component references:
const App = () => {
  const [currentRoute, setCurrentRoute] = React.useState(window.Router.getCurrentRoute() || 'home');
  
  React.useEffect(() => {
    const unsubscribe = window.Router.onRouteChange((newRoute) => {
      setCurrentRoute(newRoute);
    });
    return unsubscribe;
  }, []);
  
  // Route to different page components (with safety checks)
  if (currentRoute === 'about' && window.AboutPage) {
    return React.createElement(window.AboutPage);
  } else if (currentRoute === 'settings' && window.SettingsPage) {
    return React.createElement(window.SettingsPage);
  }
  
  // Default home layout with SAFE component references
  return React.createElement('div', { className: 'min-h-screen bg-${designSystem.background_color}' },
    window.${projectContext.otherComponents[0]} ? React.createElement(window.${projectContext.otherComponents[0]}) : null,
    React.createElement('div', { className: 'flex flex-1' },
      window.${projectContext.otherComponents[1]} ? React.createElement(window.${projectContext.otherComponents[1]}) : null,
      React.createElement('main', { className: 'flex-1 p-6' },
        // Main content here
      )
    )
  );
};`
      
      // ... other component types with design system integration
      default:
        return `Create a ${componentName} component that:
${baseStyles}
- Serves its purpose in the "${projectContext.title}" application
- Follows the design system consistently
- Implements: ${componentSpec?.responsibility || 'appropriate functionality'}
- Contains: ${componentSpec?.contains?.join(', ') || 'relevant content'}
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
- CRITICAL: End with EXACT component name: window.${componentName} = ${componentName};
- The component function MUST be named EXACTLY: ${componentName}
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
const ${componentName} = () => {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => { ... }, []);
  return React.createElement('div', { className: 'bg-white p-6 rounded-lg shadow-md' }, ...);
};
React.createElement('button', { className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700' }, 'Click')
${componentType === 'container' ? `// Safe component reference:
window.${projectContext.otherComponents[0] || 'Header'} ? React.createElement(window.${projectContext.otherComponents[0] || 'Header'}) : null` : ''}
window.${componentName} = ${componentName}; // EXACT name match
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

  // Include UI guidelines in the system message if available
  const enhancedSystemMessage = uiGuidelines 
    ? `${systemMessage}\n\n=== UI BUILD GUIDELINES ===\n${uiGuidelines}\n\nFOLLOW THESE GUIDELINES EXACTLY when generating the component.`
    : systemMessage
  
  const response = await codeLLM.invoke([
    new SystemMessage(enhancedSystemMessage),
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
  
  // Safety check for uiPlan and components array
  if (!uiPlan || !uiPlan.components || !Array.isArray(uiPlan.components)) {
    console.warn('No valid components found in UI plan, using defaults')
    // Return some default components
    return [
      { name: 'Header', type: 'navigation' },
      { name: 'MainContent', type: 'generic' },
      { name: 'Footer', type: 'footer' }
    ]
  }
  
  // Filter out the App component as we'll generate it separately
  // ALSO filter out auth-related components
  const componentNames = uiPlan.components.filter(name => {
    if (typeof name !== 'string') {
      console.warn('Invalid component name:', name)
      return false
    }
    
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
  
  // If no components after filtering, add defaults
  if (componentsToGenerate.length === 0) {
    console.warn('No components to generate after filtering, using defaults')
    return [
      { name: 'Header', type: 'navigation' },
      { name: 'MainContent', type: 'generic' },
      { name: 'Footer', type: 'footer' }
    ]
  }
  
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
    // AND skip dynamic routes with template literals or variables
    if (route && 
        route !== 'home' && 
        route !== '/' && 
        !isAuthRelatedComponent(route) &&
        !route.includes('${') && // Skip template literals
        !route.includes('/') &&   // Skip nested routes for now
        /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(route)) { // Only allow simple route names
      routes.add(route)
    }
  }
  
  // Also check for route references in conditional rendering
  const routeCheckPattern = /getCurrentRoute\s*\(\s*\)\s*===\s*['"`]([^'"`]+)['"`]/g
  while ((match = routeCheckPattern.exec(code)) !== null) {
    const route = match[1]
    if (route && 
        route !== 'home' && 
        route !== '/' && 
        !isAuthRelatedComponent(route) &&
        !route.includes('${') && // Skip template literals
        !route.includes('/') &&   // Skip nested routes for now
        /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(route)) { // Only allow simple route names
      routes.add(route)
    }
  }
  
  // Log what routes we found for debugging
  console.log('Extracted valid routes:', Array.from(routes))
  
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
  // Sanitize route name - remove any dynamic parts or invalid characters
  const sanitizedRoute = routeName
    .replace(/\$\{[^}]+\}/g, '') // Remove template literals
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove invalid characters
    .toLowerCase()
  
  if (!sanitizedRoute) {
    throw new Error(`Invalid route name: ${routeName}`)
  }
  
  // Convert route name to component name (e.g., 'profile' -> 'ProfilePage')
  const componentName = sanitizedRoute.charAt(0).toUpperCase() + sanitizedRoute.slice(1) + 'Page'
  
  console.log(`Generating page component: ${componentName} for route: ${sanitizedRoute}`)

  const prompt = `Create a React page component for the "${sanitizedRoute}" route in the "${projectContext.title}" application.

This is a full page component that will be shown when the user navigates to the "${sanitizedRoute}" route.
The application already has these components: ${projectContext.existingComponents.join(', ')}

Requirements:
- Create a complete page layout with relevant content for "${sanitizedRoute}"
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

// Generate multiple UI files for the application
async function generateUIFiles(projectIdea: ProjectIdea, uiPlan: UIPlan, onProgress?: ProgressCallback, uiGuidelines?: string): Promise<{
  files: UIFile[];
  validationIssues: FileValidationIssues[];
}> {
  const files: UIFile[] = []
  const allValidationIssues: FileValidationIssues[] = []
  
  // Send parent node progress
  onProgress?.('UIGenerationNode', 'in-progress', 'Generating UI components...', true)
  
  // Analyze components needed
  const componentsToGenerate = analyzeComponentsNeeded(uiPlan)
  
  // Track route references across components
  const allRouteReferences = new Set<string>()
  
  // Generate non-auth components
  const nonAuthComponents = componentsToGenerate.filter(comp => !isAuthRelatedComponent(comp.name))
  
  // Generate components with retry logic
  for (const comp of nonAuthComponents) {
    let attempts = 0
    const maxAttempts = 2
    let componentGenerated = false
    
    // Send progress for this specific component
    onProgress?.(comp.name, 'in-progress', `Generating ${comp.name}...`, false, 'UIGenerationNode')
    
    while (attempts < maxAttempts && !componentGenerated) {
      try {
        console.log(`Generating component: ${comp.name} (attempt ${attempts + 1})`)
        const componentCode = await generateComponentFile(
          comp.name,
          comp.type,
          { 
            title: projectIdea.title, 
            description: projectIdea.description,
            otherComponents: componentsToGenerate.filter(c => c.name !== comp.name).map(c => c.name),
            layout: uiPlan.layout,
            interactions: uiPlan.user_interactions
          },
          attempts,
          uiPlan,  // Pass UI plan for design system access
          uiGuidelines  // Pass UI guidelines
        )
        
        // Clean auth artifacts if any slipped through
        const cleanedCode = cleanAuthArtifacts(componentCode, comp.name)
        
        // Validate the generated code
        const validation = validateGeneratedCode(cleanedCode, comp.name)
        if (!validation.valid && validation.issues.length > 0) {
          console.warn(`Validation issues for ${comp.name}:`, validation.issues)
          allValidationIssues.push({
            filename: `${comp.name}.js`,  // Changed from .tsx to .js
            componentName: comp.name,
            issues: validation.issues
          })
        }
        
        // Extract route references
        const routeRefs = extractRouteReferences(cleanedCode)
        routeRefs.forEach(route => allRouteReferences.add(route))
        
        files.push({
          filename: `${comp.name}.js`,  // Changed from .tsx to .js
          content: cleanedCode,
          type: comp.type as UIFile['type']
        })
        
        componentGenerated = true
        
        // Mark component as complete
        onProgress?.(comp.name, 'success', undefined, false, 'UIGenerationNode')
      } catch (error) {
        console.error(`Error generating ${comp.name}:`, error)
        attempts++
        if (attempts >= maxAttempts) {
          onProgress?.(comp.name, 'error', `Failed to generate`, false, 'UIGenerationNode')
          throw new Error(`Failed to generate ${comp.name} after ${maxAttempts} attempts`)
        }
      }
    }
  }
  
  // Generate route/page components if needed
  if (allRouteReferences.size > 0) {
    console.log('Generating pages for routes:', Array.from(allRouteReferences))
    for (const route of allRouteReferences) {
      try {
        // Skip invalid routes
        if (route.includes('${') || route.includes('/') || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(route)) {
          console.warn(`Skipping invalid route: ${route}`)
          continue
        }
        
        const pageName = `${route.charAt(0).toUpperCase() + route.slice(1)}Page`
        onProgress?.(pageName, 'in-progress', `Generating ${pageName}...`, false, 'UIGenerationNode')
        
        const pageComponent = await generatePageComponent(route, {
          title: projectIdea.title,
          description: projectIdea.description,
          existingComponents: files.map(f => f.filename.replace('.js', ''))
        })
      
      files.push({
          filename: pageComponent.name + '.js',
          content: pageComponent.content,
          type: 'page'
        })
        
        onProgress?.(pageName, 'success', undefined, false, 'UIGenerationNode')
      } catch (error) {
        console.error(`Error generating page for route ${route}:`, error)
        onProgress?.(route, 'error', `Failed to generate page`, false, 'UIGenerationNode')
        // Continue with other pages instead of failing the entire generation
      }
    }
  }
  
  // Generate the main App.tsx file
  onProgress?.('App', 'in-progress', 'Generating App.tsx...', false, 'UIGenerationNode')
  console.log('Generating App.tsx...')
  
  // Generate App component using the existing component files
  const componentFiles = files.filter(f => 
    f.type === 'component' || 
    (f.filename.includes('Header') || f.filename.includes('Navigation') || f.filename.includes('Sidebar'))
  )
  
  // Extract exact component names from generated files
  const exactComponentNames = componentFiles.map(f => f.filename.replace('.js', ''))
  console.log('App will reference these exact components:', exactComponentNames)
  
  const appContent = await generateComponentFile(
      'App',
      'container',
      { 
        title: projectIdea.title, 
        description: projectIdea.description,
      otherComponents: exactComponentNames,  // Use exact names
        layout: uiPlan.layout,
        interactions: uiPlan.user_interactions
      },
    0,
    uiPlan,  // Pass UI plan for design system access
    uiGuidelines  // Pass UI guidelines
  )
  
  // Update App with routing if needed
  const finalAppContent = allRouteReferences.size > 0 
    ? updateAppWithRouting(appContent, Array.from(allRouteReferences))
    : appContent
  
  // Validate App component
  const appValidation = validateGeneratedCode(finalAppContent, 'App')
  if (!appValidation.valid && appValidation.issues.length > 0) {
    console.warn('App.js validation issues:', appValidation.issues)
    allValidationIssues.push({
      filename: 'App.js',  // Changed from App.tsx to App.js
      componentName: 'App',
      issues: appValidation.issues
    })
  }
  
  files.push({
    filename: 'App.js',  // Changed from App.tsx to App.js
    content: finalAppContent,
    type: 'main'
  })
  
  onProgress?.('App', 'success', undefined, false, 'UIGenerationNode')
  
  // Create a component manifest for debugging
  const componentManifest = `// Component Manifest - Lists all available components
// This file helps debug "Element type is invalid" errors

const availableComponents = {
${exactComponentNames.map(name => `  ${name}: typeof window.${name} !== 'undefined' ? '✓' : '✗'`).join(',\n')}
};

console.log('=== Loadout Component Manifest ===');
console.log('Available components:', availableComponents);
${exactComponentNames.map(name => `console.log('window.${name}:', typeof window.${name});`).join('\n')}

// Helper to safely render components
window.safeRender = (componentName) => {
  const Component = window[componentName];
  if (Component) {
    return React.createElement(Component);
  } else {
    console.warn(\`Component "\${componentName}" not found on window object\`);
    return React.createElement('div', { className: 'p-4 bg-red-100 text-red-700 rounded' }, 
      \`Missing component: \${componentName}\`
    );
  }
};
`;

  files.push({
    filename: '_ComponentManifest.js',
    content: componentManifest,
    type: 'utils' as UIFile['type']
  })
  
  // Create a setup file that loads components in the correct order
  const setupContent = `// Setup file - Load this BEFORE your app to ensure all components are available

// Mock Router for navigation
window.Router = {
  currentRoute: 'home',
  listeners: [],
  navigate: function(route) {
    console.log('Navigating to:', route);
    this.currentRoute = route;
    this.listeners.forEach(listener => listener(route));
  },
  getCurrentRoute: function() {
    return this.currentRoute;
  },
  onRouteChange: function(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
};

// Mock AppState for global state management
window.AppState = {
  state: {},
  set: function(key, value) {
    this.state[key] = value;
    console.log('AppState updated:', key, '=', value);
  },
  get: function(key) {
    return this.state[key];
  }
};

// Component loading order (components first, then App)
const componentLoadOrder = [
${files.filter(f => f.type !== 'main' && f.filename !== '_ComponentManifest.js').map(f => `  '${f.filename}'`).join(',\n')},
  'App.js'  // App must be loaded last (changed from App.tsx)
];

console.log('=== Loadout Setup ===');
console.log('Components will be loaded in this order:', componentLoadOrder);
console.log('Make sure to include all component files in your HTML in this order');
`;

  files.push({
    filename: '_setup.js',
    content: setupContent,
    type: 'utils' as UIFile['type']
  })
  
  // Create an index.html template that shows proper loading order
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectIdea.title}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  
  <!-- Load setup first -->
  <script src="_setup.js"></script>
  
  <!-- Load components in order (components before App) -->
${files.filter(f => f.type === 'component' && !f.filename.startsWith('_')).map(f => `  <script src="${f.filename}"></script>`).join('\n')}
  
  <!-- Load page components -->
${files.filter(f => f.type === 'page' && !f.filename.startsWith('_')).map(f => `  <script src="${f.filename}"></script>`).join('\n')}
  
  <!-- Load App last -->
  <script src="App.js"></script>
  
  <!-- Load component manifest for debugging -->
  <script src="_ComponentManifest.js"></script>
  
  <!-- Mount the app -->
  <script>
    // Wait for all scripts to load
    window.addEventListener('load', () => {
      console.log('=== Mounting React App ===');
      console.log('App component:', typeof window.App);
      
      if (window.App) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(window.App));
      } else {
        console.error('App component not found! Make sure App.js loaded correctly.');
        document.getElementById('root').innerHTML = '<div style="padding: 20px; color: red;">Error: App component not found. Check console for details.</div>';
      }
    });
  </script>
</body>
</html>`;

  files.push({
    filename: 'index.html',
    content: htmlTemplate,
    type: 'utils' as UIFile['type']
  })
  
  // Add the UI guidelines as a file if available
  if (uiGuidelines) {
    files.push({
      filename: 'UI_BUILD_GUIDE.md',
      content: uiGuidelines,
      type: 'utils' as UIFile['type']
    })
  }
  
  console.log('UI files generation complete:', files.length, 'files')
  console.log('Validation issues:', allValidationIssues.length, 'files with issues')
  
  // Update parent node status
  onProgress?.('UIGenerationNode', 'success', `Generated ${files.length} files`)
  
  return { files, validationIssues: allValidationIssues }
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

// Generate implementation checklist based on actual files
async function generateImplementationChecklistNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    if (!state.uiFiles || state.uiFiles.length === 0) {
      console.warn('No UI files generated, skipping implementation checklist')
      return {}
    }
    
    state.onProgress?.('ImplementationChecklistNode', 'in-progress', 'Updating checklist with implementation details...')
    
    // Create implementation items based on actual files
    const implementationItems: ChecklistItem[] = []
    
    // Add header for implementation section
    implementationItems.push({
      id: nanoid(),
      text: '',
      done: false
    })
    implementationItems.push({
      id: nanoid(),
      text: '## Implementation Files Generated',
      done: false
    })
    implementationItems.push({
      id: nanoid(),
      text: '**Actual files created by Loadout:**',
      done: false
    })
    implementationItems.push({
      id: nanoid(),
      text: '',
      done: false
    })
    
    // Add component files
    const componentFiles = state.uiFiles.filter(f => f.type === 'component')
    if (componentFiles.length > 0) {
      implementationItems.push({
        id: nanoid(),
        text: '### Component Files',
        done: false
      })
      
      componentFiles.forEach(file => {
        const componentName = file.filename.replace('.js', '')
        const componentSpec = state.uiPlan?.component_specs?.find(spec => spec.name === componentName)
        
        implementationItems.push({
          id: nanoid(),
          text: `[ ] ${file.filename} - ${componentSpec?.responsibility || 'Component implementation'}`,
          done: true  // Mark as done since it's generated
        })
        
        if (componentSpec?.contains) {
          componentSpec.contains.forEach(content => {
            implementationItems.push({
              id: nanoid(),
              text: `    - [ ] ${content}`,
              done: true
            })
          })
        }
      })
    }
    
    // Add page files
    const pageFiles = state.uiFiles.filter(f => f.type === 'page')
    if (pageFiles.length > 0) {
      implementationItems.push({
        id: nanoid(),
        text: '',
        done: false
      })
      implementationItems.push({
        id: nanoid(),
        text: '### Page Components',
        done: false
      })
      
      pageFiles.forEach(file => {
        implementationItems.push({
          id: nanoid(),
          text: `[ ] ${file.filename} - Route page implementation`,
          done: true
        })
      })
    }
    
    // Add main files
    implementationItems.push({
      id: nanoid(),
      text: '',
      done: false
    })
    implementationItems.push({
      id: nanoid(),
      text: '### Core Files',
      done: false
    })
    
    const mainFiles = state.uiFiles.filter(f => f.type === 'main' || f.type === 'utils')
    mainFiles.forEach(file => {
      let description = ''
      if (file.filename === 'App.js') {
        description = 'Main application component that coordinates all other components'
      } else if (file.filename === 'index.html') {
        description = 'HTML template with proper script loading order'
      } else if (file.filename === '_setup.js') {
        description = 'Setup file with mock Router and AppState utilities'
      } else if (file.filename === '_ComponentManifest.js') {
        description = 'Debug helper to verify component loading'
      } else {
        description = 'Supporting file'
      }
      
      implementationItems.push({
        id: nanoid(),
        text: `[ ] ${file.filename} - ${description}`,
        done: true
      })
    })
    
    // Add validation issues if any
    if (state.validationIssues && state.validationIssues.length > 0) {
      implementationItems.push({
        id: nanoid(),
        text: '',
        done: false
      })
      implementationItems.push({
        id: nanoid(),
        text: '### Validation Notes',
        done: false
      })
      
      state.validationIssues.forEach(issue => {
        implementationItems.push({
          id: nanoid(),
          text: `[ ] Fix validation issues in ${issue.filename} (${issue.issues.length} issues)`,
          done: false
        })
      })
    }
    
    // Merge with existing checklist
    const updatedChecklist = [...(state.checklist || []), ...implementationItems]
    
    state.onProgress?.('ImplementationChecklistNode', 'success')
    return { checklist: updatedChecklist }
  } catch (error) {
    console.error('Failed to generate implementation checklist:', error)
    state.onProgress?.('ImplementationChecklistNode', 'error', 'Failed to update checklist')
    // Non-critical, don't propagate error
    return {}
  }
}

// ... existing code ... 

// Generate UI Build Guidelines document
function generateUIBuildGuidelines(projectIdea: ProjectIdea, uiPlan: UIPlan): string {
  try {
    const { design_system, component_specs, layout_details } = uiPlan || {}
    
    // Extract component names and their types with safety checks
    const components = analyzeComponentsNeeded(uiPlan) || []
    const nonAuthComponents = components.filter(comp => !isAuthRelatedComponent(comp.name)) || []
    
    // Safe filtering functions with fallbacks
    const navigationComponents = nonAuthComponents.filter(c => c.type === 'navigation') || []
    const sidebarComponents = nonAuthComponents.filter(c => c.type === 'sidebar') || []
    const otherComponents = nonAuthComponents.filter(c => c.type !== 'navigation' && c.type !== 'sidebar') || []
    
    const guidelines = `# ${projectIdea.title} — UI Build Guide

This doc is a precise, ordered checklist for generating UI components. Follow each step exactly as specified.

⸻

## 0 · Project Structure

\`\`\`
src/
├─ components/
${navigationComponents.length > 0 ? navigationComponents.map(c => `│  ├─ ${c.name}.js`).join('\n') : '│  ├─ Header.js'}
${sidebarComponents.length > 0 ? sidebarComponents.map(c => `│  ├─ ${c.name}.js`).join('\n') : ''}
${otherComponents.length > 0 ? otherComponents.map(c => `│  ├─ ${c.name}.js`).join('\n') : '│  ├─ MainContent.js'}
├─ App.js
├─ index.html
├─ _setup.js
└─ _ComponentManifest.js
\`\`\`

**Why**: Clear separation of components, with App.js as the main coordinator.

⸻

## 1 · Design System Tokens

**Colors**:
- Primary: \`${design_system?.primary_color || 'blue'}\` (bg-${design_system?.primary_color || 'blue'}-600, hover:bg-${design_system?.primary_color || 'blue'}-700)
- Accent: \`${design_system?.accent_color || 'green'}\` (bg-${design_system?.accent_color || 'green'}-500)
- Background: \`${design_system?.background_color || 'gray-50'}\`
- Surface: \`bg-white dark:bg-gray-800\`
- Border: \`border-gray-200 dark:border-gray-700\`

**Typography**:
${design_system?.text_hierarchy && Array.isArray(design_system.text_hierarchy) 
  ? design_system.text_hierarchy.map((style, i) => `- Heading ${i + 1}: \`${style}\``).join('\n') 
  : '- Heading 1: `text-3xl font-bold`\n- Heading 2: `text-xl font-semibold`\n- Body: `text-base`'}

**Spacing**:
${design_system?.spacing_scale && Array.isArray(design_system.spacing_scale)
  ? design_system.spacing_scale.map(space => `- \`${space}\``).join('\n') 
  : '- `p-2`, `p-4`, `p-6`, `p-8`'}

**Component Patterns**:
${design_system?.component_patterns && Array.isArray(design_system.component_patterns)
  ? design_system.component_patterns.map(pattern => `- \`${pattern}\``).join('\n') 
  : '- `rounded-lg`\n- `shadow-md`\n- `border border-gray-200`'}

⸻

## 2 · Component Specifications

${component_specs && Array.isArray(component_specs) && component_specs.length > 0
  ? component_specs.map((spec, index) => {
      const contains = Array.isArray(spec.contains) ? spec.contains : []
      return `### 2.${index + 1} ${spec.name || 'Unknown Component'}

**File**: \`${spec.name || 'Unknown'}.js\`
**Responsibility**: ${spec.responsibility || 'Component functionality'}
**Must contain**:
${contains.length > 0 ? contains.map(item => `- ${item}`).join('\n') : '- Component implementation'}

**Styling requirements**:
${getComponentStylingRequirements(spec.name || '', design_system)}

**Interaction requirements**:
${getComponentInteractions(spec.name || '', layout_details)}
`}).join('\n') 
  : '### No component specifications available.\n\nDefault components will be generated based on the project requirements.'}

⸻

## 3 · Layout Structure

**Overall Layout**: ${layout_details?.structure || 'Standard web application layout'}

**Content Areas**:
${layout_details?.content_areas && Array.isArray(layout_details.content_areas)
  ? layout_details.content_areas.map(area => `- ${area}`).join('\n') 
  : '- Header: Navigation and branding\n- Main: Primary content area\n- Sidebar: Secondary navigation (if applicable)'}

**Key Interactions**:
${layout_details?.interactions && Array.isArray(layout_details.interactions)
  ? layout_details.interactions.map(interaction => `- ${interaction}`).join('\n') 
  : '- Standard web interactions'}

⸻

## 4 · Component Coordination Rules

**CRITICAL**: Each component must stay within its defined responsibility to avoid duplication.

${component_specs && Array.isArray(component_specs) && component_specs.length > 0
  ? component_specs.map(spec => `- **${spec.name || 'Component'}**: ONLY handles ${(spec.responsibility || 'its designated functionality').toLowerCase()}. Never duplicates content from other components.`).join('\n') 
  : '- Each component should have a single, clear responsibility'}

**App.js Coordination**:
- Must reference components as \`window.ComponentName\`
- Always check existence: \`window.ComponentName ? React.createElement(window.ComponentName) : null\`
- Layout structure must match section 3 specifications

⸻

## 5 · Implementation Checklist

### Component Generation Order:
${nonAuthComponents.length > 0 
  ? nonAuthComponents.map((comp, i) => `${i + 1}. [ ] Generate ${comp.name} (${comp.type})`).join('\n')
  : '1. [ ] Generate Header (navigation)\n2. [ ] Generate MainContent (content)\n3. [ ] Generate Footer (footer)'}
${nonAuthComponents.length + 1}. [ ] Generate App.js (main coordinator)
${nonAuthComponents.length + 2}. [ ] Generate supporting files (_setup.js, _ComponentManifest.js, index.html)

### Validation Checks:
- [ ] No content duplication between components
- [ ] All components follow their assigned responsibilities  
- [ ] Design system tokens used consistently
- [ ] All interactive elements have proper handlers
- [ ] App.js safely references all components
- [ ] Component loading order is correct in index.html

⸻

## 6 · Code Generation Rules

1. **Use React.createElement() exclusively** - no JSX
2. **End each component with**: \`window.ComponentName = ComponentName;\`
3. **No imports** - React is globally available
4. **Mock data** should be realistic and relevant to "${projectIdea.title}"
5. **State management**: Use React.useState for local state
6. **Navigation**: Use \`window.Router.navigate('routeName')\`
7. **Global state**: Use \`window.AppState.get/set('key', value)\`

⸻

## 7 · Common Patterns

### Navigation Links:
\`\`\`javascript
React.createElement('button', {
  className: 'hover:text-${design_system?.primary_color || 'blue'}-600 cursor-pointer',
  onClick: () => window.Router.navigate('about')
}, 'About')
\`\`\`

### Form Submission:
\`\`\`javascript
const handleSubmit = (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  // Process data
  window.AppState.set('formData', data);
};
\`\`\`

### Conditional Rendering:
\`\`\`javascript
showModal && React.createElement(ModalComponent)
\`\`\`

⸻

When all items are checked, the UI implementation is complete and ready for testing.`

    return guidelines
  } catch (error) {
    console.error('Error generating UI build guidelines:', error)
    // Return a minimal guideline document as fallback
    return `# ${projectIdea.title} — UI Build Guide

## Error Generating Guidelines

An error occurred while generating the UI build guidelines. The UI components will still be generated based on the project requirements.

## Basic Structure

- Components will be generated based on the project needs
- Each component will use React.createElement() syntax
- All components will be registered on the window object
- Tailwind CSS will be used for styling

## Next Steps

1. Generate UI components based on the project description
2. Create App.js to coordinate all components
3. Test the preview in the browser`
  }
}

// Helper function to get component styling requirements
function getComponentStylingRequirements(componentName: string, designSystem: any): string {
  const name = componentName.toLowerCase()
  const ds = designSystem || {}
  
  if (name.includes('navigation') || name.includes('header')) {
    return `- Fixed/sticky positioning: \`sticky top-0 z-50\`
- Background: \`bg-white dark:bg-gray-900 shadow-md\`
- Height: \`h-16\` or \`h-20\`
- Padding: \`${ds.spacing_scale?.[2] || 'px-6 py-4'}\`
- Flex layout: \`flex items-center justify-between\``
  } else if (name.includes('sidebar')) {
    return `- Width: \`w-64\` or \`w-72\`
- Background: \`${ds.background_color ? `bg-${ds.background_color}` : 'bg-gray-50'} dark:bg-gray-900\`
- Full height: \`h-full\` or \`min-h-screen\`
- Padding: \`${ds.spacing_scale?.[2] || 'p-4'}\`
- Overflow: \`overflow-y-auto\``
  } else if (name.includes('modal')) {
    return `- Overlay: \`fixed inset-0 bg-black bg-opacity-50 z-50\`
- Modal container: \`bg-white dark:bg-gray-800 ${ds.component_patterns?.join(' ') || 'rounded-lg shadow-xl'}\`
- Centering: \`flex items-center justify-center\`
- Max width: \`max-w-lg w-full mx-4\`
- Hidden by default: \`useState(false)\``
  } else if (name.includes('form')) {
    return `- Input styling: \`border ${ds.component_patterns?.filter((p: string) => p.includes('rounded')).join(' ') || 'rounded'} px-3 py-2\`
- Focus states: \`focus:outline-none focus:ring-2 focus:ring-${ds.primary_color || 'blue'}-500\`
- Label styling: \`${ds.text_hierarchy?.[2] || 'text-sm'} font-medium text-gray-700\`
- Button styling: \`bg-${ds.primary_color || 'blue'}-600 text-white ${ds.component_patterns?.join(' ') || 'rounded-lg'} hover:bg-${ds.primary_color || 'blue'}-700\`
- Form spacing: \`space-y-4\``
  } else {
    return `- Container styling: \`${ds.component_patterns?.join(' ') || 'rounded-lg shadow-md'}\`
- Background: \`bg-white dark:bg-gray-800\`
- Padding: \`${ds.spacing_scale?.[2] || 'p-4'}\`
- Text color: \`text-gray-900 dark:text-gray-100\`
- Interactive elements: \`hover:bg-gray-100 dark:hover:bg-gray-700\``
  }
}

// Helper function to get component interactions
function getComponentInteractions(componentName: string, layoutDetails: any): string {
  const name = componentName.toLowerCase()
  const interactions = layoutDetails?.interactions || []
  
  if (name.includes('navigation') || name.includes('header')) {
    return `- Logo/brand clicks navigate to home
- Menu items use \`window.Router.navigate()\`
- Mobile menu toggle (if responsive)
- Active state indication for current route`
  } else if (name.includes('sidebar')) {
    return `- Menu item clicks navigate to sections
- Active item highlighting
- Collapsible sections (if applicable)
- Hover states on all interactive elements`
  } else if (name.includes('modal')) {
    return `- Close button (X) in top-right
- Click outside to close (optional)
- ESC key to close (optional)
- Form submission or action buttons`
  } else if (name.includes('form')) {
    return `- Form validation on submit
- Clear error states
- Loading states during submission
- Success feedback after submission`
  } else {
    // Extract relevant interactions for this component
    const relevantInteractions = interactions.filter((i: string) => 
      i.toLowerCase().includes(componentName.toLowerCase()) ||
      i.toLowerCase().includes('all') ||
      i.toLowerCase().includes('general')
    )
    
    if (relevantInteractions.length > 0) {
      return relevantInteractions.map((i: string) => `- ${i}`).join('\n')
    }
    
    return `- Standard click handlers for buttons
- Hover states for interactive elements
- Appropriate cursor styles
- Focus states for accessibility`
  }
}

// ... existing code ...