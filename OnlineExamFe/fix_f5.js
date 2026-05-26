const fs = require('fs');
const glob = require('glob');

const files = glob.sync('c:/OnlineExamMobile/OnlineExamFe/src/screens/**/*.js');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('route?.params?.user || null') || content.includes('route.params?.user || null') || content.includes('route.params?.user;')) {
    
    let changed = false;
    
    if (content.includes('route?.params?.user || null')) {
        content = content.replace(/route\?\.params\?\.user \|\| null/g, 'route?.params?.user || loadAuthSession()');
        changed = true;
    }
    
    if (content.includes('route.params?.user || null')) {
        content = content.replace(/route\.params\?\.user \|\| null/g, 'route?.params?.user || loadAuthSession()');
        changed = true;
    }
    
    if (content.includes('route.params?.user;')) {
        content = content.replace(/route\.params\?\.user;/g, 'route?.params?.user || loadAuthSession();');
        changed = true;
    }

    if (changed) {
        // Ensure loadAuthSession is imported
        if (!content.includes('loadAuthSession')) {
            const importMatch = content.match(/import\s+\{[^}]*\}\s+from\s+['"].*?authSession['"];?/);
            if (importMatch) {
               content = content.replace(importMatch[0], importMatch[0].replace('{', '{ loadAuthSession, '));
            } else {
               // Add import at the top
               const firstImport = content.indexOf('import');
               const importPath = file.includes('home') ? '../../services/authSession' : (file.includes('teacher') || file.includes('dashboard')) ? '../../services/authSession' : '../services/authSession';
               content = content.slice(0, firstImport) + `import { loadAuthSession } from '${importPath}';\n` + content.slice(firstImport);
            }
        }
        
        fs.writeFileSync(file, content, 'utf-8');
        console.log('Updated: ' + file);
    }
  }
}
