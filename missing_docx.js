app.get('/api/dashboard/teacher/:userId/exams/:examId/export-docx', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(examId) || examId <= 0) {
      return res.status(400).json({ message: 'Invalid examId.' });
    }

    const pool = await getPool();

    const examResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1
          ep.Id,
          ep.Title,
          ep.Subject,
          ep.DurationInMinutes,
          ep.CreatedAt,
          ep.IsDraft
        FROM ExamPapers ep
        WHERE ep.Id = @examId AND ep.TeacherId = @teacherId AND ep.IsDeleted = 0
      `);

    if (examResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const questionsResult = await pool
      .request()
      .input('examId', sql.Int, examId)
      .query(`
        SELECT
          q.Id,
          q.Content,
          q.OptionA,
          q.OptionB,
          q.OptionC,
          q.OptionD,
          q.CorrectOption
        FROM Questions q
        WHERE q.ExamPaperId = @examId
        ORDER BY q.Id ASC
      `);

    const exam = examResult.recordset[0];
    const questions = questionsResult.recordset;
    const filename = `exam-${exam.Id}.docx`;

    const paragraphs = [];
    paragraphs.push(
      new Paragraph({
        text: exam.Title || 'Exam Paper',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(`Subject: ${exam.Subject || '--'}`)],
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [new TextRun(`Duration: ${exam.DurationInMinutes || 0} minutes`)],
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [new TextRun(`Status: ${exam.IsDraft ? 'Draft' : 'Published'}`)],
        spacing: { after: 200 },
      })
    );

    questions.forEach((q, index) => {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(`${index + 1}. ${q.Content || ''}`)],
          spacing: { after: 120 },
        })
      );
      paragraphs.push(new Paragraph({ text: `A. ${q.OptionA || ''}` }));
      paragraphs.push(new Paragraph({ text: `B. ${q.OptionB || ''}` }));
      paragraphs.push(new Paragraph({ text: `C. ${q.OptionC || ''}` }));
      paragraphs.push(new Paragraph({ text: `D. ${q.OptionD || ''}` }));
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(`Correct: ${q.CorrectOption || '--'}`)],
          spacing: { after: 200 },
        })
      );
    });