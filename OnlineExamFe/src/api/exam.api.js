import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const examApi = {
  // Get all exams for the student
  getExams: () => axios.get(`${API_BASE_URL}/student/exams`),

  // Get specific exam details
  getExamDetails: (id) => axios.get(`${API_BASE_URL}/student/exams/${id}`),

  // Start an exam attempt
  startAttempt: (examId, data) => axios.post(`${API_BASE_URL}/student/exams/${examId}/start`, data),

  // Save a single answer (incremental)
  saveAnswer: (attemptId, data) => 
    axios.post(`${API_BASE_URL}/student/attempts/${attemptId}/save-answer`, data),

  // Submit the full exam
  submitExam: (attemptId, answers) => 
    axios.post(`${API_BASE_URL}/student/attempts/${attemptId}/submit`, { answers }),

  // Log anti-cheat violation
  logViolation: (attemptId, data) => 
    axios.post(`${API_BASE_URL}/student/attempts/${attemptId}/log-violation`, data),

  // Get result for an attempt
  getResult: (attemptId) => axios.get(`${API_BASE_URL}/student/results/${attemptId}`),

  // Get student statistics
  getStatistics: () => axios.get(`${API_BASE_URL}/student/statistics`),
};

export default examApi;
