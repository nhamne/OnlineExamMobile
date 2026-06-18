const fs = require('fs');

let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

// 1. POST /api/dashboard/teacher/:userId/exams
// Look for return res.status(201).json({ examPaper: { ...examPaper, QuestionCount: normalizedQuestions.length } });
code = code.replace(
  /return res\.status\(201\)\.json\(\{\s*examPaper: \{\s*\.\.\.examPaper,\s*QuestionCount: normalizedQuestions\.length,\s*\},\s*\}\);/g,
  `try { await syncDocument('exampapers', { id: examPaper.Id, Title: examPaper.Title, DurationInMinutes: examPaper.DurationInMinutes, Subject: examPaper.Subject, IsDraft: examPaper.IsDraft, TeacherId: examPaper.TeacherId, IsDeleted: 0 }); } catch (e) { console.error('Meilisearch sync error:', e); }\n    return res.status(201).json({ examPaper: { ...examPaper, QuestionCount: normalizedQuestions.length } });`
);

// 2. PUT /api/dashboard/teacher/:userId/exams/:examId
// Look for return res.json({ examPaper: updatedExam });
code = code.replace(
  /return res\.json\(\{ examPaper: updatedExam \}\);/g,
  `try { await syncDocument('exampapers', { id: updatedExam.Id, Title: updatedExam.Title, DurationInMinutes: updatedExam.DurationInMinutes, Subject: updatedExam.Subject, IsDraft: updatedExam.IsDraft, TeacherId: updatedExam.TeacherId, IsDeleted: 0 }); } catch (e) { console.error('Meilisearch sync error:', e); }\n    return res.json({ examPaper: updatedExam });`
);

// 3. DELETE /api/dashboard/teacher/:userId/exams/:examId
// Look for return res.json({ ok: true }); in that block. 
// Note: we can just replace all 'return res.json({ ok: true });' with a deleteDocument if we are careful, but wait, there are multiple delete endpoints.
code = code.replace(
  /app\.delete\('\/api\/dashboard\/teacher\/:userId\/exams\/:examId',\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)return res\.json\(\{ ok: true \}\);/g,
  `app.delete('/api/dashboard/teacher/:userId/exams/:examId', async (req, res) => {$1try { await deleteDocument('exampapers', examId); } catch(e) {} \n    return res.json({ ok: true });`
);

// 4. POST /api/dashboard/teacher/:userId/sessions
// Look for return res.status(201).json({ session: sessionWithDetails.recordset[0] });
code = code.replace(
  /return res\.status\(201\)\.json\(\{ session: sessionWithDetails\.recordset\[0\] \}\);/g,
  `try { const s = sessionWithDetails.recordset[0]; await syncDocument('examsessions', { id: s.Id, SessionName: s.SessionName, ClassName: s.ClassName, JoinCode: s.JoinCode, ExamTitle: s.ExamTitle, ClassroomId: s.ClassroomId, ExamPaperId: s.ExamPaperId, StartTime: s.StartTime, EndTime: s.EndTime, DurationInMinutes: s.DurationInMinutes, IsDeleted: 0 }); } catch (e) { console.error('Meilisearch sync error:', e); }\n    return res.status(201).json({ session: sessionWithDetails.recordset[0] });`
);

// 5. PUT /api/dashboard/teacher/:userId/sessions/:sessionId
// Look for return res.json({ session: sessionWithDetails.recordset[0] });
// Wait, it is exactly the same response format.
code = code.replace(
  /app\.put\('\/api\/dashboard\/teacher\/:userId\/sessions\/:sessionId',\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)return res\.json\(\{ session: sessionWithDetails\.recordset\[0\] \}\);/g,
  `app.put('/api/dashboard/teacher/:userId/sessions/:sessionId', async (req, res) => {$1try { const s = sessionWithDetails.recordset[0]; await syncDocument('examsessions', { id: s.Id, SessionName: s.SessionName, ClassName: s.ClassName, JoinCode: s.JoinCode, ExamTitle: s.ExamTitle, ClassroomId: s.ClassroomId, ExamPaperId: s.ExamPaperId, StartTime: s.StartTime, EndTime: s.EndTime, DurationInMinutes: s.DurationInMinutes, IsDeleted: 0 }); } catch (e) { console.error('Meilisearch sync error:', e); }\n    return res.json({ session: sessionWithDetails.recordset[0] });`
);

// 6. DELETE /api/dashboard/teacher/:userId/sessions/:sessionId
// Look for return res.json({ ok: true }); in that block.
code = code.replace(
  /app\.delete\('\/api\/dashboard\/teacher\/:userId\/sessions\/:sessionId',\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)return res\.json\(\{ ok: true \}\);/g,
  `app.delete('/api/dashboard/teacher/:userId/sessions/:sessionId', async (req, res) => {$1try { await deleteDocument('examsessions', sessionId); } catch(e) {} \n    return res.json({ ok: true });`
);

fs.writeFileSync('OnlineExamBe/index.js', code);
console.log('Fixed search logic');
