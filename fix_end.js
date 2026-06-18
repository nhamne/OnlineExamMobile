const fs = require('fs');

let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

// The pattern uses \r\n line endings
const oldEnd = `    });\r\n\napp.listen(PORT, HOST, () => {\r\n  console.log(\`Server running at http://\${HOST}:\${PORT}\`);\r\n});\r\n`;

const newEnd = `    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = \`exam-\${exam.Id}.docx\`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
    res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(\`Server running at http://\${HOST}:\${PORT}\`);
});
`;

const lastIdx = code.lastIndexOf('    });\r\n\napp.listen');
console.log('lastIdx:', lastIdx);

if (lastIdx !== -1) {
  const before = code.substring(0, lastIdx);
  code = before + newEnd;
  fs.writeFileSync('OnlineExamBe/index.js', code);
  console.log('Fixed!');
} else {
  console.log('Not found');
}
