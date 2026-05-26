USE OnlineExamDB;
GO

-- 1. Insert Users (3 Teachers, 12 Students)
IF NOT EXISTS (SELECT 1 FROM Users)
BEGIN
    INSERT INTO Users (FullName, Email, PasswordHash, Role, IsActive) VALUES
    (N'Nguyễn Văn Giảng Viên', 'teacher1@edu.vn', 'password@123', 'Teacher', 1),
    (N'Trần Thị Cô Giáo', 'teacher2@edu.vn', 'password@123', 'Teacher', 1),
    (N'Lê Quốc Anh', 'teacher3@edu.vn', 'password@123', 'Teacher', 1),
    (N'Hoàng Nam Khánh', 'student1@edu.vn', 'password@123', 'Student', 1),
    (N'Nguyễn Thị Thùy Nhâm', 'student2@edu.vn', 'password@123', 'Student', 1),
    (N'Phạm Ngọc Nhi', 'student3@edu.vn', 'password@123', 'Student', 1),
    (N'Lê Minh Cường', 'student4@edu.vn', 'password@123', 'Student', 1),
    (N'Đỗ An Bình', 'student5@edu.vn', 'password@123', 'Student', 1),
    (N'Võ Gia Huy', 'student6@edu.vn', 'password@123', 'Student', 1),
    (N'Bùi Hải Yến', 'student7@edu.vn', 'password@123', 'Student', 1),
    (N'Phan Minh Tú', 'student8@edu.vn', 'password@123', 'Student', 1),
    (N'Đặng Ngọc Linh', 'student9@edu.vn', 'password@123', 'Student', 1),
    (N'Trịnh Khánh Vy', 'student10@edu.vn', 'password@123', 'Student', 1),
    (N'Ngô Đức Long', 'student11@edu.vn', 'password@123', 'Student', 1),
    (N'Phạm Tú Anh', 'student12@edu.vn', 'password@123', 'Student', 1);
END
GO

-- 2. Insert Classrooms
IF NOT EXISTS (SELECT 1 FROM Classrooms)
BEGIN
    INSERT INTO Classrooms (ClassName, JoinCode, TeacherId, IsDeleted) VALUES
    (N'Lập trình Web Nâng Cao - D18CNPM1', 'WEBNC1', 1, 0),
    (N'Cơ sở Dữ liệu - D18CNPM2', 'CSDL02', 2, 0),
    (N'Lập trình Java Cơ Bản - D18CNPM3', 'JAVA03', 3, 0),
    (N'Lập trình Python Cơ Bản - D18CNPM4', 'PYTHN4', 1, 0),
    (N'Thiết kế UI/UX - D18CNPM5', 'UIUX05', 2, 0);
END
GO

-- 3. Insert ClassroomMembers (Đảm bảo mỗi học sinh vào ít nhất 5 lớp hoặc có đủ ca thi)
-- Gán 12 học sinh vào cả 5 lớp để đảm bảo có đủ đề thi
IF NOT EXISTS (SELECT 1 FROM ClassroomMembers)
BEGIN
    INSERT INTO ClassroomMembers (ClassroomId, StudentId)
    SELECT c.Id, u.Id
    FROM Classrooms c, Users u
    WHERE u.Role = 'Student';
END
GO

-- 4. Insert ExamPapers (15 Đề thi mẫu)
IF NOT EXISTS (SELECT 1 FROM ExamPapers)
BEGIN
    INSERT INTO ExamPapers (Title, Subject, DurationInMinutes, TeacherId, IsDraft, IsDeleted) VALUES
    (N'Bài kiểm tra ASP.NET MVC Giữa kỳ', N'Lập trình Web', 45, 1, 0, 0),
    (N'Trắc nghiệm SQL Server Cơ bản', N'Cơ sở dữ liệu', 15, 2, 0, 0),
    (N'Bài tập Java OOP', N'Lập trình Java', 30, 3, 0, 0),
    (N'Quiz Python Cơ bản', N'Lập trình Python', 20, 1, 0, 0),
    (N'Thiết kế giao diện UI/UX', N'Thiết kế đồ họa', 25, 2, 0, 0),
    (N'CTDL & GT Cơ bản', N'Cấu trúc dữ liệu', 45, 3, 0, 0),
    (N'Toán rời rạc 1', N'Toán học', 30, 1, 0, 0),
    (N'Mạng máy tính 1', N'Mạng máy tính', 35, 2, 0, 0),
    (N'An toàn thông tin 1', N'An toàn thông tin', 30, 3, 0, 0),
    (N'Hệ điều hành 1', N'Hệ điều hành', 40, 1, 0, 0),
    (N'Nhập môn AI 1', N'Trí tuệ nhân tạo', 25, 2, 0, 0),
    (N'Kiểm thử phần mềm 1', N'Kiểm thử', 30, 3, 0, 0),
    (N'Phân tích hệ thống 1', N'Phân tích hệ thống', 35, 1, 0, 0),
    (N'CSDL nâng cao 1', N'Cơ sở dữ liệu', 40, 2, 0, 0),
    (N'Web Frontend React 1', N'Lập trình Web', 30, 1, 0, 0);
END
GO

-- 5. Insert Questions (Mỗi bài kiểm tra 10 câu hỏi)
IF NOT EXISTS (SELECT 1 FROM Questions)
BEGIN
    -- ExamPaperId = 1
    INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption, Explanation) VALUES
    (1, N'MVC là gì?', N'Model View Control', N'Model View Controller', N'Module View Controller', N'Main View Controller', 'B', N'MVC là Model-View-Controller'),
    (1, N'View trong MVC dùng để làm gì?', N'Xử lý logic', N'Kết nối DB', N'Hiển thị giao diện', N'Điều hướng', 'C', N'View dùng để hiển thị'),
    (1, N'Controller trong MVC dùng để làm gì?', N'Hiển thị', N'Lưu dữ liệu', N'Điều phối yêu cầu', N'Định dạng text', 'C', N'Controller điều phối logic'),
    (1, N'ASP.NET MVC thuộc về hãng nào?', N'Google', N'Apple', N'Microsoft', N'Facebook', 'C', N'Của Microsoft'),
    (1, N'Razor là gì?', N'Một ngôn ngữ lập trình', N'Một View Engine', N'Một trình duyệt', N'Một DB', 'B', N'Razor là View Engine'),
    (1, N'Routing trong ASP.NET MVC dùng để làm gì?', N'Bảo mật', N'Định tuyến URL', N'Lưu cache', N'Nén file', 'B', N'Routing định tuyến URL'),
    (1, N'Action Method là gì?', N'Phương thức trong View', N'Phương thức trong Controller', N'Một Class', N'Một Attribute', 'B', N'Action nằm trong Controller'),
    (1, N'ViewBag dùng để làm gì?', N'Lưu Session', N'Truyền dữ liệu qua View', N'Lưu Cookie', N'Kết nối DB', 'B', N'Truyền dữ liệu từ Controller sang View'),
    (1, N'Entity Framework là gì?', N'Một thư viện UI', N'Một ORM', N'Một Web Server', N'Một trình biên dịch', 'B', N'EF là một ORM'),
    (1, N'Middleware là gì?', N'Phần mềm trung gian', N'Giao diện người dùng', N'Hệ điều hành', N'Trình quản lý gói', 'A', N'Middleware là phần mềm trung gian');

    -- ExamPaperId = 2
    INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption, Explanation) VALUES
    (2, N'SQL là gì?', N'Structured Query Language', N'Strong Query Language', N'Simple Query Language', N'Smart Query Language', 'A', N'SQL là ngôn ngữ truy vấn có cấu trúc'),
    (2, N'Câu lệnh nào dùng để lấy dữ liệu?', N'UPDATE', N'DELETE', N'SELECT', N'INSERT', 'C', N'SELECT để lấy dữ liệu'),
    (2, N'Khóa chính (Primary Key) là gì?', N'Khóa chứa giá trị trùng', N'Khóa định danh duy nhất', N'Khóa để bảo mật', N'Khóa để nén', 'B', N'Định danh duy nhất'),
    (2, N'Lệnh JOIN dùng để làm gì?', N'Xóa bảng', N'Kết hợp các bảng', N'Tạo bảng mới', N'Đổi tên bảng', 'B', N'Kết hợp bảng dựa trên quan hệ'),
    (2, N'Mệnh đề WHERE dùng để làm gì?', N'Sắp xếp', N'Gom nhóm', N'Lọc dữ liệu', N'Tính tổng', 'C', N'WHERE để lọc dữ liệu'),
    (2, N'Kiểu dữ liệu INT dùng để lưu gì?', N'Chuỗi', N'Ngày tháng', N'Số nguyên', N'Số thực', 'C', N'INT lưu số nguyên'),
    (2, N'Để sắp xếp kết quả ta dùng?', N'GROUP BY', N'ORDER BY', N'HAVING', N'LIMIT', 'B', N'ORDER BY để sắp xếp'),
    (2, N'Hàm COUNT() dùng để làm gì?', N'Tính tổng', N'Tính trung bình', N'Đếm số dòng', N'Tìm giá trị lớn nhất', 'C', N'COUNT dùng để đếm'),
    (2, N'INDEX trong SQL giúp làm gì?', N'Tăng dung lượng', N'Tăng tốc độ truy vấn', N'Bảo mật dữ liệu', N'Xóa dữ liệu cũ', 'B', N'INDEX giúp truy vấn nhanh hơn'),
    (2, N'FOREIGN KEY dùng để làm gì?', N'Định danh bảng', N'Tạo quan hệ giữa các bảng', N'Lưu mật khẩu', N'Mã hóa', 'B', N'Khóa ngoại tạo quan hệ tham chiếu');

    -- Thêm câu hỏi cho các đề khác (3-15) - Mỗi đề 10 câu
    DECLARE @i INT = 3;
    WHILE @i <= 15
    BEGIN
        INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption, Explanation) VALUES
        (@i, N'Câu hỏi số 1 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'A', N'Giải thích cho câu 1'),
        (@i, N'Câu hỏi số 2 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'B', N'Giải thích cho câu 2'),
        (@i, N'Câu hỏi số 3 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'C', N'Giải thích cho câu 3'),
        (@i, N'Câu hỏi số 4 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'D', N'Giải thích cho câu 4'),
        (@i, N'Câu hỏi số 5 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'A', N'Giải thích cho câu 5'),
        (@i, N'Câu hỏi số 6 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'B', N'Giải thích cho câu 6'),
        (@i, N'Câu hỏi số 7 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'C', N'Giải thích cho câu 7'),
        (@i, N'Câu hỏi số 8 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'D', N'Giải thích cho câu 8'),
        (@i, N'Câu hỏi số 9 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'A', N'Giải thích cho câu 9'),
        (@i, N'Câu hỏi số 10 của đề ' + CAST(@i AS NVARCHAR), N'Đáp án A', N'Đáp án B', N'Đáp án C', N'Đáp án D', 'B', N'Giải thích cho câu 10');
        SET @i = @i + 1;
    END
END
GO

-- 6. Insert ExamSessions (Đảm bảo mỗi sinh viên thấy ít nhất 5 ca thi)
IF NOT EXISTS (SELECT 1 FROM ExamSessions)
BEGIN
    INSERT INTO ExamSessions (SessionName, ClassroomId, ExamPaperId, StartTime, EndTime, DurationInMinutes, SessionPassword, AllowViewExplanation, IsShuffled, ShuffleQuestions, ShuffleAnswers, Notes, IsDeleted) VALUES
    (N'Kiểm tra Web Giữa kỳ', 1, 1, DATEADD(hour, -2, GETDATE()), DATEADD(hour, 2, GETDATE()), 45, '123', 1, 1, 1, 1, N'Thi nghiêm túc', 0),
    (N'Kiểm tra CSDL 15p', 2, 2, DATEADD(hour, -1, GETDATE()), DATEADD(hour, 1, GETDATE()), 15, NULL, 1, 1, 1, 1, N'Không tài liệu', 0),
    (N'Bài tập Java OOP', 3, 3, DATEADD(hour, -5, GETDATE()), DATEADD(hour, 5, GETDATE()), 30, '456', 1, 1, 1, 1, N'Thực hành OOP', 0),
    (N'Quiz Python', 4, 4, DATEADD(day, -1, GETDATE()), DATEADD(day, 1, GETDATE()), 20, NULL, 1, 1, 1, 1, N'Làm bài nhanh', 0),
    (N'Thiết kế UI/UX Final', 5, 5, DATEADD(day, -2, GETDATE()), DATEADD(day, 2, GETDATE()), 25, '789', 1, 1, 1, 1, N'Đánh giá thẩm mỹ', 0),
    (N'CTDL & GT Lab', 1, 6, DATEADD(hour, -3, GETDATE()), DATEADD(hour, 3, GETDATE()), 45, NULL, 1, 1, 1, 1, N'Cấu trúc dữ liệu', 0),
    (N'Toán rời rạc Quiz', 1, 7, DATEADD(day, -3, GETDATE()), DATEADD(day, 3, GETDATE()), 30, NULL, 1, 1, 1, 1, N'Toán học logic', 0);
END
GO

-- 7. Insert Submissions (Một số kết quả mẫu)
IF NOT EXISTS (SELECT 1 FROM Submissions)
BEGIN
    INSERT INTO Submissions (ExamSessionId, StudentId, StartedAt, SubmittedAt, Status, Score, CorrectAnswersCount, WarningCount) VALUES
    (1, 4, DATEADD(hour, -1, GETDATE()), GETDATE(), 1, 9.0, 9, 0),
    (1, 5, DATEADD(hour, -1, GETDATE()), GETDATE(), 1, 8.0, 8, 0),
    (2, 6, DATEADD(minute, -10, GETDATE()), GETDATE(), 1, 10.0, 10, 0);
END
GO
