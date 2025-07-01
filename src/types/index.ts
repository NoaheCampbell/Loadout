export interface ProjectIdea {
  title: string;
  description: string;
}

export interface PRD {
  problem: string;
  goals: string[];
  scope: string;
  constraints: string[];
  success_criteria: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface BrainliftLog {
  assumptions: string[];
  decisions: string[];
  contextLinks: string[];
}

export interface UIPlan {
  components: string[];
  layout: string;
  user_interactions: string[];
  design_system?: {
    primary_color: string;
    accent_color: string;
    background_color: string;
    text_hierarchy: string[];
    spacing_scale: string[];
    component_patterns: string[];
  };
  component_specs?: Array<{
    name: string;
    responsibility: string;
    contains: string[];
  }>;
  layout_details?: {
    structure: string;
    content_areas: string[];
    interactions: string[];
  };
}

export interface Project {
  id: string;
  title: string;
  created: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  path: string;
}

export type NodeStatus = 'pending' | 'in-progress' | 'success' | 'error';

export interface GenerationProgress {
  node: string;
  status: NodeStatus;
  message?: string;
  isParent?: boolean;
  parentNode?: string;
  isExpanded?: boolean;
}

export type UIStrategy = 'v0' | 'gpt';

export interface V0Prompt {
  sections: Array<{
    type: string;
    content: string;
  }>;
}

export interface UIFile {
  filename: string;
  content: string;
  type: 'component' | 'style' | 'utils' | 'main' | 'page';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UIValidationIssue {
  type: string;
  message: string;
  line?: number;
  context?: string;
}

export interface FileValidationIssues {
  filename: string;
  componentName: string;
  issues: UIValidationIssue[];
}

export interface ProjectFiles {
  idea: string;
  prd: PRD;
  checklist: ChecklistItem[];
  brainlift?: BrainliftLog;
  uiPlan: UIPlan;
  uiStrategy: UIStrategy;
  v0Prompt?: V0Prompt;
  uiCode?: string;  // Legacy: single file
  uiFiles?: UIFile[];  // New: multiple files
  uiValidationIssues?: FileValidationIssues[];  // Validation issues for problematic files
  chatHistory?: ChatMessage[];
} 