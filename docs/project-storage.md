# Loadout Project Storage

## Storage Location

Loadout stores projects in platform-specific directories:

### macOS
- **Production**: `~/Library/Application Support/Loadout/projects/`
- **Development (old)**: `~/Library/Application Support/electron-vite-react/projects/`
- **Development (new)**: `~/Library/Application Support/Loadout/projects/`

### Windows
- **Production**: `%APPDATA%/Loadout/projects/`
- **Development**: Same as production

### Linux
- **Production**: `~/.config/Loadout/projects/`
- **Development**: Same as production

## Project Structure

Each project is stored in its own directory:

```
projects/
├── index.json                # Project registry
├── project-id-1/
│   ├── idea.txt             # Original idea
│   ├── prd.md               # Product Requirements Document
│   ├── checklist.md         # Development checklist
│   ├── brainlift.md         # Technical assumptions
│   ├── ui.tsx               # Generated UI code
│   ├── ui_plan.json         # UI planning data
│   ├── ui_strategy.txt      # UI generation strategy (v0 or gpt)
│   └── v0_prompt.json       # v0.dev prompt (if applicable)
└── project-id-2/
    └── ...
```

## Migration

If you have projects from the old location, you can migrate them:

1. Check if old projects exist
2. Copy them to the new `Loadout` directory
3. Update the index.json file

### Migration Script

```bash
# On macOS
cd ~/Library/Application\ Support/
ls electron-vite-react/projects/  # Check old projects
cp -r electron-vite-react/projects/* Loadout/projects/  # Copy projects
```

## Viewing Projects

To see your projects:

```bash
# macOS
ls ~/Library/Application\ Support/Loadout/projects/

# See project details
cat ~/Library/Application\ Support/Loadout/projects/index.json | jq '.'
```

## Backup

To backup your projects:

```bash
# Create backup
tar -czf loadout-projects-backup.tar.gz -C ~/Library/Application\ Support/ Loadout/projects/

# Restore backup
tar -xzf loadout-projects-backup.tar.gz -C ~/Library/Application\ Support/
```

## Troubleshooting

### Can't find my projects?
Check both locations:
```bash
# Old location
ls ~/Library/Application\ Support/electron-vite-react/projects/

# New location
ls ~/Library/Application\ Support/Loadout/projects/
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