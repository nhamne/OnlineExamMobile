require('dotenv').config({ override: true });
const sql = require('mssql');

async function check() {
  const pool = await sql.connect({
    server: process.env.DB_SERVER || 'localhost',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'OnlineExam',
    options: { encrypt: false, trustServerCertificate: true }
  });

  const r = await pool.request().query("SELECT GETDATE() as LocalTime, GETUTCDATE() as UTCTime");
  console.log(r.recordset);
  process.exit(0);
}

check().catch(console.error);
