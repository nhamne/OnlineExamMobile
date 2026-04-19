const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const sql = require('mssql');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});