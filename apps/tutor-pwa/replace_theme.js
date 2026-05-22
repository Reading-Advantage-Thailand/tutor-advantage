const fs = require('fs');
const file = 'c:/Repository/tutor-advantage/apps/tutor-pwa/src/app/(dashboard)/lesson/[id]/interactive/ArticleDisplay.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/bg-white/g, 'bg-card');
content = content.replace(/bg-slate-50/g, 'bg-muted');
content = content.replace(/bg-slate-100/g, 'bg-muted');
content = content.replace(/bg-gray-100/g, 'bg-muted');
content = content.replace(/bg-gray-50/g, 'bg-muted');

content = content.replace(/text-slate-900/g, 'text-foreground');
content = content.replace(/text-slate-800/g, 'text-foreground');
content = content.replace(/text-gray-900/g, 'text-foreground');
content = content.replace(/text-gray-800/g, 'text-foreground');

content = content.replace(/text-slate-600/g, 'text-muted-foreground');
content = content.replace(/text-slate-500/g, 'text-muted-foreground');
content = content.replace(/text-slate-400/g, 'text-muted-foreground');
content = content.replace(/text-gray-600/g, 'text-muted-foreground');
content = content.replace(/text-gray-500/g, 'text-muted-foreground');
content = content.replace(/text-gray-400/g, 'text-muted-foreground');

content = content.replace(/border-slate-100/g, 'border-border');
content = content.replace(/border-slate-200/g, 'border-border');
content = content.replace(/border-gray-100/g, 'border-border');
content = content.replace(/border-gray-200/g, 'border-border');

// Phase 1 specific
content = content.replace(/bg-indigo-50 border-2 border-indigo-100/g, 'bg-card border-2 border-border');
content = content.replace(/text-indigo-900/g, 'text-foreground');
content = content.replace(/text-indigo-600/g, 'text-primary');

// Phase 2 specific
content = content.replace(/text-slate-700/g, 'text-foreground');
content = content.replace(/bg-purple-50 border border-purple-100/g, 'bg-muted border border-border');

fs.writeFileSync(file, content);
console.log('Replacements complete');
