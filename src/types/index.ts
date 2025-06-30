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
}

export type UIStrategy = 'v0' | 'gpt';

export interface V0Prompt {
  sections: Array<{
    type: string;
    content: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ProjectFiles {
  idea: string;
  prd: PRD;
  checklist: ChecklistItem[];
  brainlift?: BrainliftLog;
  uiPlan: UIPlan;
  uiStrategy: UIStrategy;
  v0Prompt?: V0Prompt;
  uiCode?: string;
  chatHistory?: ChatMessage[];
} 