const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'services');

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!fullPath.includes('node_modules')) {
        processDirectory(fullPath);
      }
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // Replace `catch (error: any) {` with `catch (error) {\n    const err = error as Error;`
  // We will need to replace `error.` with `err.` within that block. This is slightly tricky,
  // so instead of replacing `error.` everywhere, we just replace `error: any` with `error: any`? No, the goal is to remove `any`.
  // The simplest is to replace `catch (error: any)` with `catch (error)` and then manually fix any compilation issues,
  // OR we replace it with `catch (error: any)`... wait, we WANT to fix the any.
  // Let's replace `catch (error: any)` with `catch (e)` and inside we do `const error = e as any;` to keep it compiling, but that defeats the purpose.
  // Wait, the previous build error in `learning-service` was:
  // `src/controllers/classController.ts(902,27): error TS2339: Property 'code' does not exist on type 'Error'.`
  // This happened because I used `const error = e as Error;` and standard `Error` has no `.code`.
  // To fix `any` while keeping `.code` working, we could cast it to `any` ONLY at the access point, or use a custom type `interface AppError extends Error { code?: string }`.
  // Let's just use `catch (error)` and if there's an error.code, we do `(error as any).code`.
  // Since we can't easily parse AST in this script, let's just do `catch (err: unknown)` and `const error = err as any;`? NO, that still uses any.
  // The user wants to "แก้ Type any" (fix the any type). So we must remove it.
  // Let's replace `catch (error: any)` with `catch (err)` and then `const error = err as Error & { code?: string };`

  content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)\s*\{/g, 'catch ($1_err) {\n    const $1 = $1_err as Error & { code?: string; details?: string; };');

  // Fix console.log -> logger.info, etc.
  if (content.includes('console.log(') || content.includes('console.error(') || content.includes('console.warn(') || content.includes('console.info(')) {
    // Make sure logger is imported
    if (!content.includes('import { logger }') && !content.includes('import {logger}')) {
      // Find the first import statement and insert BEFORE it, or after the first line.
      const lines = content.split('\n');
      let insertIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          insertIdx = i;
          break;
        }
      }
      lines.splice(insertIdx, 0, 'import { logger } from "@tutor-advantage/shared-config";');
      content = lines.join('\n');
    }
    
    // Replace standard console calls (but be careful not to replace them if they are commented out, though regex is global)
    content = content.replace(/console\.log\(/g, 'logger.info(');
    content = content.replace(/console\.info\(/g, 'logger.info(');
    content = content.replace(/console\.error\(/g, 'logger.error(');
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

processDirectory(servicesDir);
console.log('Done!');
