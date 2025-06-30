#!/usr/bin/env node

import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

console.log('🔍 Verifying FlowGenius setup...\n');

const requiredPackages = [
  '@langchain/langgraph',
  '@langchain/openai',
  '@langchain/core',
  'dotenv',
  'react-markdown',
  'remark-gfm',
  '@monaco-editor/react',
  '@codesandbox/sandpack-react',
  '@codesandbox/sandpack-themes',
  'react-hot-toast',
  'lucide-react',
  'clsx',
  'zustand',
  'date-fns',
  'nanoid'
];

let allGood = true;

// Check packages
console.log('📦 Checking dependencies:');
for (const pkg of requiredPackages) {
  try {
    if (pkg === '@langchain/core') {
      // Special handling for @langchain/core which might be a transitive dependency
      require.resolve('@langchain/core/utils/env');
    } else {
      require.resolve(pkg);
    }
    console.log(`  ✅ ${pkg}`);
  } catch (e) {
    console.log(`  ❌ ${pkg} - NOT INSTALLED`);
    allGood = false;
  }
}

// Check directories
console.log('\n📁 Checking directories:');

const requiredDirs = [
  'src/components',
  'src/hooks', 
  'src/lib',
  'src/store',
  'src/types',
  'electron/lib'
];

for (const dir of requiredDirs) {
  if (existsSync(join(process.cwd(), dir))) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir} - NOT FOUND`);
    allGood = false;
  }
}

// Check .env.local
console.log('\n🔑 Checking environment:');
if (existsSync(join(process.cwd(), '.env.local'))) {
  console.log('  ✅ .env.local exists');
  
  // Load and check for API key
  config({ path: '.env.local' });
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.log('  ✅ OPENAI_API_KEY is set');
  } else {
    console.log('  ❌ OPENAI_API_KEY is not set or invalid');
    allGood = false;
  }
} else {
  console.log('  ❌ .env.local - NOT FOUND');
  allGood = false;
}

// Summary
console.log('\n' + '='.repeat(40));
if (allGood) {
  console.log('✅ All checks passed! Ready to start development.');
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
}
console.log('='.repeat(40)); 