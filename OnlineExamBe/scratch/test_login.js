async function testLogin() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student1@exam.com',
        password: 'password@123',
        role: 'student'
      })
    });
    const data = await response.json();
    if (response.ok) {
      console.log('Login Success:', data);
    } else {
      console.log('Login Failed:', data);
    }
  } catch (error) {
    console.error('Network Error:', error.message);
  }
}

testLogin();
