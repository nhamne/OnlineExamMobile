const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const sqlConfig = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
  database: process.env.DB_NAME || 'OnlineExamDB',
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'false') === 'true',
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERT || 'true') === 'true',
  },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig);
  }

  return poolPromise;
}

async function runSqlFile(filePath) {
  const sqlText = await fs.readFile(filePath, 'utf8');
  const batches = sqlText
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);

  const pool = await getPool();

  for (const batch of batches) {
    await pool.request().batch(batch);
  }
}

function mapRoleToDb(role) {
  if (!role) return null;
  const normalized = String(role).toLowerCase();
  if (normalized === 'teacher') return 'Teacher';
  if (normalized === 'student') return 'Student';
  return null;
}

function sanitizeUser(user) {
  return {
    id: user.Id,
    fullName: user.FullName,
    email: user.Email,
    role: String(user.Role).toLowerCase(),
  };
}

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment()}-${segment()}-${segment()}`;
}

async function createUniqueJoinCode(pool) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateJoinCode();
    const exists = await pool
      .request()
      .input('joinCode', sql.VarChar(20), candidate)
      .query('SELECT TOP 1 Id FROM Classrooms WHERE JoinCode = @joinCode');

    if (exists.recordset.length === 0) {
      return candidate;
    }
  }

  throw new Error('Cannot generate unique join code. Please retry.');
}

function shuffleArray(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildPreviewQuestions(questions, { isShuffled, shuffleQuestions, shuffleAnswers }) {
  const shouldShuffleQuestions = Boolean(isShuffled && shuffleQuestions);
  const shouldShuffleAnswers = Boolean(isShuffled && shuffleAnswers);

  const questionPool = shouldShuffleQuestions ? shuffleArray(questions) : [...questions];

  return questionPool.map((question, index) => {
    if (!shouldShuffleAnswers) {
      return {
        ...question,
        DisplayOrder: index + 1,
      };
    }

    const answerSlots = ['A', 'B', 'C', 'D'];
    const answers = shuffleArray([
      { originalKey: 'A', text: question.OptionA },
      { originalKey: 'B', text: question.OptionB },
      { originalKey: 'C', text: question.OptionC },
      { originalKey: 'D', text: question.OptionD },
    ]);

    let remappedCorrectOption = 'A';
    const remapped = {};
    answers.forEach((answer, idx) => {
      const newKey = answerSlots[idx];
      remapped[newKey] = answer.text;
      if (String(question.CorrectOption).toUpperCase() === answer.originalKey) {
        remappedCorrectOption = newKey;
      }
    });

    return {
      ...question,
      DisplayOrder: index + 1,
      OptionA: remapped.A,
      OptionB: remapped.B,
      OptionC: remapped.C,
      OptionD: remapped.D,
      CorrectOption: remappedCorrectOption,
    };
  });
}

function getPublicBaseUrl(req) {
  const explicit = String(process.env.PUBLIC_APP_URL || '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

function buildSessionAccessInfo(req, { sessionId, joinCode }) {
  const baseUrl = getPublicBaseUrl(req);
  const explicitStudentEntry = String(process.env.PUBLIC_STUDENT_EXAM_URL || '').trim();
  const encodedSessionId = encodeURIComponent(String(sessionId));
  const encodedJoinCode = joinCode ? encodeURIComponent(String(joinCode)) : '';
  const query = `sessionId=${encodedSessionId}${encodedJoinCode ? `&joinCode=${encodedJoinCode}` : ''}`;
  const sessionLink = explicitStudentEntry
    ? `${explicitStudentEntry}${explicitStudentEntry.includes('?') ? '&' : '?'}${query}`
    : `${baseUrl}/api/public/sessions/access?${query}`;

  return {
    sessionLink,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(sessionLink)}`,
  };
}

async function findOverlappingSession(pool, { teacherId, classroomId, startDate, endDate, excludeSessionId }) {
  const overlapResult = await pool
    .request()
    .input('teacherId', sql.Int, teacherId)
    .input('classroomId', sql.Int, classroomId)
    .input('startTime', sql.DateTime, startDate)
    .input('endTime', sql.DateTime, endDate)
    .input('excludeSessionId', sql.Int, Number.isInteger(excludeSessionId) ? excludeSessionId : null)
    .query(`
      SELECT TOP 1
        es.Id,
        es.SessionName,
        es.StartTime,
        es.EndTime
      FROM ExamSessions es
      INNER JOIN Classrooms c ON c.Id = es.ClassroomId
      WHERE c.TeacherId = @teacherId
        AND c.IsDeleted = 0
        AND es.IsDeleted = 0
        AND es.ClassroomId = @classroomId
        AND (@excludeSessionId IS NULL OR es.Id <> @excludeSessionId)
        AND es.StartTime < @endTime
        AND es.EndTime > @startTime
      ORDER BY es.StartTime ASC
    `);

  return overlapResult.recordset[0] || null;
}
function normalizeOcrQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((raw, index) => {
      const question = String(raw?.question || raw?.content || '').trim();
      const rawOptions = raw?.options;
      let options = [];

      if (Array.isArray(rawOptions)) {
        options = rawOptions.map((opt, optIndex) => {
          if (typeof opt === 'string') {
            return { label: String.fromCharCode(65 + optIndex), text: opt.trim() };
          }

          const label = String(opt?.label || '').trim().toUpperCase();
          const text = String(opt?.text || opt?.option || '').trim();
          return {
            label: label || String.fromCharCode(65 + optIndex),
            text,
          };
        });
      } else if (rawOptions && typeof rawOptions === 'object') {
        options = Object.entries(rawOptions).map(([label, text]) => ({
          label: String(label || '').trim().toUpperCase(),
          text: String(text || '').trim(),
        }));
      }

      const filteredOptions = options.filter((opt) => opt.text);
      const normalizedOptions = filteredOptions.map((opt, optIndex) => ({
        label: opt.label || String.fromCharCode(65 + optIndex),
        text: opt.text,
      }));

      let correctIndex = null;
      if (Number.isInteger(raw?.correctIndex)) {
        correctIndex = raw.correctIndex;
      } else if (raw?.correctOption) {
        const letter = String(raw.correctOption).trim().toUpperCase();
        const indexByLetter = normalizedOptions.findIndex((opt) => opt.label === letter);
        if (indexByLetter >= 0) correctIndex = indexByLetter;
      }

      return {
        number: raw?.number || index + 1,
        question,
        options: normalizedOptions,
        correctIndex,
      };
    })
    .filter((item) => item.question || item.options.length > 0);
}

app.post('/api/ai-ocr/parse', upload.single('file'), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'models/gemini-2.0-flash';

    if (!apiKey) {
      return res.status(500).json({ message: 'Missing GEMINI_API_KEY in env.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File upload is required.' });
    }

    const mimeType = req.file.mimetype;
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);

    if (!allowedMimeTypes.has(mimeType)) {
      return res.status(400).json({ message: 'Unsupported file type.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt =
      'Bạn là hệ thống OCR + trích xuất đề thi trắc nghiệm. Hãy đọc nội dung file và trả về JSON CHUAN theo mẫu: ' +
      '{"questions": [{"number": 1, "question": "...", "options": ["A...", "B...", "C...", "D..."], "correctOption": "A"}]}. ' +
      'Quy tắc: (1) Tách dung noi dung theo "Câu N:". (2) Dap an bat dau bang A/B/C/D. ' +
      '(3) Neu thay dau * hoặc ky hieu dung thi dien correctOption tuong ung, neu khong chac de rong. ' +
      '(4) Khong chen text ngoai JSON. (5) Tu sua loi OCR pho bien: "Cau"->"Câu", "O"->"0" khi la so, "I"->"1". ' +
      '(6) Neu thieu dap an, van tao mang options du so luong tim duoc.';

    const modelCandidates = Array.from(
      new Set([
        modelName,
        'models/gemini-2.0-flash',
        'models/gemini-2.0-flash-001',
        'models/gemini-2.5-flash',
        'models/gemini-flash-latest',
      ].filter(Boolean))
    );

    let rawText = '';
    let lastError = null;

    for (const candidate of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: candidate,
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        });

        const result = await model.generateContent([
          {
            inlineData: {
              data: req.file.buffer.toString('base64'),
              mimeType,
            },
          },
          { text: prompt },
        ]);

        rawText = result?.response?.text?.() || '';
        if (rawText) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!rawText) {
      return res.status(500).json({
        message: `Gemini model unavailable. Tried: ${modelCandidates.join(', ')}`,
        detail: lastError?.message,
      });
    }
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(500).json({ message: 'Gemini response is not valid JSON.', rawText });
    }

    const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
    const questions = normalizeOcrQuestions(rawQuestions);

    return res.json({ questions });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/', (_req, res) => {
  res.send('OnlineExam backend is running.');
});

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ ok: true, message: 'Database connected' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/setup-db', async (_req, res) => {
  try {
    const dbSqlPath = path.resolve(__dirname, '..', 'db.sql');
    const dataSqlPath = path.resolve(__dirname, '..', 'data.sql');

    await runSqlFile(dbSqlPath);
    await runSqlFile(dataSqlPath);

    res.json({ ok: true, message: 'Database schema and seed data applied.' });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: 'fullName, email, password, role are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 chars.' });
    }

    const dbRole = mapRoleToDb(role);
    if (!dbRole) {
      return res.status(400).json({ message: 'Role must be student or teacher.' });
    }

    const pool = await getPool();

    const existing = await pool
      .request()
      .input('email', sql.VarChar(255), String(email).trim().toLowerCase())
      .query('SELECT TOP 1 Id FROM Users WHERE Email = @email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await pool
      .request()
      .input('fullName', sql.NVarChar(255), String(fullName).trim())
      .input('email', sql.VarChar(255), String(email).trim().toLowerCase())
      .input('passwordHash', sql.VarChar(255), passwordHash)
      .input('role', sql.VarChar(50), dbRole)
      .query(`
        INSERT INTO Users (FullName, Email, PasswordHash, Role, IsActive)
        OUTPUT INSERTED.Id, INSERTED.FullName, INSERTED.Email, INSERTED.Role
        VALUES (@fullName, @email, @passwordHash, @role, 1)
      `);

    return res.status(201).json({
      message: 'Register success',
      user: sanitizeUser(insertResult.recordset[0]),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'email and password are required.' });
    }

    const dbRole = mapRoleToDb(role);
    if (role && !dbRole) {
      return res.status(400).json({ message: 'Role must be student or teacher.' });
    }

    const pool = await getPool();

    const result = await pool
      .request()
      .input('email', sql.VarChar(255), String(email).trim().toLowerCase())
      .query(`
        SELECT TOP 1 Id, FullName, Email, PasswordHash, Role, IsActive
        FROM Users
        WHERE Email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = result.recordset[0];
    if (!user.IsActive) {
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    let isMatch = false;
    if (String(user.PasswordHash).startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.PasswordHash);
    } else {
      isMatch = password === user.PasswordHash;
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (dbRole && String(user.Role).toLowerCase() !== dbRole.toLowerCase()) {
      return res.status(403).json({
        message:
          dbRole === 'Teacher'
            ? 'Tài khoản này không phải giáo viên.'
            : 'Tài khoản này không phải học sinh.',
      });
    }

    return res.json({
      message: 'Login success',
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/exams', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 50
        ep.Id,
        ep.Title,
        ep.Subject,
        ep.DurationInMinutes,
        ep.IsDraft,
        u.FullName AS TeacherName,
        ep.CreatedAt
      FROM ExamPapers ep
      INNER JOIN Users u ON u.Id = ep.TeacherId
      WHERE ep.IsDeleted = 0
      ORDER BY ep.CreatedAt DESC, ep.Id DESC
    `);

    const exams = result.recordset.map((exam) => ({
      id: exam.Id,
      title: exam.Title,
      subject: exam.Subject,
      durationInMinutes: exam.DurationInMinutes,
      isDraft: Boolean(exam.IsDraft),
      teacherName: exam.TeacherName,
      createdAt: exam.CreatedAt,
    }));

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const summaryResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM Classrooms WHERE TeacherId = @teacherId AND IsDeleted = 0) AS ClassroomCount,
          (SELECT COUNT(*) FROM ExamPapers WHERE TeacherId = @teacherId AND IsDeleted = 0) AS ExamPaperCount,
          (SELECT COUNT(*)
             FROM ExamSessions es
             INNER JOIN Classrooms c ON c.Id = es.ClassroomId
             INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
            WHERE c.TeacherId = @teacherId AND c.IsDeleted = 0 AND es.IsDeleted = 0 AND ep.IsDeleted = 0
          ) AS SessionCount,
          (SELECT COUNT(*)
             FROM ExamSessions es
             INNER JOIN Classrooms c ON c.Id = es.ClassroomId
             INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
            WHERE c.TeacherId = @teacherId AND c.IsDeleted = 0 AND es.IsDeleted = 0 AND ep.IsDeleted = 0 AND es.EndTime >= GETDATE()
          ) AS UpcomingSessionCount
      `);

    const statsResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT COUNT(*) AS TotalStudents
        FROM ClassroomMembers cm 
        INNER JOIN Classrooms c ON c.Id = cm.ClassroomId 
        WHERE c.TeacherId = @teacherId AND c.IsDeleted = 0
      `);

    const mostPopulousClassResult = await pool.request().input('teacherId', sql.Int, userId).query(`
      SELECT TOP 1 
        c.ClassName, 
        COUNT(cm.StudentId) AS StudentCount
      FROM Classrooms c
      LEFT JOIN ClassroomMembers cm ON c.Id = cm.ClassroomId
      WHERE c.TeacherId = @teacherId AND c.IsDeleted = 0
      GROUP BY c.Id, c.ClassName, c.CreatedAt
      ORDER BY StudentCount DESC, c.CreatedAt DESC, c.Id DESC
    `);

    const longestExamResult = await pool.request().input('teacherId', sql.Int, userId).query(`
      SELECT TOP 1 Title, DurationInMinutes
      FROM ExamPapers 
      WHERE TeacherId = @teacherId AND IsDeleted = 0
      ORDER BY DurationInMinutes DESC, CreatedAt DESC, Id DESC
    `);

    const mostQuestionsExamResult = await pool.request().input('teacherId', sql.Int, userId).query(`
      SELECT TOP 1 
        ep.Title, 
        (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount
      FROM ExamPapers ep 
      WHERE ep.TeacherId = @teacherId AND ep.IsDeleted = 0
      ORDER BY QuestionCount DESC, ep.CreatedAt DESC, ep.Id DESC
    `);

    const recentClassroomsResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 8
          c.Id,
          c.ClassName,
          c.JoinCode,
          c.CreatedAt,
          (SELECT COUNT(*) FROM ClassroomMembers cm WHERE cm.ClassroomId = c.Id) AS StudentCount
        FROM Classrooms c
        WHERE c.TeacherId = @teacherId
          AND c.IsDeleted = 0
        ORDER BY c.CreatedAt DESC, c.Id DESC
      `);

    const recentExamPapersResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 8
          ep.Id,
          ep.Title,
          ep.Subject,
          ep.DurationInMinutes,
          ep.IsDraft,
          ep.CreatedAt,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount
        FROM ExamPapers ep
        WHERE ep.TeacherId = @teacherId
          AND ep.IsDeleted = 0
        ORDER BY ep.CreatedAt DESC, ep.Id DESC
      `);

    const upcomingSessionsResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 10
          es.Id,
          es.SessionName,
          es.StartTime,
          es.EndTime,
          es.DurationInMinutes,
          c.ClassName,
          ep.Title AS ExamTitle
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE c.TeacherId = @teacherId
          AND c.IsDeleted = 0
          AND ep.IsDeleted = 0
          AND es.IsDeleted = 0
        ORDER BY es.StartTime DESC, es.Id DESC
      `);

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      summary: {
        ...summaryResult.recordset[0],
        TotalStudents: statsResult.recordset[0]?.TotalStudents || 0,
        MostPopulousClass: mostPopulousClassResult.recordset[0] || null,
        LongestExam: longestExamResult.recordset[0] || null,
        MostQuestionsExam: mostQuestionsExamResult.recordset[0] || null,
      },
      classrooms: recentClassroomsResult.recordset,
      examPapers: recentExamPapersResult.recordset,
      sessions: upcomingSessionsResult.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/dashboard/teacher/:userId/exams', async (req, res) => {
  let transaction;

  try {
    const userId = Number(req.params.userId);
    const title = String(req.body?.title || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const durationInMinutes = Number(req.body?.durationInMinutes);
    const status = String(req.body?.status || 'published').trim().toLowerCase();
    const questionsRaw = Array.isArray(req.body?.questions) ? req.body.questions : [];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Tên đề thi là bắt buộc.' });
    }

    if (!subject) {
      return res.status(400).json({ message: 'Môn học là bắt buộc.' });
    }

    if (!Number.isFinite(durationInMinutes) || durationInMinutes <= 0) {
      return res.status(400).json({ message: 'Thời gian thi không hợp lệ.' });
    }

    if (questionsRaw.length === 0) {
      return res.status(400).json({ message: 'Vui lòng nhập ít nhất 1 câu hỏi.' });
    }

    const isDraft = status === 'draft';
    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const normalizedQuestions = questionsRaw.map((item) => {
      const content = String(item?.content || item?.question || '').trim();
      const optionMap = { A: '', B: '', C: '', D: '' };

      if (Array.isArray(item?.options)) {
        item.options.forEach((opt) => {
          const label = String(opt?.label || '').trim().toUpperCase();
          if (optionMap[label] !== undefined) {
            optionMap[label] = String(opt?.text || '').trim();
          }
        });
      } else if (item?.options && typeof item.options === 'object') {
        ['A', 'B', 'C', 'D'].forEach((label) => {
          if (item.options[label] !== undefined) {
            optionMap[label] = String(item.options[label] || '').trim();
          }
        });
      }

      const correctOption = String(item?.correctOption || item?.correct || '').trim().toUpperCase();

      return {
        content,
        options: optionMap,
        correctOption,
      };
    });

    const invalidQuestion = normalizedQuestions.find((item) => {
      if (!item.content) return true;
      if (!['A', 'B', 'C', 'D'].includes(item.correctOption)) return true;
      return !item.options[item.correctOption];
    });

    if (invalidQuestion) {
      return res.status(400).json({ message: 'Câu hỏi hoặc đáp án đúng không hợp lệ.' });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const examResult = await new sql.Request(transaction)
      .input('title', sql.NVarChar(255), title)
      .input('subject', sql.NVarChar(255), subject)
      .input('duration', sql.Int, durationInMinutes)
      .input('teacherId', sql.Int, userId)
      .input('isDraft', sql.Bit, isDraft)
      .query(`
        INSERT INTO ExamPapers (Title, Subject, DurationInMinutes, TeacherId, IsDraft, IsDeleted)
        OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Subject, INSERTED.DurationInMinutes, INSERTED.CreatedAt, INSERTED.IsDraft
        VALUES (@title, @subject, @duration, @teacherId, @isDraft, 0)
      `);

    const examPaper = examResult.recordset[0];

    for (const question of normalizedQuestions) {
      await new sql.Request(transaction)
        .input('examPaperId', sql.Int, examPaper.Id)
        .input('content', sql.NVarChar(sql.MAX), question.content)
        .input('optionA', sql.NVarChar(sql.MAX), question.options.A || '')
        .input('optionB', sql.NVarChar(sql.MAX), question.options.B || '')
        .input('optionC', sql.NVarChar(sql.MAX), question.options.C || '')
        .input('optionD', sql.NVarChar(sql.MAX), question.options.D || '')
        .input('correctOption', sql.Char(1), question.correctOption)
        .query(`
          INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption)
          VALUES (@examPaperId, @content, @optionA, @optionB, @optionC, @optionD, @correctOption)
        `);
    }

    await transaction.commit();

    return res.status(201).json({
      examPaper: {
        ...examPaper,
        QuestionCount: normalizedQuestions.length,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed', rollbackError);
      }
    }
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/classrooms', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const classroomsResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT
          c.Id,
          c.ClassName,
          c.JoinCode,
          c.TeacherId,
          u.FullName AS TeacherName,
          u.Email AS TeacherEmail,
          c.CreatedAt,
          c.IsDeleted,
          (SELECT COUNT(*) FROM ClassroomMembers cm WHERE cm.ClassroomId = c.Id) AS StudentCount
        FROM Classrooms c
        INNER JOIN Users u ON u.Id = c.TeacherId
        WHERE c.TeacherId = @teacherId
          AND c.IsDeleted = 0
        ORDER BY c.IsDeleted ASC, c.CreatedAt DESC, c.Id DESC
      `);

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      classrooms: classroomsResult.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/dashboard/teacher/:userId/classrooms', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const className = String(req.body?.className || '').trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!className) {
      return res.status(400).json({ message: 'Tên lớp học là bắt buộc.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const joinCode = await createUniqueJoinCode(pool);

    const createdResult = await pool
      .request()
      .input('className', sql.NVarChar(255), className)
      .input('joinCode', sql.VarChar(20), joinCode)
      .input('teacherId', sql.Int, userId)
      .query(`
        INSERT INTO Classrooms (ClassName, JoinCode, TeacherId, IsDeleted)
        OUTPUT INSERTED.Id, INSERTED.ClassName, INSERTED.JoinCode, INSERTED.TeacherId, INSERTED.CreatedAt, INSERTED.IsDeleted
        VALUES (@className, @joinCode, @teacherId, 0)
      `);

    const classroom = createdResult.recordset[0];
    return res.status(201).json({
      message: 'Tạo lớp học thành công.',
      classroom: {
        ...classroom,
        TeacherName: teacherCheck.recordset[0].FullName,
        TeacherEmail: teacherCheck.recordset[0].Email,
        StudentCount: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.put('/api/dashboard/teacher/:userId/classrooms/:classroomId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const classroomId = Number(req.params.classroomId);
    const className = String(req.body?.className || '').trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Invalid classroomId.' });
    }

    if (!className) {
      return res.status(400).json({ message: 'Tên lớp học là bắt buộc.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const updatedResult = await pool
      .request()
      .input('classroomId', sql.Int, classroomId)
      .input('teacherId', sql.Int, userId)
      .input('className', sql.NVarChar(255), className)
      .query(`
        UPDATE Classrooms
        SET ClassName = @className
        OUTPUT INSERTED.Id, INSERTED.ClassName, INSERTED.JoinCode, INSERTED.TeacherId, INSERTED.CreatedAt, INSERTED.IsDeleted
        WHERE Id = @classroomId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (updatedResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }

    const classroom = updatedResult.recordset[0];

    const studentCountResult = await pool
      .request()
      .input('classroomId', sql.Int, classroom.Id)
      .query('SELECT COUNT(*) AS StudentCount FROM ClassroomMembers WHERE ClassroomId = @classroomId');

    return res.json({
      message: 'Cập nhật lớp học thành công.',
      classroom: {
        ...classroom,
        TeacherName: teacherCheck.recordset[0].FullName,
        TeacherEmail: teacherCheck.recordset[0].Email,
        StudentCount: studentCountResult.recordset[0]?.StudentCount || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete('/api/dashboard/teacher/:userId/classrooms/:classroomId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const classroomId = Number(req.params.classroomId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Invalid classroomId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const deletedResult = await pool
      .request()
      .input('classroomId', sql.Int, classroomId)
      .input('teacherId', sql.Int, userId)
      .query(`
        UPDATE Classrooms
        SET IsDeleted = 1
        OUTPUT INSERTED.Id
        WHERE Id = @classroomId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (deletedResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }

    return res.json({
      message: 'Xóa lớp học thành công.',
      classroomId,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/classrooms/:classroomId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const classroomId = Number(req.params.classroomId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Invalid classroomId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const classroomResult = await pool
      .request()
      .input('classroomId', sql.Int, classroomId)
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1
          c.Id,
          c.ClassName,
          c.JoinCode,
          c.TeacherId,
          u.FullName AS TeacherName,
          u.Email AS TeacherEmail,
          c.CreatedAt,
          c.IsDeleted,
          (SELECT COUNT(*) FROM ClassroomMembers cm WHERE cm.ClassroomId = c.Id) AS StudentCount
        FROM Classrooms c
        INNER JOIN Users u ON u.Id = c.TeacherId
        WHERE c.Id = @classroomId
          AND c.TeacherId = @teacherId
          AND c.IsDeleted = 0
      `);

    if (classroomResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }

    const studentsResult = await pool
      .request()
      .input('classroomId', sql.Int, classroomId)
      .query(`
        SELECT
          u.Id,
          u.FullName,
          u.Email,
          cm.JoinedAt
        FROM ClassroomMembers cm
        INNER JOIN Users u ON u.Id = cm.StudentId
        WHERE cm.ClassroomId = @classroomId
          AND u.Role = 'Student'
        ORDER BY u.FullName ASC, u.Id ASC
      `);

    return res.json({
      classroom: classroomResult.recordset[0],
      students: studentsResult.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete('/api/dashboard/teacher/:userId/classrooms/:classroomId/students/:studentId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const classroomId = Number(req.params.classroomId);
    const studentId = Number(req.params.studentId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Invalid classroomId.' });
    }

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ message: 'Invalid studentId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const classroomCheck = await pool
      .request()
      .input('classroomId', sql.Int, classroomId)
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Classrooms
        WHERE Id = @classroomId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (classroomCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found.' });
    }

    const deleteResult = await pool
      .request()
      .input('classroomId', sql.Int, classroomId)
      .input('studentId', sql.Int, studentId)
      .query(`
        DELETE FROM ClassroomMembers
        OUTPUT DELETED.Id
        WHERE ClassroomId = @classroomId
          AND StudentId = @studentId
      `);

    if (deleteResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Student is not in this classroom.' });
    }

    return res.json({
      message: 'Xóa học sinh khỏi lớp thành công.',
      classroomId,
      studentId,
      removedCount: deleteResult.recordset.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/sessions', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const sessionsResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT
          es.Id,
          es.SessionName,
          es.ClassroomId,
          es.ExamPaperId,
          es.StartTime,
          es.EndTime,
          es.DurationInMinutes,
          es.SessionPassword,
          es.AllowViewExplanation,
          es.IsShuffled,
          es.ShuffleQuestions,
          es.ShuffleAnswers,
          es.Notes,
          c.ClassName,
          c.JoinCode,
          ep.Title AS ExamTitle,
          ep.DurationInMinutes AS ExamPaperDurationInMinutes,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id) AS SubmissionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id AND s.Status IN (1, 2)) AS SubmittedCount
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE c.TeacherId = @teacherId
          AND c.IsDeleted = 0
          AND ep.IsDeleted = 0
          AND es.IsDeleted = 0
        ORDER BY es.StartTime DESC, es.Id DESC
      `);

    const sessions = sessionsResult.recordset.map((session) => {
      const accessInfo = buildSessionAccessInfo(req, {
        sessionId: session.Id,
        joinCode: session.JoinCode,
      });

      return {
        ...session,
        SessionLink: accessInfo.sessionLink,
        QrImageUrl: accessInfo.qrImageUrl,
      };
    });

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      sessions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/session-detail/:sessionId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ message: 'Invalid sessionId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const sessionResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('sessionId', sql.Int, sessionId)
      .query(`
        SELECT TOP 1
          es.Id,
          es.SessionName,
          es.ClassroomId,
          es.ExamPaperId,
          es.StartTime,
          es.EndTime,
          es.DurationInMinutes,
          es.SessionPassword,
          es.AllowViewExplanation,
          es.IsShuffled,
          es.ShuffleQuestions,
          es.ShuffleAnswers,
          es.Notes,
          c.ClassName,
          c.JoinCode,
          ep.Title AS ExamTitle,
          ep.DurationInMinutes AS ExamPaperDurationInMinutes,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount,
          (SELECT COUNT(*) FROM ClassroomMembers cm WHERE cm.ClassroomId = c.Id) AS ClassroomStudentCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id) AS SubmissionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id AND s.Status IN (1, 2)) AS SubmittedCount
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE es.Id = @sessionId
          AND c.TeacherId = @teacherId
          AND c.IsDeleted = 0
          AND ep.IsDeleted = 0
          AND es.IsDeleted = 0
      `);

    if (sessionResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Session not found or not owned by teacher.' });
    }

    const studentRows = await pool
      .request()
      .input('sessionId', sql.Int, sessionId)
      .query(`
        SELECT
          u.Id,
          u.FullName,
          u.Email,
          latestSubmission.Id AS SubmissionId,
          latestSubmission.Status,
          latestSubmission.WarningCount,
          latestSubmission.Score,
          latestSubmission.CorrectAnswersCount,
          latestSubmission.StartedAt,
          latestSubmission.SubmittedAt,
          CASE
            WHEN latestSubmission.StartedAt IS NULL THEN NULL
            WHEN latestSubmission.SubmittedAt IS NULL THEN DATEDIFF(MINUTE, latestSubmission.StartedAt, GETDATE())
            ELSE DATEDIFF(MINUTE, latestSubmission.StartedAt, latestSubmission.SubmittedAt)
          END AS DurationInMinutes
        FROM ExamSessions es
        INNER JOIN ClassroomMembers cm ON cm.ClassroomId = es.ClassroomId
        INNER JOIN Users u ON u.Id = cm.StudentId AND u.Role = 'Student'
        OUTER APPLY (
          SELECT TOP 1
            s.Id,
            s.Status,
            s.WarningCount,
            s.Score,
            s.CorrectAnswersCount,
            s.StartedAt,
            s.SubmittedAt
          FROM Submissions s
          WHERE s.ExamSessionId = es.Id
            AND s.StudentId = u.Id
          ORDER BY ISNULL(s.SubmittedAt, s.StartedAt) DESC, s.Id DESC
        ) latestSubmission
        WHERE es.Id = @sessionId
        ORDER BY u.FullName ASC, u.Id ASC
      `);

    const sessionDetail = sessionResult.recordset[0];
    const accessInfo = buildSessionAccessInfo(req, {
      sessionId: sessionDetail.Id,
      joinCode: sessionDetail.JoinCode,
    });

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      session: {
        ...sessionDetail,
        SessionLink: accessInfo.sessionLink,
        QrImageUrl: accessInfo.qrImageUrl,
      },
      students: studentRows.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/sessions/form-options', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const classroomsResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT
          c.Id,
          c.ClassName,
          c.JoinCode,
          c.CreatedAt,
          (SELECT COUNT(*) FROM ClassroomMembers cm WHERE cm.ClassroomId = c.Id) AS StudentCount
        FROM Classrooms c
        WHERE c.TeacherId = @teacherId
          AND c.IsDeleted = 0
        ORDER BY c.CreatedAt DESC, c.Id DESC
      `);

    const examPapersResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT
          ep.Id,
          ep.Title,
          ep.DurationInMinutes,
          ep.CreatedAt,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount
        FROM ExamPapers ep
        WHERE ep.TeacherId = @teacherId
          AND ep.IsDeleted = 0
        ORDER BY ep.CreatedAt DESC, ep.Id DESC
      `);

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      classrooms: classroomsResult.recordset,
      examPapers: examPapersResult.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/dashboard/teacher/:userId/sessions/preview', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const sessionName = String(req.body?.sessionName || '').trim();
    const classroomId = Number(req.body?.classroomId);
    const examPaperId = Number(req.body?.examPaperId);
    const sessionPasswordRaw = req.body?.sessionPassword;
    const sessionPassword =
      sessionPasswordRaw === null || sessionPasswordRaw === undefined
        ? null
        : String(sessionPasswordRaw).trim() || null;
    const notesRaw = req.body?.notes;
    const notes = notesRaw === null || notesRaw === undefined ? null : String(notesRaw).trim() || null;
    const allowViewExplanation = Boolean(req.body?.allowViewExplanation);
    const isShuffled = Boolean(req.body?.isShuffled);
    const shuffleQuestions = Boolean(req.body?.shuffleQuestions);
    const shuffleAnswers = Boolean(req.body?.shuffleAnswers);
    const excludeSessionId = Number(req.body?.excludeSessionId);

    const startDate = new Date(req.body?.startTime);
    const endDate = new Date(req.body?.endTime);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!sessionName) {
      return res.status(400).json({ message: 'Tên ca thi là bắt buộc.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Lớp học tham gia là bắt buộc.' });
    }

    if (!Number.isInteger(examPaperId) || examPaperId <= 0) {
      return res.status(400).json({ message: 'Đề thi là bắt buộc.' });
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Giờ bắt đầu/kết thúc không hợp lệ.' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
    }

    if (startDate < new Date()) {
      return res.status(400).json({ message: 'Giờ bắt đầu không được ở trong quá khứ.' });
    }

    const durationInMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const classroomResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('classroomId', sql.Int, classroomId)
      .query(`
        SELECT TOP 1 Id, ClassName, JoinCode, CreatedAt
        FROM Classrooms
        WHERE Id = @classroomId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (classroomResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found or not owned by teacher.' });
    }

    const examResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examPaperId', sql.Int, examPaperId)
      .query(`
        SELECT TOP 1 Id, Title, DurationInMinutes, CreatedAt
        FROM ExamPapers
        WHERE Id = @examPaperId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (examResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const examDurationInMinutes = Number(examResult.recordset[0]?.DurationInMinutes || 0);
    if (durationInMinutes < examDurationInMinutes) {
      return res.status(400).json({
        message: `Thời lượng ca thi (${durationInMinutes} phút) không được nhỏ hơn thời lượng đề thi (${examDurationInMinutes} phút).`,
      });
    }

    const conflictSession = await findOverlappingSession(pool, {
      teacherId: userId,
      classroomId,
      startDate,
      endDate,
      excludeSessionId: Number.isInteger(excludeSessionId) && excludeSessionId > 0 ? excludeSessionId : null,
    });

    if (conflictSession) {
      return res.status(409).json({
        message: `Lớp đã có ca thi trùng thời gian (${conflictSession.SessionName}: ${new Date(
          conflictSession.StartTime
        ).toLocaleString('vi-VN', { hour12: false })} - ${new Date(conflictSession.EndTime).toLocaleString(
          'vi-VN',
          { hour12: false }
        )}).`,
      });
    }

    const questionsResult = await pool
      .request()
      .input('examPaperId', sql.Int, examPaperId)
      .query(`
        SELECT
          q.Id,
          q.Content,
          q.OptionA,
          q.OptionB,
          q.OptionC,
          q.OptionD,
          q.CorrectOption,
          q.Explanation
        FROM Questions q
        WHERE q.ExamPaperId = @examPaperId
        ORDER BY q.Id ASC
      `);

    const previewQuestions = buildPreviewQuestions(questionsResult.recordset, {
      isShuffled,
      shuffleQuestions,
      shuffleAnswers,
    });

    return res.json({
      preview: {
        sessionName,
        classroomId,
        examPaperId,
        startTime: startDate,
        endTime: endDate,
        durationInMinutes,
        sessionPassword,
        allowViewExplanation,
        isShuffled,
        shuffleQuestions,
        shuffleAnswers,
        notes,
      },
      classroom: classroomResult.recordset[0],
      examPaper: {
        ...examResult.recordset[0],
        QuestionCount: previewQuestions.length,
      },
      questions: previewQuestions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/dashboard/teacher/:userId/sessions', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const sessionName = String(req.body?.sessionName || '').trim();
    const classroomId = Number(req.body?.classroomId);
    const examPaperId = Number(req.body?.examPaperId);
    const sessionPasswordRaw = req.body?.sessionPassword;
    const sessionPassword =
      sessionPasswordRaw === null || sessionPasswordRaw === undefined
        ? null
        : String(sessionPasswordRaw).trim() || null;
    const notesRaw = req.body?.notes;
    const notes = notesRaw === null || notesRaw === undefined ? null : String(notesRaw).trim() || null;
    const allowViewExplanation = Boolean(req.body?.allowViewExplanation);
    const isShuffled = Boolean(req.body?.isShuffled);
    const shuffleQuestions = Boolean(req.body?.shuffleQuestions);
    const shuffleAnswers = Boolean(req.body?.shuffleAnswers);

    const startDate = new Date(req.body?.startTime);
    const endDate = new Date(req.body?.endTime);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!sessionName) {
      return res.status(400).json({ message: 'Tên ca thi là bắt buộc.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Lớp học tham gia là bắt buộc.' });
    }

    if (!Number.isInteger(examPaperId) || examPaperId <= 0) {
      return res.status(400).json({ message: 'Đề thi là bắt buộc.' });
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Giờ bắt đầu/kết thúc không hợp lệ.' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
    }

    if (startDate < new Date()) {
      return res.status(400).json({ message: 'Giờ bắt đầu không được ở trong quá khứ.' });
    }

    const durationInMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const classroomCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('classroomId', sql.Int, classroomId)
      .query(`
        SELECT TOP 1 Id
        FROM Classrooms
        WHERE Id = @classroomId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (classroomCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found or not owned by teacher.' });
    }

    const examCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examPaperId', sql.Int, examPaperId)
      .query(`
        SELECT TOP 1 Id, DurationInMinutes
        FROM ExamPapers
        WHERE Id = @examPaperId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const examDurationInMinutes = Number(examCheck.recordset[0]?.DurationInMinutes || 0);
    if (durationInMinutes < examDurationInMinutes) {
      return res.status(400).json({
        message: `Thời lượng ca thi (${durationInMinutes} phút) không được nhỏ hơn thời lượng đề thi (${examDurationInMinutes} phút).`,
      });
    }

    const conflictSession = await findOverlappingSession(pool, {
      teacherId: userId,
      classroomId,
      startDate,
      endDate,
    });

    if (conflictSession) {
      return res.status(409).json({
        message: `Lớp đã có ca thi trùng thời gian (${conflictSession.SessionName}: ${new Date(
          conflictSession.StartTime
        ).toLocaleString('vi-VN', { hour12: false })} - ${new Date(conflictSession.EndTime).toLocaleString(
          'vi-VN',
          { hour12: false }
        )}).`,
      });
    }

    const createdResult = await pool
      .request()
      .input('sessionName', sql.NVarChar(255), sessionName)
      .input('classroomId', sql.Int, classroomId)
      .input('examPaperId', sql.Int, examPaperId)
      .input('startTime', sql.DateTime, startDate)
      .input('endTime', sql.DateTime, endDate)
      .input('durationInMinutes', sql.Int, durationInMinutes)
      .input('sessionPassword', sql.VarChar(50), sessionPassword)
      .input('allowViewExplanation', sql.Bit, allowViewExplanation)
      .input('isShuffled', sql.Bit, isShuffled)
      .input('shuffleQuestions', sql.Bit, shuffleQuestions)
      .input('shuffleAnswers', sql.Bit, shuffleAnswers)
      .input('notes', sql.NVarChar(sql.MAX), notes)
      .query(`
        INSERT INTO ExamSessions (
          SessionName,
          ClassroomId,
          ExamPaperId,
          StartTime,
          EndTime,
          DurationInMinutes,
          SessionPassword,
          AllowViewExplanation,
          IsShuffled,
          ShuffleQuestions,
          ShuffleAnswers,
          Notes
        )
        OUTPUT
          INSERTED.Id,
          INSERTED.SessionName,
          INSERTED.ClassroomId,
          INSERTED.ExamPaperId,
          INSERTED.StartTime,
          INSERTED.EndTime,
          INSERTED.DurationInMinutes,
          INSERTED.SessionPassword,
          INSERTED.AllowViewExplanation,
          INSERTED.IsShuffled,
          INSERTED.ShuffleQuestions,
          INSERTED.ShuffleAnswers,
          INSERTED.Notes
        VALUES (
          @sessionName,
          @classroomId,
          @examPaperId,
          @startTime,
          @endTime,
          @durationInMinutes,
          @sessionPassword,
          @allowViewExplanation,
          @isShuffled,
          @shuffleQuestions,
          @shuffleAnswers,
          @notes
        )
      `);

    const created = createdResult.recordset[0];

    const detailResult = await pool
      .request()
      .input('sessionId', sql.Int, created.Id)
      .query(`
        SELECT TOP 1
          es.Id,
          es.SessionName,
          es.ClassroomId,
          es.ExamPaperId,
          es.StartTime,
          es.EndTime,
          es.DurationInMinutes,
          es.SessionPassword,
          es.AllowViewExplanation,
          es.IsShuffled,
          es.ShuffleQuestions,
          es.ShuffleAnswers,
          es.Notes,
          c.ClassName,
          c.JoinCode,
          ep.Title AS ExamTitle,
          ep.DurationInMinutes AS ExamPaperDurationInMinutes,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id) AS SubmissionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id AND s.Status IN (1, 2)) AS SubmittedCount
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE es.Id = @sessionId
          AND es.IsDeleted = 0
      `);

    const sessionDetail = detailResult.recordset[0] || created;
    const accessInfo = buildSessionAccessInfo(req, {
      sessionId: sessionDetail.Id,
      joinCode: sessionDetail.JoinCode,
    });

    return res.status(201).json({
      message: 'Tạo ca thi thành công.',
      session: {
        ...sessionDetail,
        SessionLink: accessInfo.sessionLink,
        QrImageUrl: accessInfo.qrImageUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.put('/api/dashboard/teacher/:userId/sessions/:sessionId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const sessionId = Number(req.params.sessionId);
    const sessionName = String(req.body?.sessionName || '').trim();
    const classroomId = Number(req.body?.classroomId);
    const examPaperId = Number(req.body?.examPaperId);
    const sessionPasswordRaw = req.body?.sessionPassword;
    const sessionPassword =
      sessionPasswordRaw === null || sessionPasswordRaw === undefined
        ? null
        : String(sessionPasswordRaw).trim() || null;
    const notesRaw = req.body?.notes;
    const notes = notesRaw === null || notesRaw === undefined ? null : String(notesRaw).trim() || null;
    const allowViewExplanation = Boolean(req.body?.allowViewExplanation);
    const isShuffled = Boolean(req.body?.isShuffled);
    const shuffleQuestions = Boolean(req.body?.shuffleQuestions);
    const shuffleAnswers = Boolean(req.body?.shuffleAnswers);

    const startDate = new Date(req.body?.startTime);
    const endDate = new Date(req.body?.endTime);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ message: 'Invalid sessionId.' });
    }

    if (!sessionName) {
      return res.status(400).json({ message: 'Tên ca thi là bắt buộc.' });
    }

    if (!Number.isInteger(classroomId) || classroomId <= 0) {
      return res.status(400).json({ message: 'Lớp học tham gia là bắt buộc.' });
    }

    if (!Number.isInteger(examPaperId) || examPaperId <= 0) {
      return res.status(400).json({ message: 'Đề thi là bắt buộc.' });
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Giờ bắt đầu/kết thúc không hợp lệ.' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
    }

    if (startDate < new Date()) {
      return res.status(400).json({ message: 'Giờ bắt đầu không được ở trong quá khứ.' });
    }

    const durationInMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const currentSessionResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('sessionId', sql.Int, sessionId)
      .query(`
        SELECT TOP 1 es.Id, es.StartTime, es.EndTime, es.IsDeleted
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        WHERE es.Id = @sessionId
          AND c.TeacherId = @teacherId
      `);

    if (currentSessionResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Session not found or not owned by teacher.' });
    }

    const currentSession = currentSessionResult.recordset[0];
    if (currentSession.IsDeleted) {
      return res.status(404).json({ message: 'Session not found or already deleted.' });
    }

    if (new Date(currentSession.StartTime) <= new Date()) {
      return res.status(400).json({ message: 'Chỉ có thể sửa ca thi sắp diễn ra.' });
    }

    const classroomResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('classroomId', sql.Int, classroomId)
      .query(`
        SELECT TOP 1 Id, ClassName, JoinCode, CreatedAt
        FROM Classrooms
        WHERE Id = @classroomId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (classroomResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Classroom not found or not owned by teacher.' });
    }

    const examResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examPaperId', sql.Int, examPaperId)
      .query(`
        SELECT TOP 1 Id, DurationInMinutes, Title
        FROM ExamPapers
        WHERE Id = @examPaperId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (examResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const examDurationInMinutes = Number(examResult.recordset[0]?.DurationInMinutes || 0);
    if (durationInMinutes < examDurationInMinutes) {
      return res.status(400).json({
        message: `Thời lượng ca thi (${durationInMinutes} phút) không được nhỏ hơn thời lượng đề thi (${examDurationInMinutes} phút).`,
      });
    }

    const conflictSession = await findOverlappingSession(pool, {
      teacherId: userId,
      classroomId,
      startDate,
      endDate,
      excludeSessionId: sessionId,
    });

    if (conflictSession) {
      return res.status(409).json({
        message: `Lớp đã có ca thi trùng thời gian (${conflictSession.SessionName}: ${new Date(
          conflictSession.StartTime
        ).toLocaleString('vi-VN', { hour12: false })} - ${new Date(conflictSession.EndTime).toLocaleString(
          'vi-VN',
          { hour12: false }
        )}).`,
      });
    }

    const updatedResult = await pool
      .request()
      .input('sessionId', sql.Int, sessionId)
      .input('teacherId', sql.Int, userId)
      .input('sessionName', sql.NVarChar(255), sessionName)
      .input('classroomId', sql.Int, classroomId)
      .input('examPaperId', sql.Int, examPaperId)
      .input('startTime', sql.DateTime, startDate)
      .input('endTime', sql.DateTime, endDate)
      .input('durationInMinutes', sql.Int, durationInMinutes)
      .input('sessionPassword', sql.VarChar(50), sessionPassword)
      .input('allowViewExplanation', sql.Bit, allowViewExplanation)
      .input('isShuffled', sql.Bit, isShuffled)
      .input('shuffleQuestions', sql.Bit, shuffleQuestions)
      .input('shuffleAnswers', sql.Bit, shuffleAnswers)
      .input('notes', sql.NVarChar(sql.MAX), notes)
      .query(`
        UPDATE es
        SET
          es.SessionName = @sessionName,
          es.ClassroomId = @classroomId,
          es.ExamPaperId = @examPaperId,
          es.StartTime = @startTime,
          es.EndTime = @endTime,
          es.DurationInMinutes = @durationInMinutes,
          es.SessionPassword = @sessionPassword,
          es.AllowViewExplanation = @allowViewExplanation,
          es.IsShuffled = @isShuffled,
          es.ShuffleQuestions = @shuffleQuestions,
          es.ShuffleAnswers = @shuffleAnswers,
          es.Notes = @notes
        OUTPUT
          INSERTED.Id,
          INSERTED.SessionName,
          INSERTED.ClassroomId,
          INSERTED.ExamPaperId,
          INSERTED.StartTime,
          INSERTED.EndTime,
          INSERTED.DurationInMinutes,
          INSERTED.SessionPassword,
          INSERTED.AllowViewExplanation,
          INSERTED.IsShuffled,
          INSERTED.ShuffleQuestions,
          INSERTED.ShuffleAnswers,
          INSERTED.Notes
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        WHERE es.Id = @sessionId
          AND c.TeacherId = @teacherId
          AND c.IsDeleted = 0
          AND es.IsDeleted = 0
      `);

    if (updatedResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Session not found or not owned by teacher.' });
    }

    const updated = updatedResult.recordset[0];
    const detailResult = await pool
      .request()
      .input('sessionId', sql.Int, updated.Id)
      .query(`
        SELECT TOP 1
          es.Id,
          es.SessionName,
          es.ClassroomId,
          es.ExamPaperId,
          es.StartTime,
          es.EndTime,
          es.DurationInMinutes,
          es.SessionPassword,
          es.AllowViewExplanation,
          es.IsShuffled,
          es.ShuffleQuestions,
          es.ShuffleAnswers,
          es.Notes,
          c.ClassName,
          c.JoinCode,
          ep.Title AS ExamTitle,
          ep.DurationInMinutes AS ExamPaperDurationInMinutes,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id) AS SubmissionCount,
          (SELECT COUNT(*) FROM Submissions s WHERE s.ExamSessionId = es.Id AND s.Status IN (1, 2)) AS SubmittedCount
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE es.Id = @sessionId
          AND es.IsDeleted = 0
      `);

    const sessionDetail = detailResult.recordset[0] || updated;
    const accessInfo = buildSessionAccessInfo(req, {
      sessionId: sessionDetail.Id,
      joinCode: sessionDetail.JoinCode,
    });

    return res.json({
      message: 'Cập nhật ca thi thành công.',
      session: {
        ...sessionDetail,
        SessionLink: accessInfo.sessionLink,
        QrImageUrl: accessInfo.qrImageUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete('/api/dashboard/teacher/:userId/sessions/:sessionId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ message: 'Invalid sessionId.' });
    }

    const pool = await getPool();

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    const deletedResult = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('sessionId', sql.Int, sessionId)
      .query(`
        UPDATE es
        SET es.IsDeleted = 1
        OUTPUT INSERTED.Id
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        WHERE es.Id = @sessionId
          AND c.TeacherId = @teacherId
          AND c.IsDeleted = 0
          AND es.IsDeleted = 0
          AND es.StartTime > GETDATE()
      `);

    if (deletedResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Session not found or cannot be deleted.' });
    }

    return res.json({
      message: 'Xóa ca thi thành công.',
      sessionId,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/student/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    const pool = await getPool();

    const studentCheck = await pool
      .request()
      .input('studentId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id, FullName, Email, Role, IsActive
        FROM Users
        WHERE Id = @studentId AND Role = 'Student'
      `);

    if (studentCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const summaryResult = await pool
      .request()
      .input('studentId', sql.Int, userId)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM ClassroomMembers WHERE StudentId = @studentId) AS JoinedClassroomCount,
          (SELECT COUNT(*) FROM Submissions WHERE StudentId = @studentId) AS SubmissionCount,
          (SELECT COUNT(*) FROM Submissions WHERE StudentId = @studentId AND Status = 1) AS SubmittedCount,
          (SELECT COUNT(*)
             FROM ExamSessions es
             INNER JOIN ClassroomMembers cm ON cm.ClassroomId = es.ClassroomId
            WHERE cm.StudentId = @studentId AND es.EndTime >= GETDATE()
          ) AS UpcomingSessionCount
      `);

    const upcomingSessionsResult = await pool
      .request()
      .input('studentId', sql.Int, userId)
      .query(`
        SELECT TOP 10
          es.Id,
          es.SessionName,
          es.StartTime,
          es.EndTime,
          es.DurationInMinutes,
          c.ClassName,
          ep.Title AS ExamTitle
        FROM ExamSessions es
        INNER JOIN ClassroomMembers cm ON cm.ClassroomId = es.ClassroomId
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE cm.StudentId = @studentId
          AND c.IsDeleted = 0
          AND ep.IsDeleted = 0
        ORDER BY es.StartTime DESC, es.Id DESC
      `);

    return res.json({
      summary: summaryResult.recordset[0],
      sessions: upcomingSessionsResult.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/public/sessions/access', async (req, res) => {
  try {
    const sessionId = Number(req.query.sessionId);
    const joinCode = String(req.query.joinCode || '').trim();

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ message: 'sessionId không hợp lệ.' });
    }

    const pool = await getPool();

    const sessionResult = await pool
      .request()
      .input('sessionId', sql.Int, sessionId)
      .query(`
        SELECT TOP 1
          es.Id,
          es.SessionName,
          es.StartTime,
          es.EndTime,
          es.SessionPassword,
          c.ClassName,
          c.JoinCode,
          ep.Title AS ExamTitle
        FROM ExamSessions es
        INNER JOIN Classrooms c ON c.Id = es.ClassroomId
        INNER JOIN ExamPapers ep ON ep.Id = es.ExamPaperId
        WHERE es.Id = @sessionId
          AND c.IsDeleted = 0
          AND ep.IsDeleted = 0
      `);

    if (sessionResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca thi.' });
    }

    const session = sessionResult.recordset[0];
    if (joinCode && String(session.JoinCode || '').toUpperCase() !== joinCode.toUpperCase()) {
      return res.status(403).json({ message: 'Link hoặc mã lớp không khớp với ca thi.' });
    }

    const now = new Date();
    const startTime = new Date(session.StartTime);
    const endTime = new Date(session.EndTime);
    const isUpcoming = now < startTime;
    const isClosed = now > endTime;
    const status = isUpcoming ? 'upcoming' : isClosed ? 'closed' : 'open';
    const message = isUpcoming
      ? 'Ca thi chưa bắt đầu.'
      : isClosed
        ? 'Ca thi đã kết thúc.'
        : 'Có thể vào ca thi.';

    const acceptHeader = String(req.headers.accept || '').toLowerCase();
    if (acceptHeader.includes('text/html')) {
      const escapedSessionName = String(session.SessionName || '--').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedClassName = String(session.ClassName || '--').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedExamTitle = String(session.ExamTitle || '--').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const statusColor = status === 'open' ? '#166534' : status === 'upcoming' ? '#1d4ed8' : '#b42318';
      const statusBg = status === 'open' ? '#dcfce7' : status === 'upcoming' ? '#dbeafe' : '#fee2e2';

      return res.send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truy cập ca thi</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f3f6fb; margin: 0; padding: 24px; color: #1f2937; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #dbe1ee; }
    .badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 999px; background: ${statusBg}; color: ${statusColor}; }
    h1 { margin: 12px 0 10px; font-size: 24px; }
    p { margin: 6px 0; }
    .muted { color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${message}</div>
    <h1>${escapedSessionName}</h1>
    <p><strong>Lớp:</strong> ${escapedClassName}</p>
    <p><strong>Đề thi:</strong> ${escapedExamTitle}</p>
    <p><strong>Bắt đầu:</strong> ${new Date(session.StartTime).toLocaleString('vi-VN', { hour12: false })}</p>
    <p><strong>Kết thúc:</strong> ${new Date(session.EndTime).toLocaleString('vi-VN', { hour12: false })}</p>
    <p class="muted">Vui lòng đăng nhập tài khoản học sinh trong ứng dụng để vào làm bài thi.</p>
  </div>
</body>
</html>`);
    }

    return res.json({
      message,
      canAccess: !isUpcoming && !isClosed,
      status,
      session,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});

app.get('/api/ai-ocr/models', async (_req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Missing GEMINI_API_KEY in env.' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        message: errorData?.error?.message || 'Failed to list Gemini models.',
      });
    }

    const data = await response.json();
    const modelNames = Array.isArray(data?.models)
      ? data.models.map((model) => model.name)
      : [];

    return res.json({ models: modelNames });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/exams/:examId', async (req, res) => {
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

    const teacherCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM Users
        WHERE Id = @teacherId AND Role = 'Teacher'
      `);

    if (teacherCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

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
          ep.IsDraft,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount
        FROM ExamPapers ep
        WHERE ep.Id = @examId
          AND ep.TeacherId = @teacherId
          AND ep.IsDeleted = 0
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

    return res.json({
      examPaper: examResult.recordset[0],
      questions: questionsResult.recordset,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete('/api/dashboard/teacher/:userId/exams/:examId/questions/:questionId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);
    const questionId = Number(req.params.questionId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(examId) || examId <= 0) {
      return res.status(400).json({ message: 'Invalid examId.' });
    }

    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ message: 'Invalid questionId.' });
    }

    const pool = await getPool();

    const examCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1 Id
        FROM ExamPapers
        WHERE Id = @examId AND TeacherId = @teacherId AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const deleteResult = await pool
      .request()
      .input('questionId', sql.Int, questionId)
      .input('examId', sql.Int, examId)
      .query(`
        DELETE FROM Questions
        WHERE Id = @questionId AND ExamPaperId = @examId
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/dashboard/teacher/:userId/exams/:examId/questions', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);
    const content = String(req.body?.content || '').trim();
    const optionA = String(req.body?.optionA || '').trim();
    const optionB = String(req.body?.optionB || '').trim();
    const optionC = String(req.body?.optionC || '').trim();
    const optionD = String(req.body?.optionD || '').trim();
    const correctOption = String(req.body?.correctOption || '').trim().toUpperCase();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(examId) || examId <= 0) {
      return res.status(400).json({ message: 'Invalid examId.' });
    }

    if (!content) {
      return res.status(400).json({ message: 'Nội dung câu hỏi là bắt buộc.' });
    }

    if (!optionA || !optionB || !optionC || !optionD) {
      return res.status(400).json({ message: 'Vui lòng nhập đủ 4 đáp án.' });
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return res.status(400).json({ message: 'Đáp án đúng không hợp lệ.' });
    }

    const pool = await getPool();

    const examCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1 Id
        FROM ExamPapers
        WHERE Id = @examId AND TeacherId = @teacherId AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const insertResult = await pool
      .request()
      .input('examId', sql.Int, examId)
      .input('content', sql.NVarChar(sql.MAX), content)
      .input('optionA', sql.NVarChar(sql.MAX), optionA)
      .input('optionB', sql.NVarChar(sql.MAX), optionB)
      .input('optionC', sql.NVarChar(sql.MAX), optionC)
      .input('optionD', sql.NVarChar(sql.MAX), optionD)
      .input('correctOption', sql.Char(1), correctOption)
      .query(`
        INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption)
        OUTPUT INSERTED.Id, INSERTED.ExamPaperId, INSERTED.Content, INSERTED.OptionA, INSERTED.OptionB, INSERTED.OptionC, INSERTED.OptionD, INSERTED.CorrectOption
        VALUES (@examId, @content, @optionA, @optionB, @optionC, @optionD, @correctOption)
      `);

    return res.status(201).json({ question: insertResult.recordset[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.put('/api/dashboard/teacher/:userId/exams/:examId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);
    const title = String(req.body?.title || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const durationInMinutes = Number(req.body?.durationInMinutes);
    const isDraft = Boolean(req.body?.isDraft);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(examId) || examId <= 0) {
      return res.status(400).json({ message: 'Invalid examId.' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Tên đề thi là bắt buộc.' });
    }

    if (!subject) {
      return res.status(400).json({ message: 'Môn học là bắt buộc.' });
    }

    if (!Number.isFinite(durationInMinutes) || durationInMinutes <= 0) {
      return res.status(400).json({ message: 'Thời gian thi không hợp lệ.' });
    }

    const pool = await getPool();

    const examCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1 Id
        FROM ExamPapers
        WHERE Id = @examId AND TeacherId = @teacherId AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const updateResult = await pool
      .request()
      .input('examId', sql.Int, examId)
      .input('title', sql.NVarChar(255), title)
      .input('subject', sql.NVarChar(255), subject)
      .input('duration', sql.Int, durationInMinutes)
      .input('isDraft', sql.Bit, isDraft)
      .query(`
        UPDATE ExamPapers
        SET Title = @title,
            Subject = @subject,
            DurationInMinutes = @duration,
            IsDraft = @isDraft
        WHERE Id = @examId
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(500).json({ message: 'Không thể cập nhật đề thi.' });
    }

    const examResult = await pool
      .request()
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1
          ep.Id,
          ep.Title,
          ep.Subject,
          ep.DurationInMinutes,
          ep.CreatedAt,
          ep.IsDraft,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount
        FROM ExamPapers ep
        WHERE ep.Id = @examId
      `);

    return res.json({ examPaper: examResult.recordset[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.put('/api/dashboard/teacher/:userId/exams/:examId/questions/:questionId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const examId = Number(req.params.examId);
    const questionId = Number(req.params.questionId);
    const content = String(req.body?.content || '').trim();
    const optionA = String(req.body?.optionA || '').trim();
    const optionB = String(req.body?.optionB || '').trim();
    const optionC = String(req.body?.optionC || '').trim();
    const optionD = String(req.body?.optionD || '').trim();
    const correctOption = String(req.body?.correctOption || '').trim().toUpperCase();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId.' });
    }

    if (!Number.isInteger(examId) || examId <= 0) {
      return res.status(400).json({ message: 'Invalid examId.' });
    }

    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ message: 'Invalid questionId.' });
    }

    if (!content) {
      return res.status(400).json({ message: 'Nội dung câu hỏi là bắt buộc.' });
    }

    if (!optionA || !optionB || !optionC || !optionD) {
      return res.status(400).json({ message: 'Vui lòng nhập đủ 4 đáp án.' });
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return res.status(400).json({ message: 'Đáp án đúng không hợp lệ.' });
    }

    const pool = await getPool();

    const examCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1 Id
        FROM ExamPapers
        WHERE Id = @examId AND TeacherId = @teacherId AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const updateResult = await pool
      .request()
      .input('questionId', sql.Int, questionId)
      .input('examId', sql.Int, examId)
      .input('content', sql.NVarChar(sql.MAX), content)
      .input('optionA', sql.NVarChar(sql.MAX), optionA)
      .input('optionB', sql.NVarChar(sql.MAX), optionB)
      .input('optionC', sql.NVarChar(sql.MAX), optionC)
      .input('optionD', sql.NVarChar(sql.MAX), optionD)
      .input('correctOption', sql.Char(1), correctOption)
      .query(`
        UPDATE Questions
        SET Content = @content,
            OptionA = @optionA,
            OptionB = @optionB,
            OptionC = @optionC,
            OptionD = @optionD,
            CorrectOption = @correctOption
        WHERE Id = @questionId AND ExamPaperId = @examId
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Question not found.' });
    }

    const questionResult = await pool
      .request()
      .input('questionId', sql.Int, questionId)
      .query(`
        SELECT TOP 1
          q.Id,
          q.Content,
          q.OptionA,
          q.OptionB,
          q.OptionC,
          q.OptionD,
          q.CorrectOption
        FROM Questions q
        WHERE q.Id = @questionId
      `);

    return res.json({ question: questionResult.recordset[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete('/api/dashboard/teacher/:userId/exams/:examId', async (req, res) => {
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

    const examCheck = await pool
      .request()
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1 Id
        FROM ExamPapers
        WHERE Id = @examId AND TeacherId = @teacherId AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const activeSessionsCheck = await pool
      .request()
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1 Id
        FROM ExamSessions
        WHERE ExamPaperId = @examId AND IsDeleted = 0
      `);

    if (activeSessionsCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Không thể xoá vì đề thi này đã được gán vào ca thi.' });
    }

    await pool
      .request()
      .input('examId', sql.Int, examId)
      .query(`
        UPDATE ExamPapers
        SET IsDeleted = 1
        WHERE Id = @examId
      `);

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/dashboard/teacher/:userId/exams/:examId/copy', async (req, res) => {
  const userId = Number(req.params.userId);
  const examId = Number(req.params.examId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid userId.' });
  }

  if (!Number.isInteger(examId) || examId <= 0) {
    return res.status(400).json({ message: 'Invalid examId.' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const examResult = await new sql.Request(transaction)
      .input('teacherId', sql.Int, userId)
      .input('examId', sql.Int, examId)
      .query(`
        SELECT TOP 1
          Id,
          Title,
          Subject,
          DurationInMinutes,
          IsDraft
        FROM ExamPapers
        WHERE Id = @examId AND TeacherId = @teacherId AND IsDeleted = 0
      `);

    if (examResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
    }

    const sourceExam = examResult.recordset[0];
    const newTitle = `${sourceExam.Title} (Sao chép)`;

    const insertExamResult = await new sql.Request(transaction)
      .input('title', sql.NVarChar(255), newTitle)
      .input('subject', sql.NVarChar(255), sourceExam.Subject)
      .input('duration', sql.Int, sourceExam.DurationInMinutes)
      .input('teacherId', sql.Int, userId)
      .input('isDraft', sql.Bit, sourceExam.IsDraft)
      .query(`
        INSERT INTO ExamPapers (Title, Subject, DurationInMinutes, TeacherId, IsDraft, IsDeleted)
        OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.Subject, INSERTED.DurationInMinutes, INSERTED.CreatedAt, INSERTED.IsDraft
        VALUES (@title, @subject, @duration, @teacherId, @isDraft, 0)
      `);

    const newExam = insertExamResult.recordset[0];

    await new sql.Request(transaction)
      .input('newExamId', sql.Int, newExam.Id)
      .input('examId', sql.Int, examId)
      .query(`
        INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption)
        SELECT @newExamId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption
        FROM Questions
        WHERE ExamPaperId = @examId
      `);

    await transaction.commit();

    const examWithCount = await pool
      .request()
      .input('examId', sql.Int, newExam.Id)
      .query(`
        SELECT TOP 1
          ep.Id,
          ep.Title,
          ep.Subject,
          ep.DurationInMinutes,
          ep.CreatedAt,
          ep.IsDraft,
          (SELECT COUNT(*) FROM Questions q WHERE q.ExamPaperId = ep.Id) AS QuestionCount
        FROM ExamPapers ep
        WHERE ep.Id = @examId
      `);

    return res.status(201).json({ examPaper: examWithCount.recordset[0] });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/dashboard/teacher/:userId/exams/:examId/export', async (req, res) => {
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
    const filename = `exam-${exam.Id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text(exam.Title || 'Exam Paper', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Subject: ${exam.Subject || '--'}`);
    doc.text(`Duration: ${exam.DurationInMinutes || 0} minutes`);
    doc.text(`Status: ${exam.IsDraft ? 'Draft' : 'Published'}`);
    doc.moveDown(1);

    questions.forEach((q, index) => {
      doc.fontSize(12).text(`${index + 1}. ${q.Content || ''}`);
      doc.moveDown(0.25);
      doc.fontSize(11).text(`A. ${q.OptionA || ''}`);
      doc.fontSize(11).text(`B. ${q.OptionB || ''}`);
      doc.fontSize(11).text(`C. ${q.OptionC || ''}`);
      doc.fontSize(11).text(`D. ${q.OptionD || ''}`);
      doc.fontSize(10).fillColor('#666666').text(`Correct: ${q.CorrectOption || '--'}`);
      doc.fillColor('#000000');
      doc.moveDown(0.75);
    });

    doc.end();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});