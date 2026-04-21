import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { loadAuthSession } from '../services/authSession';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const user = loadAuthSession();
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

const examApi = {
  getStudentExams: () => api.get('/api/exam/student/list'),
  getUpcomingExams: () => api.get('/api/exam/student/upcoming'),
  getExamHistory: () => api.get('/api/exam/student/history'),
  
  startAttempt: (examId) => api.post(`/api/exam/attempt/start/${examId}`),
  
  saveAnswer: (attemptId, questionId, optionId) => 
    api.post('/api/exam/attempt/save-answer', { attemptId, questionId, optionId }),
  
  autosaveAnswers: (attemptId, answers) => 
    api.post('/api/exam/attempt/autosave', { attemptId, answers }),
  
  submitExam: (attemptId) => api.post('/api/exam/attempt/submit', { attemptId }),
  
  forceSubmit: (attemptId) => api.post('/api/exam/attempt/force-submit', { attemptId }),
  
  logViolation: (attemptId, type) => 
    api.post('/api/exam/attempt/violation', { attemptId, type, timestamp: new Date().toISOString() }),
    
  getStatistics: (userId) => api.get(`/api/exam/student/stats/${userId}`),
  
  getResultDetail: (attemptId) => api.get(`/api/exam/results/${attemptId}/detail`),
  
  joinClass: (classCode) => api.post('/api/class/join', { classCode }),
};

export default examApi;
