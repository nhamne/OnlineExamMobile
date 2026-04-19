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
    (N'Thiết kế UI/UX - D18CNPM5', 'UIUX05', 2, 0),
    (N'Cấu trúc dữ liệu và giải thuật - D18CNPM6', 'CTDL06', 3, 0),
    (N'Toán rời rạc - D18CNPM7', 'TOAN07', 1, 0),
    (N'Mạng máy tính - D18CNPM8', 'MANG08', 2, 0),
    (N'An toàn thông tin - D18CNPM9', 'ATTT09', 3, 0),
    (N'Hệ điều hành - D18CNPM10', 'HDH010', 1, 0),
    (N'Nhập môn AI - D18CNPM11', 'AI011', 2, 0),
    (N'Kiểm thử phần mềm - D18CNPM12', 'TEST12', 3, 0),
    (N'Phân tích hệ thống - D18CNPM13', 'PTHT13', 1, 0),
    (N'Cơ sở dữ liệu nâng cao - D18CNPM14', 'CSDL14', 2, 0),
    (N'Web Frontend React - D18CNPM15', 'REACT15', 1, 0);
END
GO

-- 2.1 Top-up Classrooms: bổ sung các lớp còn thiếu theo JoinCode
INSERT INTO Classrooms (ClassName, JoinCode, TeacherId, IsDeleted)
SELECT s.ClassName, s.JoinCode, s.TeacherId, s.IsDeleted
FROM (VALUES
    (N'Lập trình Web Nâng Cao - D18CNPM1', 'WEBNC1', 1, 0),
    (N'Cơ sở Dữ liệu - D18CNPM2', 'CSDL02', 2, 0),
    (N'Lập trình Java Cơ Bản - D18CNPM3', 'JAVA03', 3, 0),
    (N'Lập trình Python Cơ Bản - D18CNPM4', 'PYTHN4', 1, 0),
    (N'Thiết kế UI/UX - D18CNPM5', 'UIUX05', 2, 0),
    (N'Cấu trúc dữ liệu và giải thuật - D18CNPM6', 'CTDL06', 3, 0),
    (N'Toán rời rạc - D18CNPM7', 'TOAN07', 1, 0),
    (N'Mạng máy tính - D18CNPM8', 'MANG08', 2, 0),
    (N'An toàn thông tin - D18CNPM9', 'ATTT09', 3, 0),
    (N'Hệ điều hành - D18CNPM10', 'HDH010', 1, 0),
    (N'Nhập môn AI - D18CNPM11', 'AI011', 2, 0),
    (N'Kiểm thử phần mềm - D18CNPM12', 'TEST12', 3, 0),
    (N'Phân tích hệ thống - D18CNPM13', 'PTHT13', 1, 0),
    (N'Cơ sở dữ liệu nâng cao - D18CNPM14', 'CSDL14', 2, 0),
    (N'Web Frontend React - D18CNPM15', 'REACT15', 1, 0)
) AS s(ClassName, JoinCode, TeacherId, IsDeleted)
WHERE NOT EXISTS (
    SELECT 1
    FROM Classrooms c
    WHERE c.JoinCode = s.JoinCode
);
GO

-- 3. Insert ClassroomMembers (Gán học sinh vào lớp)
IF NOT EXISTS (SELECT 1 FROM ClassroomMembers)
BEGIN
    INSERT INTO ClassroomMembers (ClassroomId, StudentId) VALUES
    (1, 4), (1, 5), (1, 6), (1, 7), (1, 8),
    (1, 9), (1, 10), (1, 11), (1, 12), (1, 13),
    (1, 14), (1, 15),
    (2, 4), (2, 5), (2, 6);
END
GO

-- 4. Insert ExamPapers (15 Đề thi mẫu)
IF NOT EXISTS (SELECT 1 FROM ExamPapers)
BEGIN
    INSERT INTO ExamPapers (Title, DurationInMinutes, TeacherId, IsDeleted) VALUES
    (N'Bài kiểm tra ASP.NET MVC Giữa kỳ', 45, 1, 0),
    (N'Trắc nghiệm SQL Server Cơ bản', 15, 2, 0),
    (N'Bài tập Java OOP', 30, 3, 0),
    (N'Quiz Python Cơ bản', 20, 1, 0),
    (N'Thiết kế giao diện UI/UX', 25, 2, 0),
    (N'CTDL & GT Cơ bản', 45, 3, 0),
    (N'Toán rời rạc 1', 30, 1, 0),
    (N'Mạng máy tính 1', 35, 2, 0),
    (N'An toàn thông tin 1', 30, 3, 0),
    (N'Hệ điều hành 1', 40, 1, 0),
    (N'Nhập môn AI 1', 25, 2, 0),
    (N'Kiểm thử phần mềm 1', 30, 3, 0),
    (N'Phân tích hệ thống 1', 35, 1, 0),
    (N'CSDL nâng cao 1', 40, 2, 0),
    (N'Web Frontend React 1', 30, 1, 0);
END
GO

-- 4.1 Top-up ExamPapers: bổ sung đề thi còn thiếu theo Title
;WITH TeacherMap AS (
    SELECT Id, ROW_NUMBER() OVER (ORDER BY Id) AS TeacherOrder
    FROM Users
    WHERE Role = 'Teacher' AND IsActive = 1
)
INSERT INTO ExamPapers (Title, DurationInMinutes, TeacherId, IsDeleted)
SELECT s.Title, s.DurationInMinutes, tm.Id, 0
FROM (VALUES
    (N'Bài kiểm tra ASP.NET MVC Giữa kỳ', 45, 1),
    (N'Trắc nghiệm SQL Server Cơ bản', 15, 2),
    (N'Bài tập Java OOP', 30, 3),
    (N'Quiz Python Cơ bản', 20, 1),
    (N'Thiết kế giao diện UI/UX', 25, 2),
    (N'CTDL & GT Cơ bản', 45, 3),
    (N'Toán rời rạc 1', 30, 1),
    (N'Mạng máy tính 1', 35, 2),
    (N'An toàn thông tin 1', 30, 3),
    (N'Hệ điều hành 1', 40, 1),
    (N'Nhập môn AI 1', 25, 2),
    (N'Kiểm thử phần mềm 1', 30, 3),
    (N'Phân tích hệ thống 1', 35, 1),
    (N'CSDL nâng cao 1', 40, 2),
    (N'Web Frontend React 1', 30, 1)
) AS s(Title, DurationInMinutes, TeacherOrder)
INNER JOIN TeacherMap tm ON tm.TeacherOrder = s.TeacherOrder
WHERE NOT EXISTS (
    SELECT 1
    FROM ExamPapers ep
    WHERE ep.Title = s.Title
);
GO

-- 5. Insert Questions (nhiều câu mẫu cho các đề)
IF NOT EXISTS (SELECT 1 FROM Questions)
BEGIN
    INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption, Explanation) VALUES
    (1, N'Mô hình MVC là viết tắt của từ gì?', N'Model View Control', N'Model View Controller', N'Module View Controller', N'Main View Controller', 'B', N'MVC là viết tắt của Model-View-Controller.'),
    (1, N'Trong ASP.NET MVC, file nào dùng để cấu hình routing mặc định?', N'RouteConfig.cs', N'Startup.cs', N'Global.asax', N'Web.config', 'A', N'RouteConfig.cs chứa cấu hình các route của ứng dụng.'),
    (1, N'Thuộc tính nào dùng để đánh dấu một Action chỉ nhận request dạng POST?', N'[HttpGet]', N'[AcceptVerbs(HttpVerbs.Get)]', N'[HttpPost]', N'[ActionName]', 'C', N'[HttpPost] bắt buộc request phải là POST.'),
    (1, N'Từ khóa nào dùng để truyền dữ liệu từ Controller sang View mà chỉ tồn tại trong 1 request?', N'ViewBag', N'Session', N'TempData', N'Application', 'A', N'ViewBag và ViewData có vòng đời trong 1 request.'),
    (1, N'Entity Framework thuộc loại công nghệ nào?', N'ORM', N'MVC', N'API', N'SPA', 'A', N'EF là một Object-Relational Mapper (ORM).'),
    (2, N'Lệnh nào dùng để xóa toàn bộ dữ liệu trong bảng mà không ghi log chi tiết?', N'DROP', N'DELETE', N'TRUNCATE', N'REMOVE', 'C', N'TRUNCATE xóa nhanh và không ghi log chi tiết từng row.'),
    (2, N'Khóa ngoại (Foreign Key) có tác dụng gì?', N'Tăng tốc độ tìm kiếm', N'Đảm bảo tính toàn vẹn tham chiếu', N'Mã hóa dữ liệu', N'Tự động tăng giá trị', 'B', N'FK ràng buộc dữ liệu giữa 2 bảng phải hợp lệ.'),
    (2, N'Để lọc kết quả sau khi đã GROUP BY, ta dùng mệnh đề nào?', N'WHERE', N'HAVING', N'ORDER BY', N'FILTER', 'B', N'HAVING được dùng để điều kiện hóa các nhóm dữ liệu.'),
    (2, N'Kiểu dữ liệu nào lưu trữ chuỗi có hỗ trợ Unicode trong SQL Server?', N'VARCHAR', N'TEXT', N'CHAR', N'NVARCHAR', 'D', N'Chữ N (National) đại diện cho chuẩn Unicode.'),
    (2, N'Lệnh JOIN nào lấy tất cả bản ghi ở bảng bên trái, dù không khớp với bảng bên phải?', N'INNER JOIN', N'RIGHT JOIN', N'LEFT JOIN', N'FULL JOIN', 'C', N'LEFT JOIN bảo toàn dữ liệu bảng bên trái.'),
    (3, N'Trong Java, từ khóa nào tạo một lớp con kế thừa lớp cha?', N'implement', N'extends', N'include', N'uses', 'B', N'extends dùng để kế thừa class trong Java.'),
    (3, N'Khai báo nào đúng cho phương thức khởi tạo trong Java?', N'void MyClass()', N'MyClass()', N'new MyClass()', N'create MyClass()', 'B', N'Constructor có tên trùng với tên lớp và không có kiểu trả về.'),
    (3, N'OOP có bao nhiêu tính chất cơ bản?', N'2', N'3', N'4', N'5', 'C', N'4 tính chất: đóng gói, kế thừa, đa hình, trừu tượng.'),
    (3, N'Trong Python, cấu trúc nào dùng để duyệt qua một danh sách?', N'for', N'switch', N'case', N'loop', 'A', N'for là vòng lặp phổ biến trong Python.'),
    (3, N'Kiểu dữ liệu nào của Python là bất biến?', N'list', N'dict', N'tuple', N'set', 'C', N'tuple là immutable.'),
    (4, N'Thẻ HTML nào tạo liên kết?', N'<link>', N'<a>', N'<href>', N'<nav>', 'B', N'<a> dùng để tạo hyperlink.'),
    (4, N'CSS property nào đổi màu chữ?', N'font-color', N'text-color', N'color', N'foreground', 'C', N'color điều khiển màu chữ.'),
    (4, N'Trong React, prop nào dùng để duyệt danh sách hiệu quả?', N'key', N'id', N'class', N'name', 'A', N'key giúp React nhận diện phần tử trong list.'),
    (5, N'Trong UI/UX, wireframe là gì?', N'Bản dựng backend', N'Bản phác thảo bố cục', N'File CSS', N'Mã màu', 'B', N'Wireframe là phác thảo cấu trúc giao diện.'),
    (5, N'Nguyên tắc nào giúp tăng khả năng đọc của giao diện?', N'Contrast', N'Randomize', N'Compress', N'Blur', 'A', N'Độ tương phản giúp nội dung dễ đọc hơn.'),
    (6, N'Thời gian trung bình của thuật toán tìm kiếm nhị phân là bao nhiêu?', N'O(n)', N'O(log n)', N'O(n log n)', N'O(1)', 'B', N'Tìm kiếm nhị phân có độ phức tạp O(log n).');

    -- Các câu còn lại để đủ cho xem trước và test
    INSERT INTO Questions (ExamPaperId, Content, OptionA, OptionB, OptionC, OptionD, CorrectOption, Explanation) VALUES
    (7, N'Từ khóa nào trong C# dùng để khai báo một hằng số?', N'var', N'const', N'static', N'readonly', 'B', N'const khai báo hằng số tại thời điểm biên dịch.'),
    (7, N'ASP.NET Core dùng middleware theo mô hình nào?', N'Pipeline tuần tự', N'Event loop', N'Monolithic', N'Batch job', 'A', N'Middleware xử lý request theo chuỗi.'),
    (7, N'Trong SQL, điều kiện nào dùng để lọc nhóm sau GROUP BY?', N'WHERE', N'HAVING', N'ORDER BY', N'JOIN', 'B', N'HAVING lọc kết quả đã nhóm.'),
    (7, N'JSON là viết tắt của gì?', N'Java Source Object Notation', N'JavaScript Object Notation', N'Java Structured Output Name', N'Joint Syntax Object Node', 'B', N'JSON là định dạng dữ liệu phổ biến.'),
    (8, N'Default value của biến bool trong C# là gì?', N'true', N'false', N'0', N'null', 'B', N'bool mặc định là false.'),
    (8, N'Mệnh đề nào sắp xếp kết quả truy vấn SQL?', N'ORDER BY', N'GROUP BY', N'HAVING', N'WHERE', 'A', N'ORDER BY dùng để sắp xếp.'),
    (8, N'HTTP method nào thường dùng để lấy dữ liệu?', N'POST', N'PUT', N'GET', N'DELETE', 'C', N'GET dùng để truy xuất dữ liệu.'),
    (8, N'Git command nào xem lịch sử commit?', N'git log', N'git push', N'git init', N'git fetch', 'A', N'git log hiển thị commit history.'),
    (9, N'Mật mã học là gì?', N'Kỹ thuật nén ảnh', N'Kỹ thuật bảo vệ thông tin', N'Kỹ thuật vẽ sơ đồ', N'Kỹ thuật tối ưu UI', 'B', N'Mật mã học bảo vệ dữ liệu.'),
    (9, N'Bộ phận nào trong mạng chịu trách nhiệm định tuyến?', N'Switch', N'Router', N'Hub', N'Bridge', 'B', N'Router định tuyến gói tin.'),
    (10, N'Bộ nhớ RAM là loại bộ nhớ nào?', N'Không bay hơi', N'Bay hơi', N'Chỉ đọc', N'Quang học', 'B', N'RAM mất dữ liệu khi tắt máy.'),
    (10, N'CPU là viết tắt của gì?', N'Central Processing Unit', N'Computer Personal Unit', N'Control Program Unit', N'Core Process Utility', 'A', N'CPU là bộ xử lý trung tâm.'),
    (11, N'Thuật toán AI nào thường dùng cho phân loại nhị phân?', N'Logistic Regression', N'Bubble Sort', N'BFS', N'Heap Sort', 'A', N'Logistic Regression là mô hình phân loại.'),
    (12, N'Mục tiêu của kiểm thử phần mềm là gì?', N'Tăng dung lượng app', N'Phát hiện lỗi', N'Viết code nhanh hơn', N'Đổi giao diện', 'B', N'Testing giúp phát hiện lỗi và rủi ro.'),
    (13, N'Use case dùng để mô tả gì?', N'Chi tiết thuật toán', N'Tương tác giữa người dùng và hệ thống', N'Bảng dữ liệu', N'Mã nguồn', 'B', N'Use case mô tả hành vi hệ thống.'),
    (14, N'Khóa chính (Primary Key) có đặc điểm gì?', N'Có thể trùng', N'Không được null và duy nhất', N'Luôn là chuỗi', N'Luôn tự tăng', 'B', N'PK phải duy nhất và không null.'),
    (15, N'Thư viện nào phổ biến để làm giao diện React?', N'jQuery', N'Material UI', N'ADO.NET', N'Entity Framework', 'B', N'Material UI là thư viện component React.'),
    (15, N'Hook nào dùng để quản lý state trong React?', N'useState', N'useRoute', N'useStore', N'useForm', 'A', N'useState dùng để quản lý trạng thái cục bộ.');
END
GO

-- 6. Insert ExamSessions (Ca thi)
-- Không dùng hardcoded ID để tránh lỗi khóa ngoại trên DB đã có dữ liệu.
-- Việc bổ sung ca thi được xử lý ở khối top-up bên dưới (map theo JoinCode và Title).

-- 6.1 Top-up ExamSessions: bổ sung các ca thi còn thiếu theo SessionName + ClassroomId
INSERT INTO ExamSessions (SessionName, ClassroomId, ExamPaperId, StartTime, EndTime, DurationInMinutes, SessionPassword, AllowViewExplanation, IsShuffled, ShuffleQuestions, ShuffleAnswers, Notes)
SELECT
    s.SessionName,
    c.Id,
    ep.Id,
    s.StartTime,
    s.EndTime,
    s.DurationInMinutes,
    s.SessionPassword,
    s.AllowViewExplanation,
    s.IsShuffled,
    s.ShuffleQuestions,
    s.ShuffleAnswers,
    s.Notes
FROM (VALUES
    (N'Ca thi sáng - Lập trình Web', 'WEBNC1', N'Bài kiểm tra ASP.NET MVC Giữa kỳ', DATEADD(hour, -4, GETDATE()), DATEADD(hour, -2, GETDATE()), 45, '123456', 1, 1, 1, 1, N'Học sinh được phép sử dụng máy tính bỏ túi.'),
    (N'Kiểm tra 15 phút CSDL', 'CSDL02', N'Trắc nghiệm SQL Server Cơ bản', DATEADD(hour, -1, GETDATE()), DATEADD(hour, 1, GETDATE()), 15, NULL, 0, 1, 1, 0, N'Không được mở tài liệu trong quá trình làm bài.'),
    (N'Ca thi Java OOP', 'JAVA03', N'Bài tập Java OOP', DATEADD(day, 1, GETDATE()), DATEADD(day, 1, DATEADD(hour, 1, GETDATE())), 30, 'JAVA30', 1, 1, 1, 1, N'Ôn tập kế thừa và đa hình.'),
    (N'Quiz Python cơ bản', 'PYTHN4', N'Quiz Python Cơ bản', DATEADD(day, 2, GETDATE()), DATEADD(day, 2, DATEADD(hour, 1, GETDATE())), 20, NULL, 1, 1, 1, 1, N'Trả lời nhanh trong 20 phút.'),
    (N'Ca thi UI/UX', 'UIUX05', N'Thiết kế giao diện UI/UX', DATEADD(day, 3, GETDATE()), DATEADD(day, 3, DATEADD(hour, 1, GETDATE())), 25, 'UX2026', 1, 1, 1, 1, N'Đánh giá nguyên tắc thiết kế.'),
    (N'Ca thi CTDL & GT', 'CTDL06', N'CTDL & GT Cơ bản', DATEADD(day, 4, GETDATE()), DATEADD(day, 4, DATEADD(hour, 1, GETDATE())), 45, NULL, 1, 1, 1, 1, N'Bài kiểm tra chương cây và đồ thị.'),
    (N'Ca thi Toán rời rạc', 'TOAN07', N'Toán rời rạc 1', DATEADD(day, 5, GETDATE()), DATEADD(day, 5, DATEADD(hour, 1, GETDATE())), 30, 'MATH07', 1, 1, 1, 1, N'Có câu logic và tổ hợp.'),
    (N'Ca thi Mạng máy tính', 'MANG08', N'Mạng máy tính 1', DATEADD(day, 6, GETDATE()), DATEADD(day, 6, DATEADD(hour, 1, GETDATE())), 35, NULL, 1, 1, 1, 1, N'Kiểm tra kiến thức mạng cơ bản.'),
    (N'Ca thi An toàn thông tin', 'ATTT09', N'An toàn thông tin 1', DATEADD(day, 7, GETDATE()), DATEADD(day, 7, DATEADD(hour, 1, GETDATE())), 30, 'SAFE09', 1, 1, 1, 1, N'Tập trung vào mã hóa và xác thực.'),
    (N'Ca thi Hệ điều hành', 'HDH010', N'Hệ điều hành 1', DATEADD(day, 8, GETDATE()), DATEADD(day, 8, DATEADD(hour, 1, GETDATE())), 40, NULL, 1, 1, 1, 1, N'Bài thi về tiến trình và bộ nhớ.'),
    (N'Ca thi Nhập môn AI', 'AI011', N'Nhập môn AI 1', DATEADD(day, 9, GETDATE()), DATEADD(day, 9, DATEADD(hour, 1, GETDATE())), 25, 'AI11', 1, 1, 1, 1, N'Đề thi khởi động về AI.'),
    (N'Ca thi Kiểm thử phần mềm', 'TEST12', N'Kiểm thử phần mềm 1', DATEADD(day, 10, GETDATE()), DATEADD(day, 10, DATEADD(hour, 1, GETDATE())), 30, NULL, 1, 1, 1, 1, N'Tập trung vào quy trình testing.'),
    (N'Ca thi Phân tích hệ thống', 'PTHT13', N'Phân tích hệ thống 1', DATEADD(day, 11, GETDATE()), DATEADD(day, 11, DATEADD(hour, 1, GETDATE())), 35, 'SYS13', 1, 1, 1, 1, N'Đánh giá nghiệp vụ và use case.'),
    (N'Ca thi CSDL nâng cao', 'CSDL14', N'CSDL nâng cao 1', DATEADD(day, 12, GETDATE()), DATEADD(day, 12, DATEADD(hour, 1, GETDATE())), 40, NULL, 1, 1, 1, 1, N'Bài thi nâng cao về dữ liệu.'),
    (N'Ca thi Web Frontend React', 'REACT15', N'Web Frontend React 1', DATEADD(day, 13, GETDATE()), DATEADD(day, 13, DATEADD(hour, 1, GETDATE())), 30, 'REACT15', 1, 1, 1, 1, N'Kiểm tra React và component.')
) AS s(SessionName, ClassroomJoinCode, ExamTitle, StartTime, EndTime, DurationInMinutes, SessionPassword, AllowViewExplanation, IsShuffled, ShuffleQuestions, ShuffleAnswers, Notes)
INNER JOIN Classrooms c ON c.JoinCode = s.ClassroomJoinCode AND c.IsDeleted = 0
OUTER APPLY (
    SELECT TOP 1 ep.Id
    FROM ExamPapers ep
    WHERE ep.Title = s.ExamTitle
      AND ep.IsDeleted = 0
    ORDER BY CASE WHEN ep.TeacherId = c.TeacherId THEN 0 ELSE 1 END, ep.Id
) ep
WHERE NOT EXISTS (
    SELECT 1
    FROM ExamSessions es
    WHERE es.SessionName = s.SessionName
      AND es.ClassroomId = c.Id
)
AND ep.Id IS NOT NULL;
GO

-- 7. Insert Submissions (nhiều bài nộp mẫu để test phân trang)
IF NOT EXISTS (SELECT 1 FROM Submissions)
BEGIN
    INSERT INTO Submissions (ExamSessionId, StudentId, StartedAt, SubmittedAt, Status, Score, CorrectAnswersCount, WarningCount) VALUES
    (1, 4, DATEADD(hour, -3, GETDATE()), DATEADD(hour, -2, GETDATE()), 1, 8.0, 4, 0),
    (1, 5, DATEADD(hour, -3, DATEADD(minute, 10, GETDATE())), DATEADD(hour, -2, DATEADD(minute, 5, GETDATE())), 1, 7.5, 3, 0),
    (2, 6, DATEADD(minute, -50, GETDATE()), DATEADD(minute, -10, GETDATE()), 1, 9.0, 5, 0),
    (2, 7, DATEADD(minute, -45, GETDATE()), DATEADD(minute, -8, GETDATE()), 1, 10.0, 5, 0),
    (2, 8, DATEADD(minute, -40, GETDATE()), DATEADD(minute, -6, GETDATE()), 1, 6.5, 3, 1),
    (3, 9, DATEADD(hour, 1, GETDATE()), NULL, 0, NULL, NULL, 0),
    (3, 10, DATEADD(hour, 1, DATEADD(minute, 5, GETDATE())), NULL, 0, NULL, NULL, 0),
    (4, 11, DATEADD(day, 1, GETDATE()), NULL, 0, NULL, NULL, 0),
    (5, 12, DATEADD(day, 2, GETDATE()), NULL, 0, NULL, NULL, 0),
    (6, 13, DATEADD(day, 3, GETDATE()), NULL, 0, NULL, NULL, 0),
    (7, 14, DATEADD(day, 4, GETDATE()), NULL, 0, NULL, NULL, 0),
    (8, 15, DATEADD(day, 5, GETDATE()), NULL, 0, NULL, NULL, 0),
    (9, 4, DATEADD(day, 6, GETDATE()), NULL, 0, NULL, NULL, 0),
    (10, 5, DATEADD(day, 7, GETDATE()), NULL, 0, NULL, NULL, 0),
    (11, 6, DATEADD(day, 8, GETDATE()), NULL, 0, NULL, NULL, 0);
END
GO

-- 8. Insert SubmissionDetails (chi tiết bài làm mẫu)
IF NOT EXISTS (SELECT 1 FROM SubmissionDetails)
BEGIN
    INSERT INTO SubmissionDetails (SubmissionId, QuestionId, SelectedOption, IsCorrect) VALUES
    (1, 1, 'B', 1),
    (1, 2, 'A', 1),
    (1, 3, 'C', 1),
    (1, 4, 'B', 0),
    (1, 5, 'A', 1),
    (2, 1, 'B', 1),
    (2, 2, 'A', 1),
    (2, 3, 'C', 1),
    (2, 4, 'A', 1),
    (2, 5, 'A', 1),
    (3, 6, 'C', 1),
    (3, 7, 'B', 1),
    (3, 8, 'B', 1),
    (3, 9, 'A', 1),
    (3, 10, 'C', 0);
END
GO