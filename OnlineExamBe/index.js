const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const sql = require('mssql');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

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
        ep.DurationInMinutes,
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
      durationInMinutes: exam.DurationInMinutes,
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
            WHERE c.TeacherId = @teacherId AND c.IsDeleted = 0
          ) AS SessionCount,
          (SELECT COUNT(*)
             FROM ExamSessions es
             INNER JOIN Classrooms c ON c.Id = es.ClassroomId
            WHERE c.TeacherId = @teacherId AND c.IsDeleted = 0 AND es.EndTime >= GETDATE()
          ) AS UpcomingSessionCount
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
          ep.DurationInMinutes,
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
        ORDER BY es.StartTime DESC, es.Id DESC
      `);

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      summary: summaryResult.recordset[0],
      classrooms: recentClassroomsResult.recordset,
      examPapers: recentExamPapersResult.recordset,
      sessions: upcomingSessionsResult.recordset,
    });
  } catch (error) {
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
        ORDER BY es.StartTime DESC, es.Id DESC
      `);

    return res.json({
      teacher: sanitizeUser(teacherCheck.recordset[0]),
      sessions: sessionsResult.recordset,
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
        SELECT TOP 1 Id
        FROM ExamPapers
        WHERE Id = @examPaperId
          AND TeacherId = @teacherId
          AND IsDeleted = 0
      `);

    if (examCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Exam paper not found or not owned by teacher.' });
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
      `);

    return res.status(201).json({
      message: 'Tạo ca thi thành công.',
      session: detailResult.recordset[0] || created,
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

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});