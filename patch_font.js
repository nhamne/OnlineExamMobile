const fs = require('fs');

let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

const replacement = `    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    try {
      doc.registerFont('Arial', 'C:\\\\Windows\\\\Fonts\\\\arial.ttf');
      doc.font('Arial');
    } catch (e) {
      console.error('Font Arial not found, fallback to default', e);
    }`;

// Replace ignoring \r
const regex = /const doc = new PDFDocument\(\{\s*margin:\s*50\s*\}\);\s*doc\.pipe\(res\);/g;

if (regex.test(code) && !code.includes('doc.registerFont')) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('OnlineExamBe/index.js', code);
    console.log('Patched PDF font');
} else {
    console.log('Already patched or not found');
}
