const fs = require('fs');
const glob = require('glob');

const files = glob.sync('c:/OnlineExamMobile/OnlineExamFe/src/screens/**/*.js');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  const fallbackRoute = file.includes('teacher') ? 'TeacherDashboard' : 'StudentDashboard';

  if (content.includes('navigation.goBack()')) {
    // For inline arrows: onPress={() => navigation.goBack()}
    content = content.replace(
      /navigation\.goBack\(\)/g,
      `navigation.canGoBack() ? navigation.goBack() : navigation.replace('${fallbackRoute}')`
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed goBack in: ' + file);
  }
}
