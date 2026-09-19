import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix relative imports without .js extension
  // Match: import ... from './something' or '../something'
  // Don't match if already has .js extension
  const importRegex = /from\s+['"](\.\.?\/[^'"]+)(?<!\.js)['"]/g;
  
  const newContent = content.replace(importRegex, (match, importPath) => {
    // Don't add .js if it's already there or if it ends with a slash (directory)
    if (importPath.endsWith('.js') || importPath.endsWith('/')) {
      return match;
    }
    modified = true;
    return `from '${importPath}.js'`;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Fixed imports: ${filePath}`);
    return true;
  }
  
  return false;
}

function walkDirectory(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      count += walkDirectory(filePath);
    } else if (file.endsWith('.js') && file !== 'fix-imports.js' && file !== 'convert-ts-to-js.js') {
      if (fixImports(filePath)) {
        count++;
      }
    }
  }
  
  return count;
}

// Start fixing
const srcDir = path.join(__dirname, 'src');
console.log('Adding .js extensions to imports...\n');
const count = walkDirectory(srcDir);
console.log(`\n✓ Fixed ${count} files`);
