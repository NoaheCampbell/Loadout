# Product Requirements Document (PRD): Loadout

## Version 1.0 - November 2024

**Loadout**
AI-First Project Blueprint Generator

## Product Overview
Loadout is a desktop application designed to help AI-first developers transform raw project ideas into complete development blueprints. It automates the planning phase by using LangGraph to orchestrate a workflow that produces PRDs, technical checklists, and UI scaffolds. Seamlessly integrated with modern AI development tools like v0, Cursor, and Notion, Loadout becomes the starting point for every project.

## Problem Statement
AI-first developers spend significant time translating ideas into structured plans before actual coding begins. Current tools (ChatGPT, v0, Cursor) are powerful but disconnected. Developers need a unified workflow that:
- Transforms raw ideas into comprehensive project blueprints
- Generates structured documentation (PRDs, checklists, technical decisions)
- Creates working UI prototypes as a starting point
- Exports everything in formats ready for their preferred tools

## Target Users
1. **Primary**: AI-first developers who use ChatGPT/Cursor for coding
2. **Secondary**: Technical founders planning MVPs
3. **Tertiary**: Product managers who code

## Core Value Proposition
"From idea to implementation-ready blueprint in minutes, not hours."

## MVP Scope (Loadout Core)

### 1. Project Idea Input
- Simple text area for raw project ideas (50-500 words)
- Example prompts/templates for guidance
- Auto-save drafts

### 2. LangGraph Workflow Engine
Sequential workflow with the following nodes:
- **IdeaInputNode**: Parse and structure the raw idea
- **PRDGeneratorNode**: Create comprehensive PRD
- **ChecklistGeneratorNode**: Build phase-based development checklist
- **BrainliftNode**: Document assumptions and technical decisions
- **UIPlannerNode**: Design component architecture
- **UIStrategyDecisionNode**: Choose between v0 (simple) or GPT-4 (complex)
- **UIGeneratorNode**: Create actual UI code/prompts

### 3. Project Dashboard
- List view of all projects
- Status indicators (draft, processing, complete)
- Quick actions (view, edit, export, delete)
- Search and filter capabilities

### 4. Artifact Viewers
Each artifact gets a dedicated viewer tab:
- **PRD Viewer**: Markdown rendered with sections
- **Checklist Viewer**: Interactive checkbox interface with progress tracking
- **UI Viewer**: Code preview with syntax highlighting
- **Brainlift Viewer**: Assumptions and decisions log

### 5. Export System
One-click export to:
- Markdown files (PRD, Checklist)
- UI code files (.tsx, .jsx)
- v0 prompts (formatted for direct paste)
- Complete project bundle (.zip)

## Technical Architecture

### Frontend
- React + TypeScript
- Tailwind CSS for styling
- Zustand for state management
- React-markdown for rendering

### Backend (Electron Main Process)
- LangGraph for workflow orchestration
- OpenAI API for LLM calls
- Local file system for storage

### Key Libraries
- @langchain/langgraph
- @langchain/openai
- electron-builder
- react-hot-toast for notifications

## User Journey

1. **Create Project**
   - User enters project idea
   - Clicks "Generate Blueprint"
   - Sees real-time progress

2. **Review Artifacts**
   - Browses through generated PRD
   - Reviews development checklist
   - Previews UI components

3. **Iterate** (Post-MVP)
   - Adjusts parameters
   - Regenerates specific artifacts
   - Provides feedback

4. **Export**
   - Selects export format
   - Downloads files
   - Imports into preferred tools

## Success Metrics
- Time from idea to export: < 5 minutes
- User satisfaction with generated artifacts: > 80%
- Export-to-implementation rate: > 60%

## Future Enhancements (Post-MVP)
- GPT-4 Vision for mockup imports
- Direct integrations (Linear, Notion API)
- Multi-project templates
- Collaboration features
- Custom LangGraph node builder

## Technical Constraints
- Requires OpenAI API key
- Desktop-only (Electron)
- English language only for MVP
- Max 10,000 tokens per generation

## Dependencies
- OpenAI API availability
- User has valid API key with credits
- Modern OS (macOS 12+, Windows 10+, Ubuntu 20+)

## File Storage
Projects are stored locally in platform-specific directories:
- **macOS**: `~/Library/Application Support/Loadout/projects/`
- **Windows**: `%APPDATA%\Loadout\projects\`
- **Linux**: `~/.config/Loadout/projects/`

Each project gets a unique ID and contains:
- `idea.txt` - Original input
- `prd.md` - Generated PRD
- `checklist.md` - Development checklist
- `brainlift.md` - Technical decisions
- `ui.tsx` or `v0_prompt.json` - UI artifacts

