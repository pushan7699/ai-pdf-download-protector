import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to remove TypeScript syntax
const patterns = [
  // Remove type imports
  { regex: /import\s*\{[^}]*\}\s*from\s*['"]express['"]\s*;\s*\n/g, replacement: '' },
  { regex: /import\s*\{\s*Request\s*,\s*Response\s*,\s*NextFunction\s*\}\s*from\s*['"]express['"]\s*;\s*\n/g, replacement: '' },
  { regex: /import\s*\{[^}]*ValidationChain[^}]*\}\s*from\s*['"]express-validator['"]/g, replacement: (match) => match.replace(/,?\s*ValidationChain\s*,?/, '').replace(/\{\s*,/, '{').replace(/,\s*\}/, '}') },
  { regex: /import\s*\{[^}]*\bJWTPayload\b[^}]*\}\s*from\s*['"]\.[^'"]*['"]\s*;\s*\n/g, replacement: '' },
  { regex: /import\s*\{[^}]*\bPoolConfig\b[^}]*\}\s*from\s*['"]pg['"]/g, replacement: (match) => match.replace(/,?\s*PoolConfig\s*,?/, '').replace(/\{\s*,/, '{').replace(/,\s*\}/, '}') },
  
  // Remove declare global blocks
  { regex: /declare\s+global\s*\{[\s\S]*?\n\}\n*/g, replacement: '' },
  
  // Remove function parameter types
  { regex: /\(([^):]*?):\s*[A-Za-z<>[\]|,\s]+\)/g, replacement: '($1)' },
  
  // Remove variable type declarations
  { regex: /:\s*(string|number|boolean|any|void|Date|Promise<[^>]+>|[A-Z][a-zA-Z]*)\s*([=;,\)])/g, replacement: '$2' },
  { regex: /:\s*(string|number|boolean|any|void|Date|Promise<[^>]+>|[A-Z][a-zA-Z]*)\s*\[/g, replacement: '[' },
  
  // Remove return type annotations
  { regex: /\):\s*Promise<[^>]+>\s*\{/g, replacement: ') {' },
  { regex: /\):\s*(string|number|boolean|any|void|Date|[A-Z][a-zA-Z]*)\s*\{/g, replacement: ') {' },
  
  // Remove 'as' type assertions
  { regex: /\s+as\s+[A-Z][a-zA-Z<>[\],\s|]*/g, replacement: '' },
  
  // Remove type declarations from class properties
  { regex: /^(\s+)(private|public|protected)\s+([a-zA-Z_$][a-zA-Z0-9_$]*):\s*[^=;\n]+;/gm, replacement: '$1$3;' },
  
  // Remove generic types
  { regex: /<[A-Z][a-zA-Z<>, ]*>/g, replacement: '' },
  
  // Fix const declarations with type annotations
  { regex: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*):\s*[A-Za-z<>[\]|,\s]+\s*=/g, replacement: 'const $1 =' },
  
  // Fix let declarations with type annotations  
  { regex: /let\s+([a-zA-Z_$][a-zA-Z0-9_$]*):\s*[A-Za-z<>[\]|,\s]+\s*=/g, replacement: 'let $1 =' },
];

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply each pattern
  for (const { regex, replacement } of patterns) {
    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      modified = true;
      content = newContent;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Converted: ${filePath}`);
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
    } else if (file.endsWith('.js')) {
      if (convertFile(filePath)) {
        count++;
      }
    }
  }
  
  return count;
}

// Start conversion
const srcDir = path.join(__dirname, 'src');
console.log('Converting TypeScript syntax to JavaScript...\n');
const count = walkDirectory(srcDir);
console.log(`\n✓ Converted ${count} files`);
