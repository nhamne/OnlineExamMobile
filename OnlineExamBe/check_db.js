const sql = require('mssql');
const config = {
  server: 'localhost',
  user: 'sa',
  password: '1234',
  database: 'OnlineExamDB',
  port: 1433,
  options: { encrypt: false, trustServerCertificate: true }
};
sql.connect(config)
  .then(pool => pool.request().query("SELECT Email, PasswordHash FROM Users WHERE Email IN ('teacher1@edu.vn', 'teacher2@edu.vn')"))
  .then(res => { console.log(res.recordset); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
