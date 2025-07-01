#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get paths
const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
const oldPath = path.join(appSupport, 'electron-vite-react', 'projects');
const newPath = path.join(appSupport, 'Loadout', 'projects');

async function migrate() {
  console.log('🔄 Project Migration Tool');
  console.log('========================');
  console.log(`Old location: ${oldPath}`);
  console.log(`New location: ${newPath}`);
  console.log('');

  // Check if old directory exists
  if (!fs.existsSync(oldPath)) {
    console.log('✅ No old projects directory found. Nothing to migrate.');
    return;
  }

  // Check if new directory already exists
  if (fs.existsSync(newPath)) {
    console.log('⚠️  New directory already exists:', newPath);
    console.log('Please backup and remove it if you want to migrate');
    return;
  }

  // Create new app directory
  const newAppDir = path.dirname(newPath);
  if (!fs.existsSync(newAppDir)) {
    console.log('Creating app directory:', newAppDir);
    fs.mkdirSync(newAppDir, { recursive: true });
  }

  // Move projects
  console.log('Moving projects...');
  fs.renameSync(oldPath, newPath);
  
  console.log('✅ Migration complete!');
  console.log(`Projects moved to: ${newPath}`);
}

migrate().catch(console.error); 