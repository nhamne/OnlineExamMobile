import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export async function register(payload) {
  const response = await api.post('/api/auth/register', payload);
  return response.data;
}

export async function login(payload) {
  const response = await api.post('/api/auth/login', payload);
  return response.data;
}

export async function getExams() {
  const response = await api.get('/api/exams');
  return response.data;
}

export async function setupDatabase() {
  const response = await api.post('/api/setup-db');
  return response.data;
}

export async function getTeacherDashboard(userId) {
  const response = await api.get(`/api/dashboard/teacher/${userId}`);
  return response.data;
}

export async function getStudentDashboard(userId) {
  const response = await api.get(`/api/dashboard/student/${userId}`);
  return response.data;
}
