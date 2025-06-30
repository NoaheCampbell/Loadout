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
  currentTab: 'idea' | 'prd' | 'checklist' | 'ui';
  
  // UI state
  uiViewMode: 'preview' | 'code';
  theme: 'light' | 'dark';
  
  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (projectId: string | null) => void;
  setProjectData: (data: ProjectFiles | null) => void;
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
  setGenerating: (isGenerating) => set({ isGenerating }),
  addProgress: (progress) => set((state) => ({
    generationProgress: [...state.generationProgress, progress]
  })),
  clearProgress: () => set({ generationProgress: [] }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setUiViewMode: (mode) => set({ uiViewMode: mode }),
  setTheme: (theme) => set({ theme }),
})); 