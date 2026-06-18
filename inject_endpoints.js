const fs = require('fs');

const codeToInsert = `
// ==========================================
// NEW ENDPOINTS FOR STUDENT RESULTS
// ==========================================

// GET Student Results
app.get('/api/exam/student/results/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const pool = await getPool();
    const results = await pool.request()
      .input('userId', sql.Int, userId)
      .query(\`
        SELECT 
          s.Id AS AttemptId,
          es.Id AS ExamSessionId,
          s.Status,
          s.Score,
          s.CorrectAnswersCount,
          ep.Title AS ExamTitle,
          es.SessionName,
          c.ClassName,
          (SELECT COUNT(*) FROM Questions WHERE ExamPaperId = ep.Id AND IsDeleted = 0) AS TotalQuestions,
          s.SubmittedAt
        FROM Submissions s
        INNER JOIN ExamSessions es ON s.ExamSessionId = es.Id
        INNER JOIN ExamPapers ep ON es.ExamPaperId = ep.Id
        INNER JOIN Classrooms c ON es.ClassroomId = c.Id
        WHERE s.StudentId = @userId AND s.Status IN (1, 2)
          AND es.IsDeleted = 0 AND ep.IsDeleted = 0 AND c.IsDeleted = 0
        ORDER BY s.SubmittedAt DESC
      \`);
    res.json(results.recordset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET Result Detail
app.get('/api/exam/results/:attemptId/detail', async (req, res) => {
  try {
    const attemptId = Number(req.params.attemptId);
    const pool = await getPool();
    
    // Get basic submission info
    const subResult = await pool.request()
      .input('attemptId', sql.Int, attemptId)
      .query(\`
        SELECT s.Score, s.CorrectAnswersCount, es.AllowViewExplanation,
               es.IsShuffled, es.ShuffleQuestions, es.ShuffleAnswers,
               (SELECT COUNT(*) FROM Questions WHERE ExamPaperId = es.ExamPaperId AND IsDeleted = 0) as TotalQuestions
        FROM Submissions s
        INNER JOIN ExamSessions es ON s.ExamSessionId = es.Id
        WHERE s.Id = @attemptId
      \`);
      
    if (subResult.recordset.length === 0) return res.status(404).json({ message: 'Not found' });
    const sub = subResult.recordset[0];
    
    // Get questions and answers
    const qResult = await pool.request()
      .input('attemptId', sql.Int, attemptId)
      .query(\`
        SELECT 
          q.Id as id,
          q.Content as content,
          q.OptionA as optionA,
          q.OptionB as optionB,
          q.OptionC as optionC,
          q.OptionD as optionD,
          q.CorrectOption as correctAnswer,
          q.Explanation as explanation,
          sd.SelectedOption as studentAnswer
        FROM Questions q
        INNER JOIN ExamSessions es ON q.ExamPaperId = es.ExamPaperId
        INNER JOIN Submissions s ON s.ExamSessionId = es.Id
        LEFT JOIN SubmissionDetails sd ON sd.SubmissionId = s.Id AND sd.QuestionId = q.Id
        WHERE s.Id = @attemptId AND q.IsDeleted = 0
        ORDER BY q.Id ASC
      \`);
      
    const questions = qResult.recordset.map(q => ({
      id: q.id,
      content: q.content,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctAnswer,
      selectedOption: q.studentAnswer,
      isCorrect: q.correctAnswer === q.studentAnswer,
      explanation: q.explanation
    }));
    
    res.json({
      score: sub.Score,
      correctCount: sub.CorrectAnswersCount,
      totalQuestions: sub.TotalQuestions,
      allowViewExplanation: sub.AllowViewExplanation,
      isShuffled: sub.IsShuffled,
      shuffleQuestions: sub.ShuffleQuestions,
      shuffleAnswers: sub.ShuffleAnswers,
      questions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

\`;

let fileContent = fs.readFileSync('OnlineExamBe/index.js', 'utf8');
if (!fileContent.includes('/api/exam/student/results/:userId')) {
  fileContent = fileContent.replace('app.listen(PORT, HOST', codeToInsert + 'app.listen(PORT, HOST');
  fs.writeFileSync('OnlineExamBe/index.js', fileContent);
  console.log('Endpoints injected successfully!');
} else {
  console.log('Endpoints already exist!');
}
