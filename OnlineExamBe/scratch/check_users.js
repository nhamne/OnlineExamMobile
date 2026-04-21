const sql = require('mssql');
require('dotenv').config();

const sqlConfig = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
  database: process.env.DB_NAME || 'OnlineExamDB',
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkUsers() {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request().query('SELECT Id, FullName, Email, Role FROM Users');
    console.log('Users in DB:', result.recordset);
    await pool.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();
