import { app, safeStorage } from 'electron';
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
    
    // Save UI files in ui/ subdirectory
    if (files.uiFiles && files.uiFiles.length > 0) {
      const uiPath = path.join(projectPath, 'ui');
      await fs.mkdir(uiPath, { recursive: true });
      
      const savedFiles: Array<{ filename: string; type: string }> = [];
      
      for (const file of files.uiFiles) {
        try {
          // Sanitize filename to prevent invalid paths
          let safeFilename = file.filename
            .replace(/\$\{[^}]+\}/g, '') // Remove template literals
            .replace(/[<>:"|?*]/g, '') // Remove invalid characters
            .replace(/\//g, '_') // Replace forward slashes with underscores
            .trim();
          
          // Ensure filename is not empty
          if (!safeFilename) {
            console.warn(`Skipping invalid filename: ${file.filename}`);
            continue;
          }
          
          // Preserve original file extensions
          // The workflow generates appropriate extensions (.js, .html, .md)
          // so we should keep them as-is
          
          console.log(`Saving UI file: ${safeFilename} (original: ${file.filename})`);
          await fs.writeFile(path.join(uiPath, safeFilename), file.content);
          savedFiles.push({ filename: safeFilename, type: file.type });
        } catch (error) {
          console.error(`Failed to save UI file ${file.filename}:`, error);
          // Continue with other files instead of failing completely
        }
      }
      
      // Save UI files metadata with sanitized filenames
      if (savedFiles.length > 0) {
        await fs.writeFile(
          path.join(uiPath, 'files.json'), 
          JSON.stringify(savedFiles, null, 2)
        );
      }
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
      
      // Try to load UI files from ui/ subdirectory
      try {
        const uiPath = path.join(projectPath, 'ui');
        const metadataPath = path.join(uiPath, 'files.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent) as Array<{ filename: string; type: string }>;
        
        files.uiFiles = [];
        for (const meta of metadata) {
          const content = await fs.readFile(path.join(uiPath, meta.filename), 'utf-8');
          files.uiFiles.push({
            filename: meta.filename,
            type: meta.type as 'component' | 'style' | 'utils' | 'main',
            content
          });
        }
        console.log('Storage: Loaded UI files:', files.uiFiles.length);
      } catch (e) {
        // UI files are optional (for backwards compatibility)
        console.log('Storage: No UI files found (normal for older projects)');
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
    console.log('Storage: Converting PRD to markdown:', JSON.stringify(prd, null, 2));
    
    // Handle empty or malformed PRD
    if (!prd || typeof prd !== 'object') {
      console.error('Storage: Invalid PRD data:', prd);
      return '# Untitled Project\n\n## Project Description\n[No description provided]\n\n## Target Audience\n[No audience defined]\n\n## Desired Features\n[No features defined]\n\n## Design Requests\n[No design requests]\n\n## Other Notes\n[No additional notes]';
    }
    
    // Check if problem already contains formatted markdown (new format)
    const problemText = prd.problem || '';
    let projectHeader = '';
    let projectDescription = '';
    
    if (problemText.includes('# ') && problemText.includes('## Project Description')) {
      // New format - problem already contains formatted markdown
      projectHeader = problemText;
    } else {
      // Old format - extract project name from first line
      const problemLines = problemText.split('\n').filter((line: string) => line.trim());
      const projectName = problemLines[0] || 'Untitled Project';
      projectDescription = problemLines.slice(1).join('\n').trim() || problemText || '[No description provided]';
      projectHeader = `# ${projectName}\n\n## Project Description\n${projectDescription}`;
    }

    // Ensure all fields are arrays or strings
    const goals = Array.isArray(prd.goals) && prd.goals.length > 0 
      ? prd.goals.join('\n\n') 
      : '[No features defined]';
    
    const scope = prd.scope || '[No target audience defined]';
    
    const constraints = Array.isArray(prd.constraints) && prd.constraints.length > 0
      ? prd.constraints.join('\n')
      : '[No design requests]';
    
    const successCriteria = Array.isArray(prd.success_criteria) && prd.success_criteria.length > 0
      ? prd.success_criteria.map((s: string) => `- ${s}`).join('\n')
      : '- [No additional notes]';

    const markdown = `${projectHeader}

## Target Audience
${scope}

## Desired Features
${goals}

## Design Requests
${constraints}

## Other Notes
${successCriteria}`;

    console.log('Storage: Generated markdown PRD:', markdown.substring(0, 200) + '...');
    return markdown;
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
    console.log('Storage: Parsing PRD from markdown, content length:', content.length);
    
    // Parse the PRD from markdown
    const prd: any = {
      problem: '',
      goals: [],
      scope: '',
      constraints: [],
      success_criteria: []
    };

    // Extract the project header section (# Project Name + ## Project Description)
    const projectHeaderMatch = content.match(/^#\s+.+\n+##\s+Project Description\n[\s\S]+?(?=\n##\s+Target Audience)/);
    if (projectHeaderMatch) {
      prd.problem = projectHeaderMatch[0].trim();
    } else {
      // Fallback for old format
      const lines = content.split('\n');
      const projectName = lines[0]?.replace(/^#\s*/, '').trim() || '';
      const sections = content.split(/^##\s+/m);
      
      sections.forEach(section => {
        const sectionLines = section.trim().split('\n');
        const title = sectionLines[0]?.toLowerCase();
        
        if (title?.includes('project description')) {
          const description = sectionLines.slice(1).join('\n').trim();
          prd.problem = projectName ? `${projectName}\n${description}` : description;
          return;
        }
      });
    }
    
    // Parse remaining sections
    const sections = content.split(/^##\s+/m);
    
    sections.forEach(section => {
      const sectionLines = section.trim().split('\n');
      const title = sectionLines[0]?.toLowerCase();
      
      if (title?.includes('target audience')) {
        prd.scope = sectionLines.slice(1).join('\n').trim();
      } else if (title?.includes('desired features')) {
        // Preserve the full content including headers and checkboxes
        const featuresContent = sectionLines.slice(1).join('\n').trim();
        // Split by feature category headers (###)
        const features = featuresContent.split(/(?=^###\s)/m).filter(f => f.trim());
        prd.goals = features.length > 0 ? features : [featuresContent];
      } else if (title?.includes('design requests')) {
        // Preserve the full content including checkboxes
        const designContent = sectionLines.slice(1).join('\n').trim();
        // Split by main checkbox items (- [ ])
        const designs = designContent.split(/\n(?=- \[ \])/m)
          .map(d => d.trim())
          .filter(d => d && d.startsWith('- [ ]'));
        prd.constraints = designs.length > 0 ? designs : [designContent];
      } else if (title?.includes('other notes')) {
        prd.success_criteria = sectionLines.slice(1)
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim().substring(1).trim());
      }
    });

    console.log('Storage: Parsed PRD:', JSON.stringify(prd, null, 2).substring(0, 200) + '...');
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

// API Key storage
const API_KEY_FILE = path.join(app.getPath('userData'), 'api-key.enc')

export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const encrypted = safeStorage.encryptString(apiKey)
    await fs.writeFile(API_KEY_FILE, encrypted)
  } catch (error) {
    console.error('Error saving API key:', error)
    throw error
  }
}

export async function getApiKey(): Promise<string | null> {
  try {
    const encryptedData = await fs.readFile(API_KEY_FILE)
    
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const decrypted = safeStorage.decryptString(encryptedData)
    return decrypted
  } catch (error) {
    // File doesn't exist or other error
    // Silently return null - this is expected when using new provider config
    return null
  }
}

export async function deleteApiKey(): Promise<void> {
  try {
    await fs.unlink(API_KEY_FILE)
  } catch (error) {
    // Silently ignore - no API key to delete
  }
}

// Multi-provider API key storage
const PROVIDER_CONFIG_FILE = path.join(app.getPath('userData'), 'provider-config.enc')

export interface ProviderConfig {
  selectedProvider: 'openai' | 'anthropic' | 'ollama'
  providers: {
    openai?: {
      apiKey: string
      model?: string
    }
    anthropic?: {
      apiKey: string
      model?: string
    }
    ollama?: {
      model: string
      baseUrl?: string
    }
  }
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const jsonString = JSON.stringify(config)
    const encrypted = safeStorage.encryptString(jsonString)
    await fs.writeFile(PROVIDER_CONFIG_FILE, encrypted)
  } catch (error) {
    console.error('Error saving provider config:', error)
    throw error
  }
}

export async function getProviderConfig(): Promise<ProviderConfig | null> {
  try {
    const encryptedData = await fs.readFile(PROVIDER_CONFIG_FILE)
    
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system')
    }
    
    const decrypted = safeStorage.decryptString(encryptedData)
    return JSON.parse(decrypted) as ProviderConfig
  } catch (error) {
    // File doesn't exist or other error - this is expected on first run
    return null
  }
}

export async function deleteProviderConfig(): Promise<void> {
  try {
    await fs.unlink(PROVIDER_CONFIG_FILE)
  } catch (error) {
    console.log('No provider config to delete')
  }
}

// Migration function to convert old API key to new format
export async function migrateApiKeyToProviderConfig(): Promise<void> {
  try {
    const oldApiKey = await getApiKey()
    if (oldApiKey && !(await getProviderConfig())) {
      // Migrate old API key to new format
      await saveProviderConfig({
        selectedProvider: 'openai',
        providers: {
          openai: {
            apiKey: oldApiKey,
            model: 'gpt-4'
          }
        }
      })
      // Delete old API key file after successful migration
      await deleteApiKey()
      console.log('Successfully migrated API key to new provider config')
    }
  } catch (error) {
    console.error('Error migrating API key:', error)
  }
} 