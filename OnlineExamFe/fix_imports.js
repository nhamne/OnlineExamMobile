const fs = require('fs');
const glob = require('glob');

const files = glob.sync('c:/OnlineExamMobile/OnlineExamFe/src/screens/**/*.js');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('loadAuthSession') && !content.includes('import { loadAuthSession') && !content.includes('loadAuthSession,') && !content.includes(', loadAuthSession')) {
    
    // It uses loadAuthSession but doesn't import it!
    const importMatch = content.match(/import\s+\{[^}]*\}\s+from\s+['"].*?authSession['"];?/);
    if (importMatch) {
       content = content.replace(importMatch[0], importMatch[0].replace('{', '{ loadAuthSession, '));
    } else {
       const firstImport = content.indexOf('import');
       const importPath = file.includes('home') ? '../../services/authSession' : (file.includes('teacher') || file.includes('dashboard')) ? '../../services/authSession' : '../services/authSession';
       content = content.slice(0, firstImport) + `import { loadAuthSession } from '${importPath}';\n` + content.slice(firstImport);
    }
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed import in: ' + file);
  }
}
