require('dotenv').config({ override: true });
const sql = require('mssql');
const { syncDocument } = require('./services/meilisearchService');

async function syncAll() {
  console.log('Starting full sync to Meilisearch...');
  
  const pool = await sql.connect({
    server: process.env.DB_SERVER || 'localhost',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'OnlineExam',
    options: { encrypt: false, trustServerCertificate: true }
  });

  // Sync Classrooms
  const classResult = await pool.request().query('SELECT * FROM Classrooms');
  console.log(`Syncing ${classResult.recordset.length} classrooms...`);
  for (const c of classResult.recordset) {
    await syncDocument('classrooms', {
      id: c.Id,
      ClassName: c.ClassName,
      JoinCode: c.JoinCode,
      TeacherId: c.TeacherId,
      IsDeleted: c.IsDeleted
    }).catch(() => {});
  }

  // Sync ExamPapers
  const examResult = await pool.request().query('SELECT * FROM ExamPapers');
  console.log(`Syncing ${examResult.recordset.length} exam papers...`);
  for (const e of examResult.recordset) {
    await syncDocument('exampapers', {
      id: e.Id,
      Title: e.Title,
      DurationInMinutes: e.DurationInMinutes,
      Subject: e.Subject,
      IsDraft: e.IsDraft,
      TeacherId: e.TeacherId,
      IsDeleted: e.IsDeleted
    }).catch(() => {});
  }

  // Sync ExamSessions
  const sessionResult = await pool.request().query(`
    SELECT es.*, c.ClassName, ep.Title as ExamTitle
    FROM ExamSessions es
    LEFT JOIN Classrooms c ON es.ClassroomId = c.Id
    LEFT JOIN ExamPapers ep ON es.ExamPaperId = ep.Id
  `);
  console.log(`Syncing ${sessionResult.recordset.length} exam sessions...`);
  for (const s of sessionResult.recordset) {
    await syncDocument('examsessions', {
      id: s.Id,
      SessionName: s.SessionName,
      ClassName: s.ClassName,
      JoinCode: s.JoinCode,
      ExamTitle: s.ExamTitle,
      ClassroomId: s.ClassroomId,
      ExamPaperId: s.ExamPaperId,
      StartTime: s.StartTime,
      EndTime: s.EndTime,
      DurationInMinutes: s.DurationInMinutes,
      IsDeleted: s.IsDeleted
    }).catch(() => {});
  }

  console.log('Sync complete!');
  process.exit(0);
}

syncAll().catch(err => {
  console.error(err);
  process.exit(1);
});
