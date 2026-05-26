const fs = require('fs');
let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');
const lines = code.split('\n');
let newLines = [];
let inDuplicate = false;

for(let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const nodemailer = require('nodemailer');") && i > 600) {
    inDuplicate = true;
  }
  
  if (!inDuplicate) {
    newLines.push(lines[i]);
  }

  if (inDuplicate && lines[i].includes("app.get('/api/exams',")) {
    inDuplicate = false;
    newLines.push(lines[i]); // include the current line
  }
}

fs.writeFileSync('OnlineExamBe/index.js', newLines.join('\n'));
console.log('Fixed duplicate');
