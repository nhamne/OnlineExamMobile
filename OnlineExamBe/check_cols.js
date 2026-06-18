require('dotenv').config({ override: true });
const sql = require('mssql');
async function test() {
  const pool = await sql.connect({
    server: process.env.DB_SERVER || 'localhost',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'OnlineExam',
    options: { encrypt: false, trustServerCertificate: true }
  });
  const r = await pool.request().query('SELECT TOP 1 * FROM ExamSessions');
  console.log(Object.keys(r.recordset[0] || {}));
  process.exit(0);
}
test().catch(console.error);
