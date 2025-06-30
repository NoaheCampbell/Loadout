import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
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
    if (files.uiCode) {
      await fs.writeFile(path.join(projectPath, 'ui.tsx'), files.uiCode);
    }
    if (files.v0Prompt) {
      await fs.writeFile(path.join(projectPath, 'v0_prompt.json'), JSON.stringify(files.v0Prompt, null, 2));
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
      
      const files: Partial<ProjectFiles> = {};

      // Load files that exist
      try {
        files.idea = await fs.readFile(path.join(projectPath, 'idea.txt'), 'utf-8');
      } catch {}
      
      try {
        const prdContent = await fs.readFile(path.join(projectPath, 'prd.md'), 'utf-8');
        files.prd = this.parsePrdFromMarkdown(prdContent);
      } catch {}

      try {
        const checklistContent = await fs.readFile(path.join(projectPath, 'checklist.md'), 'utf-8');
        files.checklist = this.parseChecklistFromMarkdown(checklistContent);
      } catch {}

      try {
        files.uiCode = await fs.readFile(path.join(projectPath, 'ui.tsx'), 'utf-8');
      } catch {}

      return files as ProjectFiles;
    } catch {
      return null;
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
    // Simple parser - in production, use a proper markdown parser
    return {
      problem: 'Parsed from markdown',
      goals: [],
      scope: '',
      constraints: [],
      success_criteria: []
    };
  }

  private parseChecklistFromMarkdown(content: string): any[] {
    // Simple parser
    return [];
  }
}

export const storage = new StorageManager(); 