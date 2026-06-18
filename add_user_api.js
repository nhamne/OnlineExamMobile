const fs = require('fs');

let code = fs.readFileSync('OnlineExamBe/index.js', 'utf8');

const profileEndpoints = `
// ==========================================
// USER PROFILE & PASSWORD
// ==========================================
app.put('/api/users/:userId/profile', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { fullName } = req.body; // ONLY allow updating fullName as per requirements

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid User ID.' });
    }

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: 'Tên hiển thị không được để trống.' });
    }

    const pool = await getPool();
    
    // Check if user exists
    const userCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT Id FROM Users WHERE Id = @userId');
      
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Update FullName
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('fullName', sql.NVarChar(255), fullName.trim())
      .query('UPDATE Users SET FullName = @fullName WHERE Id = @userId');
      
    // Fetch updated user to return
    const updatedUser = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT Id, FullName, Email, Role, IsActive FROM Users WHERE Id = @userId');

    return res.json({ 
      message: 'Cập nhật thông tin thành công.', 
      user: {
        id: updatedUser.recordset[0].Id,
        fullName: updatedUser.recordset[0].FullName,
        email: updatedUser.recordset[0].Email,
        role: updatedUser.recordset[0].Role
      } 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
});

app.put('/api/users/:userId/password', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { currentPassword, newPassword } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid User ID.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mới.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const pool = await getPool();
    
    // Check if user exists and get password hash
    const userCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT PasswordHash FROM Users WHERE Id = @userId');
      
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }
    
    const dbPasswordHash = userCheck.recordset[0].PasswordHash;
    
    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, dbPasswordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('passwordHash', sql.VarChar(255), newPasswordHash)
      .query('UPDATE Users SET PasswordHash = @passwordHash WHERE Id = @userId');

    return res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
});
`;

if (!code.includes('/api/users/:userId/profile')) {
  const listenMarker = 'app.listen(PORT, HOST, () => {';
  code = code.replace(listenMarker, profileEndpoints + '\n' + listenMarker);
  fs.writeFileSync('OnlineExamBe/index.js', code);
  console.log('Added endpoints');
} else {
  console.log('Already exists');
}
