const fs = require('fs');
const { execSync } = require('child_process');

try {
  const output = execSync('git show 473d565:OnlineExamBe/index.js', { encoding: 'utf8' });
  const lines = output.split('\n');
  const missing = lines.slice(1686, 2289).join('\n');
  
  let current = fs.readFileSync('OnlineExamBe/index.js', 'utf8');
  current = current.replace(
    "app.get('/api/dashboard/teacher/:userId/classrooms'", 
    missing + "\n\napp.get('/api/dashboard/teacher/:userId/classrooms'"
  );
  
  fs.writeFileSync('OnlineExamBe/index.js', current);
  console.log('Success');
} catch (e) {
  console.error(e);
}
