import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { Project, ProjectFiles } from '../../src/types';

export class StorageManager {
  private projectsPath: string;
  private indexPath: string;

  constructor() {
    const appPath = app.getPath('userData');
    this.projectsPath = path.join(appPath, 'projects');
    this.indexPath = path.join(this.projectsPath, 'index.json');
  }

  async ensureStorage(): Promise<void> {
    await fs.mkdir(this.projectsPath, { recursive: true });
    
    // Create index.json if it doesn't exist
    try {
      await fs.access(this.indexPath);
    } catch {
      await fs.writeFile(this.indexPath, JSON.stringify([], null, 2));
    }
  }

  async listProjects(): Promise<Project[]> {
    await this.ensureStorage();
    const content = await fs.readFile(this.indexPath, 'utf-8');
    return JSON.parse(content);
  }

  async saveProject(projectId: string, files: Partial<ProjectFiles>, title: string): Promise<void> {
    await this.ensureStorage();
    
    const projectPath = path.join(this.projectsPath, projectId);
    await fs.mkdir(projectPath, { recursive: true });

    // Save individual files
    if (files.idea) {
      await fs.writeFile(path.join(projectPath, 'idea.txt'), files.idea);
    }
    if (files.prd) {
      await fs.writeFile(path.join(projectPath, 'prd.md'), this.prdToMarkdown(files.prd));
    }
    if (files.checklist) {
      await fs.writeFile(path.join(projectPath, 'checklist.md'), this.checklistToMarkdown(files.checklist));
    }
    if (files.brainlift) {
      await fs.writeFile(path.join(projectPath, 'brainlift.md'), this.brainliftToMarkdown(files.brainlift));
    }
    if (files.uiPlan) {
      await fs.writeFile(path.join(projectPath, 'ui_plan.json'), JSON.stringify(files.uiPlan, null, 2));
    }
    if (files.uiStrategy) {
      await fs.writeFile(path.join(projectPath, 'ui_strategy.txt'), files.uiStrategy);
    }
    if (files.uiCode) {
      await fs.writeFile(path.join(projectPath, 'ui.tsx'), files.uiCode);
    }
    if (files.v0Prompt) {
      await fs.writeFile(path.join(projectPath, 'v0_prompt.json'), JSON.stringify(files.v0Prompt, null, 2));
    }
    if (files.chatHistory) {
      await fs.writeFile(path.join(projectPath, 'chat_history.json'), JSON.stringify(files.chatHistory, null, 2));
    }

    // Update index
    const projects = await this.listProjects();
    const existingIndex = projects.findIndex(p => p.id === projectId);
    
    const project: Project = {
      id: projectId,
      title,
      created: new Date().toISOString(),
      status: 'complete',
      path: `projects/${projectId}/`
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    await fs.writeFile(this.indexPath, JSON.stringify(projects, null, 2));
  }

  async loadProject(projectId: string): Promise<ProjectFiles | null> {
    try {
      const projectPath = path.join(this.projectsPath, projectId);
      console.log('Storage: Loading project from:', projectPath);
      
      const files: Partial<ProjectFiles> = {};

      // Load files that exist
      try {
        files.idea = await fs.readFile(path.join(projectPath, 'idea.txt'), 'utf-8');
      } catch (e) {
        console.log('Storage: Failed to load idea.txt:', e instanceof Error ? e.message : String(e));
      }
      
      try {
        const prdContent = await fs.readFile(path.join(projectPath, 'prd.md'), 'utf-8');
        files.prd = this.parsePrdFromMarkdown(prdContent);
      } catch (e) {
        console.log('Storage: Failed to load prd.md:', e instanceof Error ? e.message : String(e));
      }

      try {
        const checklistContent = await fs.readFile(path.join(projectPath, 'checklist.md'), 'utf-8');
        files.checklist = this.parseChecklistFromMarkdown(checklistContent);
      } catch (e) {
        console.log('Storage: Failed to load checklist.md:', e instanceof Error ? e.message : String(e));
      }

      try {
        files.uiCode = await fs.readFile(path.join(projectPath, 'ui.tsx'), 'utf-8');
      } catch (e) {
        console.log('Storage: Failed to load ui.tsx:', e instanceof Error ? e.message : String(e));
      }
      
      try {
        const brainliftContent = await fs.readFile(path.join(projectPath, 'brainlift.md'), 'utf-8');
        files.brainlift = { assumptions: [], decisions: [], contextLinks: [] }; // Simple parse for now
      } catch (e) {
        // Brainlift is optional
      }
      
      try {
        const v0PromptContent = await fs.readFile(path.join(projectPath, 'v0_prompt.json'), 'utf-8');
        files.v0Prompt = JSON.parse(v0PromptContent);
      } catch (e) {
        // v0 prompt is optional
      }
      
      try {
        const uiPlanPath = path.join(projectPath, 'ui_plan.json');
        const uiPlanContent = await fs.readFile(uiPlanPath, 'utf-8');
        files.uiPlan = JSON.parse(uiPlanContent);
      } catch (e) {
        // For backward compatibility, create a basic UI plan
        files.uiPlan = { components: [], layout: '', user_interactions: [] };
      }
      
      // Try to load UI strategy
      try {
        const strategy = await fs.readFile(path.join(projectPath, 'ui_strategy.txt'), 'utf-8');
        files.uiStrategy = strategy.trim() as 'v0' | 'gpt';
      } catch (e) {
        // Fallback: Determine UI strategy based on what files exist
        if (files.uiCode) {
          files.uiStrategy = 'gpt';
        } else if (files.v0Prompt) {
          files.uiStrategy = 'v0';
        }
      }
      
      // Try to load chat history
      try {
        const chatHistoryContent = await fs.readFile(path.join(projectPath, 'chat_history.json'), 'utf-8');
        files.chatHistory = JSON.parse(chatHistoryContent);
      } catch (e) {
        // Chat history is optional
      }

      console.log('Storage: Loaded project files:', Object.keys(files));
      return files as ProjectFiles;
    } catch (error) {
      console.error('Storage: Failed to load project:', error);
      return null;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      // Delete the project directory
      const projectPath = path.join(this.projectsPath, projectId);
      await fs.rm(projectPath, { recursive: true, force: true });
      
      // Update the index
      const projects = await this.listProjects();
      const updatedProjects = projects.filter(p => p.id !== projectId);
      await fs.writeFile(this.indexPath, JSON.stringify(updatedProjects, null, 2));
      
      console.log('Storage: Deleted project:', projectId);
    } catch (error) {
      console.error('Storage: Failed to delete project:', error);
      throw error;
    }
  }

  private prdToMarkdown(prd: any): string {
    return `# Product Requirements Document

## Problem
${prd.problem}

## Goals
${prd.goals.map((g: string) => `- ${g}`).join('\n')}

## Scope
${prd.scope}

## Constraints
${prd.constraints.map((c: string) => `- ${c}`).join('\n')}

## Success Criteria
${prd.success_criteria.map((s: string) => `- ${s}`).join('\n')}`;
  }

  private checklistToMarkdown(checklist: any[]): string {
    return checklist
      .map(item => `- [${item.done ? 'x' : ' '}] ${item.text}`)
      .join('\n');
  }

  private brainliftToMarkdown(brainlift: any): string {
    return `# Brainlift Log

## Assumptions
${brainlift.assumptions.map((a: string) => `- ${a}`).join('\n')}

## Decisions
${brainlift.decisions.map((d: string) => `- ${d}`).join('\n')}

## Context Links
${brainlift.contextLinks.map((l: string) => `- ${l}`).join('\n')}`;
  }

  private parsePrdFromMarkdown(content: string): any {
    // Parse the PRD from markdown
    const prd: any = {
      problem: '',
      goals: [],
      scope: '',
      constraints: [],
      success_criteria: []
    };

    const sections = content.split(/^##\s+/m);
    
    sections.forEach(section => {
      const lines = section.trim().split('\n');
      const title = lines[0]?.toLowerCase();
      
      if (title?.includes('problem')) {
        prd.problem = lines.slice(1).join('\n').trim();
      } else if (title?.includes('goals')) {
        prd.goals = lines.slice(1)
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim().substring(1).trim());
      } else if (title?.includes('scope')) {
        prd.scope = lines.slice(1).join('\n').trim();
      } else if (title?.includes('constraints')) {
        prd.constraints = lines.slice(1)
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim().substring(1).trim());
      } else if (title?.includes('success criteria')) {
        prd.success_criteria = lines.slice(1)
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim().substring(1).trim());
      }
    });

    return prd;
  }

  private parseChecklistFromMarkdown(content: string): any[] {
    // Parse checklist items from markdown
    const lines = content.split('\n');
    const items: any[] = [];
    
    lines.forEach(line => {
      const match = line.match(/^-\s*\[([ x])\]\s*(.+)$/);
      if (match) {
        items.push({
          id: nanoid(),
          done: match[1] === 'x',
          text: match[2].trim()
        });
      }
    });
    
    return items;
  }
}

export const storage = new StorageManager(); 