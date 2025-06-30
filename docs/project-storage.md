# FlowGenius Project Storage

## Storage Locations

FlowGenius stores projects in platform-specific directories:

### macOS
- **Production**: `~/Library/Application Support/FlowGenius/projects/`
- **Development (old)**: `~/Library/Application Support/electron-vite-react/projects/`
- **Development (new)**: `~/Library/Application Support/FlowGenius/projects/`

### Windows
- **Production**: `%APPDATA%/FlowGenius/projects/`
- **Development**: Same as production after the configuration update

### Linux
- **Production**: `~/.config/FlowGenius/projects/`
- **Development**: Same as production after the configuration update

## Project Structure

Each project is stored in its own directory with a unique ID:
```
projects/
├── index.json                    # List of all projects
├── test-ui-project/             # Example project
│   ├── idea.txt                 # Original project idea
│   ├── prd.md                   # Product Requirements Document
│   ├── checklist.md             # Development checklist
│   ├── brainlift.md             # Assumptions and decisions (optional)
│   ├── ui_plan.json             # UI component plan
│   ├── ui_strategy.txt          # Either "v0" or "gpt"
│   ├── ui.tsx                   # Generated UI code (if GPT strategy)
│   └── v0_prompt.json           # v0.dev prompt (if v0 strategy)
└── 59A93QNOb4aRxZCkgJF0v/      # Another project...
```

## Migration from Old Location

If you've been using the development version and have projects in the old location, you can migrate them:

```bash
node scripts/migrate-projects.js
```

This will:
1. Find all projects in the old `electron-vite-react` directory
2. Copy them to the new `FlowGenius` directory
3. Merge the project indexes
4. Keep the originals intact (you can delete them manually later)

## Troubleshooting

### Can't find my projects?
Check both locations:
```bash
# Old location
ls ~/Library/Application\ Support/electron-vite-react/projects/

# New location
ls ~/Library/Application\ Support/FlowGenius/projects/
```

### Projects not showing in the app?
1. Make sure you've restarted the app after changing the configuration
2. Check that the `index.json` file exists and is valid JSON
3. Verify project directories contain the expected files

### Manual project recovery
If a project exists on disk but isn't in the index, you can manually add it:
1. Find the project ID (directory name)
2. Look for the `idea.txt` file to get the project title
3. Add an entry to `index.json`:
```json
{
  "id": "your-project-id",
  "title": "Your Project Title",
  "created": "2024-06-30T12:00:00.000Z",
  "status": "complete",
  "path": "projects/your-project-id/"
}
``` 