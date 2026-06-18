const fs = require('fs');

// Read the export-docx endpoint from old commit  
const oldLines = fs.readFileSync('old_index_f2f.js', 'utf16le').split('\n');
const startLine = 3648;
let endLine = startLine;
for(let i = startLine; i < oldLines.length; i++) {
  if(oldLines[i].trim() === '});' && i > startLine + 10) {
    endLine = i;
    break;
  }
}
const exportDocxCode = oldLines.slice(startLine, endLine + 1).join('\n');

// Read current index.js
let current = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

// Insert before app.listen
const listenMarker = "app.listen(PORT, HOST, () => {";
if (!current.includes('/api/dashboard/teacher/:userId/exams/:examId/export-docx')) {
  current = current.replace(
    listenMarker,
    exportDocxCode + '\n\n' + listenMarker
  );
  fs.writeFileSync('OnlineExamBe/index.js', current);
  console.log('Added export-docx endpoint (' + (endLine - startLine + 1) + ' lines)');
} else {
  console.log('export-docx already exists, skipping');
}
