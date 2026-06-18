const fs = require('fs');

let indexCode = fs.readFileSync('OnlineExamBe/index.js', 'utf8');
const docxCode = fs.readFileSync('missing_docx.js', 'utf8');

// 1. Re-add export-docx if missing
if (!indexCode.includes('export-docx')) {
  const listenMarker = 'app.listen(PORT, HOST, () => {';
  indexCode = indexCode.replace(listenMarker, docxCode + '\n\n' + listenMarker);
}

// 2. Fix PDF font
if (!indexCode.includes("doc.registerFont('Arial'")) {
  const pdfMarker = 'const doc = new PDFDocument({ margin: 50 });\n    doc.pipe(res);';
  const newPdfCode = `const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    
    // Register Arial font for UTF-8 (Vietnamese) support
    try {
      doc.registerFont('Arial', 'C:\\\\Windows\\\\Fonts\\\\arial.ttf');
      doc.font('Arial');
    } catch (e) {
      console.error('Font Arial not found, fallback to default', e);
    }`;
    
  indexCode = indexCode.replace(pdfMarker, newPdfCode);
}

fs.writeFileSync('OnlineExamBe/index.js', indexCode);
console.log('Fixed PDF font and restored export-docx.');
