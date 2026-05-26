const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
  server: 'localhost',
  user: 'sa',
  password: '123',
  database: 'OnlineExamDB',
  port: 1433,
  options: { encrypt: false, trustServerCertificate: true }
};

async function migratePasswords() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT Id, Email, PasswordHash FROM Users");
    const users = result.recordset;

    let updatedCount = 0;
    for (const user of users) {
      // Nếu password chưa được hash bằng bcrypt (không bắt đầu bằng $2)
      if (!user.PasswordHash.startsWith('$2')) {
        // Đối với dữ liệu mẫu, ta coi chuỗi hiện tại là mật khẩu thô (hoặc ép về password@123 nếu là hash cũ)
        let plainText = user.PasswordHash;
        if (plainText.startsWith('AQAAAA')) {
            plainText = 'password@123';
        }
        
        const hashed = await bcrypt.hash(plainText, 10);
        await pool.request()
          .input('id', sql.Int, user.Id)
          .input('hash', sql.VarChar(255), hashed)
          .query("UPDATE Users SET PasswordHash = @hash WHERE Id = @id");
        
        console.log(`Updated hash for ${user.Email}`);
        updatedCount++;
      }
    }
    console.log(`Migration complete. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migratePasswords();
