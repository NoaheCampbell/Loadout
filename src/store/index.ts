import { create } from 'zustand';
import { Project, GenerationProgress, ProjectFiles } from '../types';

interface AppState {
  // Projects
  projects: Project[];
  selectedProjectId: string | null;
  currentProjectData: ProjectFiles | null;
  
  // Generation state
  isGenerating: boolean;
  generationProgress: GenerationProgress[];
  currentTab: 'idea' | 'prd' | 'checklist' | 'ui' | 'workflow';
  
  // UI state
  uiViewMode: 'preview' | 'code';
  theme: 'light' | 'dark';
  
  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (projectId: string | null) => void;
  setProjectData: (data: ProjectFiles | null) => void;
  deleteProject: (projectId: string) => void;
  setGenerating: (isGenerating: boolean) => void;
  addProgress: (progress: GenerationProgress) => void;
  clearProgress: () => void;
  setCurrentTab: (tab: AppState['currentTab']) => void;
  setUiViewMode: (mode: 'preview' | 'code') => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  projects: [],
  selectedProjectId: null,
  currentProjectData: null,
  isGenerating: false,
  generationProgress: [],
  currentTab: 'idea',
  uiViewMode: 'preview',
  theme: 'dark',
  
  // Actions
  setProjects: (projects) => set({ projects }),
  selectProject: (projectId) => set({ selectedProjectId: projectId }),
  setProjectData: (data) => set({ currentProjectData: data }),
  deleteProject: (projectId) => set((state) => ({
    projects: state.projects.filter(p => p.id !== projectId),
    selectedProjectId: state.selectedProjectId === projectId ? null : state.selectedProjectId,
    currentProjectData: state.selectedProjectId === projectId ? null : state.currentProjectData,
  })),
  setGenerating: (isGenerating) => set((state) => {
    if (isGenerating) {
      // Initialize all main workflow nodes as pending when starting generation
      const mainNodes = [
        'IdeaInputNode',
        'PRDGeneratorNode', 
        'ChecklistGeneratorNode',
        'BrainliftNode',
        'UIPlannerNode',
        'UIStrategyDecisionNode',
        'UIGenerationNode',
        'saveProject'
      ]
      
      const initialProgress = mainNodes.map(node => ({
        node,
        status: 'pending' as const,
        isParent: node === 'UIGenerationNode'
      }))
      
      return { isGenerating, generationProgress: initialProgress }
    }
    return { isGenerating }
  }),
  addProgress: (progress) => set((state) => {
    console.log('Progress update:', progress);
    
    // Find if this node already exists in progress
    const existingIndex = state.generationProgress.findIndex(p => p.node === progress.node);
    
    if (existingIndex >= 0) {
      // Update existing progress
      const updated = [...state.generationProgress];
      updated[existingIndex] = { ...updated[existingIndex], ...progress };
      return { generationProgress: updated };
    } else {
      // Add new progress
      // If this is a UI generation child node, make sure parent exists
      if (progress.parentNode === 'UIGenerationNode' && !state.generationProgress.find(p => p.node === 'UIGenerationNode')) {
        return {
          generationProgress: [
            ...state.generationProgress,
            {
              node: 'UIGenerationNode',
              status: 'in-progress',
              message: 'Generating UI components...',
              isParent: true,
              isExpanded: true
            },
            progress
          ]
        };
      }
      return { generationProgress: [...state.generationProgress, progress] };
    }
  }),
  clearProgress: () => set({ generationProgress: [] }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setUiViewMode: (mode) => set({ uiViewMode: mode }),
  setTheme: (theme) => set({ theme }),
})); 