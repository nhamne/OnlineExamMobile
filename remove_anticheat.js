const fs = require('fs');

function removeLines(file, pattern) {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split(/\r?\n/);
    const newLines = lines.filter(line => !pattern.test(line));
    fs.writeFileSync(file, newLines.join('\n'));
    console.log('Removed matching lines from', file);
}

function removeDbSqlLines() {
    const file = 'c:/OnlineExamMobile/db.sql';
    let data = fs.readFileSync(file, 'utf8');
    data = data.replace(/[ \t]*IsAntiCheatEnabled BIT DEFAULT 0,\r?\n/, '');
    
    // Remove the block
    const blockRegex = /IF COL_LENGTH\('ExamSessions', 'IsAntiCheatEnabled'\) IS NULL\r?\nBEGIN\r?\n    ALTER TABLE ExamSessions ADD IsAntiCheatEnabled BIT NOT NULL CONSTRAINT DF_ExamSessions_IsAntiCheatEnabled DEFAULT\(0\);\r?\nEND\r?\nGO\r?\n/g;
    data = data.replace(blockRegex, '');
    
    fs.writeFileSync(file, data);
    console.log('Cleaned db.sql');
}

removeLines('c:/OnlineExamMobile/OnlineExamBe/index.js', /IsAntiCheatEnabled/i);
removeDbSqlLines();
