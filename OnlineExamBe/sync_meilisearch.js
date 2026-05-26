require('dotenv').config();
const sql = require('mssql');
const { client } = require('./services/meilisearchService');

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

async function syncAll() {
  let pool;
  try {
    pool = await sql.connect(sqlConfig);
    console.log('Connected to SQL Server.');

    // 1. Sync ExamSessions
    console.log('Syncing ExamSessions...');
    const sessionsResult = await pool.request().query(`
      SELECT 
        es.Id as id, 
        es.SessionName, 
        c.ClassName, 
        c.JoinCode,
        ep.Title as ExamTitle,
        es.ClassroomId, 
        es.ExamPaperId, 
        es.StartTime, 
        es.EndTime, 
        es.DurationInMinutes, 
        es.IsDeleted 
      FROM ExamSessions es
      LEFT JOIN Classrooms c ON es.ClassroomId = c.Id
      LEFT JOIN ExamPapers ep ON es.ExamPaperId = ep.Id
      WHERE es.IsDeleted = 0
    `);
    if (sessionsResult.recordset.length > 0) {
      await client.index('examsessions').addDocuments(sessionsResult.recordset, { primaryKey: 'id' });
      await client.index('examsessions').updateSearchableAttributes(['SessionName', 'ClassName', 'ExamTitle', 'JoinCode']);
      console.log(`Synced ${sessionsResult.recordset.length} ExamSessions.`);
    }

    // 2. Sync ExamPapers
    console.log('Syncing ExamPapers...');
    const papersResult = await pool.request().query(`
      SELECT Id as id, Title, DurationInMinutes, Subject, IsDraft, TeacherId, IsDeleted 
      FROM ExamPapers
      WHERE IsDeleted = 0
    `);
    if (papersResult.recordset.length > 0) {
      await client.index('exampapers').addDocuments(papersResult.recordset, { primaryKey: 'id' });
      await client.index('exampapers').updateSearchableAttributes(['Title', 'Subject']);
      console.log(`Synced ${papersResult.recordset.length} ExamPapers.`);
    }

    // 3. Sync Classrooms
    console.log('Syncing Classrooms...');
    const classroomsResult = await pool.request().query(`
      SELECT Id as id, ClassName, JoinCode, TeacherId, IsDeleted 
      FROM Classrooms
      WHERE IsDeleted = 0
    `);
    if (classroomsResult.recordset.length > 0) {
      await client.index('classrooms').addDocuments(classroomsResult.recordset, { primaryKey: 'id' });
      await client.index('classrooms').updateSearchableAttributes(['ClassName', 'JoinCode']);
      console.log(`Synced ${classroomsResult.recordset.length} Classrooms.`);
    }

    console.log('Sync completed successfully.');
  } catch (error) {
    console.error('Error syncing to Meilisearch:', error);
  } finally {
    if (pool) pool.close();
  }
}

syncAll();
