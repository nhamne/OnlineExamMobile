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
  .then(pool => pool.request().query("UPDATE Users SET PasswordHash = 'password@123' WHERE Email = 'teacher1@edu.vn'"))
  .then(res => { console.log('Updated successfully'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
