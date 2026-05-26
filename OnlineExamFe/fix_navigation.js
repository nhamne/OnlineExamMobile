const fs = require('fs');
const glob = require('glob');

const files = glob.sync('c:/OnlineExamMobile/OnlineExamFe/src/screens/**/*.js');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  // 1. TeacherSessionManagement in TeacherDashboardScreen.js and SessionScreen.js
  if (content.includes("navigation.navigate('TeacherSessionManagement', {")) {
    content = content.replace(
      /navigation\.navigate\('TeacherSessionManagement',\s*\{/g,
      "navigation.navigate('TeacherSessionManagement', { sessionId: session?.Id || session?.id || item?.Id || item?.id,"
    );
    changed = true;
  }

  // 2. TeacherExamDetail in TeacherDashboardScreen.js
  if (content.includes("navigation.navigate('TeacherExamDetail', { exam: item")) {
    content = content.replace(
      /navigation\.navigate\('TeacherExamDetail',\s*\{\s*exam:\s*item/g,
      "navigation.navigate('TeacherExamDetail', { examId: item?.Id || item?.id, exam: item"
    );
    changed = true;
  }

  // 3. TeacherClassroomManagement in ClassScreen.js
  if (content.includes("navigation.navigate('TeacherClassroomManagement', {")) {
    content = content.replace(
      /navigation\.navigate\('TeacherClassroomManagement',\s*\{/g,
      "navigation.navigate('TeacherClassroomManagement', { classroomId: item?.Id || item?.id,"
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed navigation in: ' + file);
  }
}
