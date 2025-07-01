#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const os = require('os')

// Check if we're on macOS
if (process.platform !== 'darwin') {
  console.error('❌ This script only works on macOS currently.')
  process.exit(1)
}

console.log('🔍 Verifying Loadout setup...\n')

// Check storage location
const appSupport = path.join(os.homedir(), 'Library', 'Application Support')
const appPath = path.join(appSupport, 'Loadout')
const projectsPath = path.join(appPath, 'projects')
const indexPath = path.join(projectsPath, 'index.json')

console.log('📁 Storage Locations:')
console.log('   App directory:', appPath)
console.log('   Projects directory:', projectsPath)
console.log('   Index file:', indexPath)
console.log('')

// Check if directories exist
if (!fs.existsSync(appPath)) {
  console.log('⚠️  App directory does not exist yet.')
  console.log('   This is normal if you haven\'t run the app yet.')
} else {
  console.log('✅ App directory exists')
}

if (!fs.existsSync(projectsPath)) {
  console.log('⚠️  Projects directory does not exist yet.')
  console.log('   This will be created when you save your first project.')
} else {
  console.log('✅ Projects directory exists')
  
  // Check for projects
  if (fs.existsSync(indexPath)) {
    try {
      const projects = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      console.log(`✅ Found ${projects.length} project(s)`)
      
      if (projects.length > 0) {
        console.log('\n📊 Projects:')
        projects.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.title} (${p.id})`)
        })
      }
    } catch (error) {
      console.error('❌ Error reading index.json:', error.message)
    }
  } else {
    console.log('⚠️  No index.json file found')
  }
}

// Check old location
const oldPath = path.join(appSupport, 'electron-vite-react', 'projects')
if (fs.existsSync(oldPath)) {
  console.log('\n⚠️  Found old projects directory!')
  console.log('   Location:', oldPath)
  console.log('   Run "npm run migrate-projects" to move them to the new location.')
}

console.log('\n✅ Setup verification complete!') 