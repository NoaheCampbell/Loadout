#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get paths
const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
const oldPath = path.join(appSupport, 'electron-vite-react', 'projects');
const newPath = path.join(appSupport, 'FlowGenius', 'projects');

console.log('🔄 Project Migration Tool');
console.log('========================');
console.log(`Old location: ${oldPath}`);
console.log(`New location: ${newPath}`);
console.log('');

// Check if old directory exists
if (!fs.existsSync(oldPath)) {
  console.log('✅ No old projects directory found. Nothing to migrate.');
  process.exit(0);
}

// Read old projects
const oldIndexPath = path.join(oldPath, 'index.json');
if (!fs.existsSync(oldIndexPath)) {
  console.log('⚠️  No index.json found in old directory.');
  process.exit(0);
}

const oldProjects = JSON.parse(fs.readFileSync(oldIndexPath, 'utf-8'));
console.log(`Found ${oldProjects.length} projects to potentially migrate.`);

// Create new directory if it doesn't exist
fs.mkdirSync(newPath, { recursive: true });

// Read existing projects in new location
const newIndexPath = path.join(newPath, 'index.json');
let newProjects = [];
if (fs.existsSync(newIndexPath)) {
  newProjects = JSON.parse(fs.readFileSync(newIndexPath, 'utf-8'));
}

const existingIds = new Set(newProjects.map(p => p.id));
let migratedCount = 0;

// Migrate projects
for (const project of oldProjects) {
  if (existingIds.has(project.id)) {
    console.log(`⏭️  Skipping ${project.title} (already exists)`);
    continue;
  }

  const oldProjectPath = path.join(oldPath, project.id);
  const newProjectPath = path.join(newPath, project.id);

  if (!fs.existsSync(oldProjectPath)) {
    console.log(`⚠️  Project directory not found: ${project.id}`);
    continue;
  }

  // Copy project directory
  console.log(`📁 Migrating ${project.title}...`);
  fs.cpSync(oldProjectPath, newProjectPath, { recursive: true });
  
  // Add to new index
  newProjects.push(project);
  migratedCount++;
}

// Save updated index
fs.writeFileSync(newIndexPath, JSON.stringify(newProjects, null, 2));

console.log('');
console.log(`✅ Migration complete! Migrated ${migratedCount} projects.`);
console.log('');
console.log('Note: The old projects are still in the original location.');
console.log('You can manually delete the old directory once you verify everything works.');
console.log(`Old directory: ${oldPath}`); 