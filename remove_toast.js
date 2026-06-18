const fs = require('fs');
const files = [
  'OnlineExamFe/src/screens/dashboard/StudentDashboardScreen.js',
  'OnlineExamFe/src/screens/dashboard/StudentResultsContent.js',
  'OnlineExamFe/src/screens/dashboard/TeacherDashboardScreen.js',
  'OnlineExamFe/src/screens/teacher/ClassScreen.js',
  'OnlineExamFe/src/screens/teacher/SessionScreen.js'
];
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/showToast\('Meilisearch không hoạt động\. Đang dùng tìm kiếm thường\.', 'warning'\);/g, '');
  fs.writeFileSync(f, c);
}
