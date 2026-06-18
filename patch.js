const fs = require('fs');
let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

// Insert for ExamPapers at 1372
code = code.replace(
  'const examPaper = examResult.recordset[0];',
  `const examPaper = examResult.recordset[0];
    await syncDocument('exampapers', { id: examPaper.Id, Title: examPaper.Title, DurationInMinutes: examPaper.DurationInMinutes, Subject: examPaper.Subject, IsDraft: examPaper.IsDraft, TeacherId: userId, IsDeleted: 0 }).catch(()=>{});`
);

// Insert for ExamPapers at 1889
code = code.replace(
  'const newExam = insertExamResult.recordset[0];',
  `const newExam = insertExamResult.recordset[0];
    await syncDocument('exampapers', { id: newExam.Id, Title: newExam.Title, DurationInMinutes: newExam.DurationInMinutes, Subject: newExam.Subject, IsDraft: newExam.IsDraft, TeacherId: userId, IsDeleted: 0 }).catch(()=>{});`
);

// Update for ExamPapers at 1665
code = code.replace(
  'WHERE Id = @examId\n      `);\n\n    await pool',
  `WHERE Id = @examId
      \`);
      
    await syncDocument('exampapers', { id: Number(examId), Title: title, DurationInMinutes: Number(duration), Subject: subject, IsDraft: isDraft, TeacherId: userId, IsDeleted: 0 }).catch(()=>{});

    await pool`
);

// Soft delete ExamPapers at 1829
code = code.replace(
  'WHERE Id = @examId\n      `);\n\n    return res.json({ ok: true });',
  `WHERE Id = @examId
      \`);
    await deleteDocument('exampapers', Number(examId)).catch(()=>{});
    return res.json({ ok: true });`
);

fs.writeFileSync('OnlineExamBe/index.js', code);
console.log('Patched ExamPapers sync!');
