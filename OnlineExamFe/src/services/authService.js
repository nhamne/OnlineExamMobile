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

export async function getTeacherExamDetail(userId, examId) {
  const response = await api.get(`/api/dashboard/teacher/${userId}/exams/${examId}`);
  return response.data;
}

export async function deleteTeacherExamQuestion(userId, examId, questionId) {
  const response = await api.delete(
    `/api/dashboard/teacher/${userId}/exams/${examId}/questions/${questionId}`
  );
  return response.data;
}

export async function createTeacherExamQuestion(userId, examId, payload) {
  const response = await api.post(
    `/api/dashboard/teacher/${userId}/exams/${examId}/questions`,
    payload
  );
  return response.data;
}

export async function updateTeacherExamQuestion(userId, examId, questionId, payload) {
  const response = await api.put(
    `/api/dashboard/teacher/${userId}/exams/${examId}/questions/${questionId}`,
    payload
  );
  return response.data;
}

export async function getTeacherClassrooms(userId) {
  try {
    const response = await api.get(`/api/dashboard/teacher/${userId}/classrooms`);
    return response.data;
  } catch (error) {
    // Backward compatibility: older backend may not expose /classrooms route yet.
    const status = error?.response?.status;
    const legacyHtmlNotFound =
      typeof error?.response?.data === 'string' && error.response.data.includes('Cannot GET');

    if (status === 404 || legacyHtmlNotFound) {
      const fallbackResponse = await api.get(`/api/dashboard/teacher/${userId}`);
      return {
        teacher: fallbackResponse?.data?.teacher || null,
        classrooms: Array.isArray(fallbackResponse?.data?.classrooms)
          ? fallbackResponse.data.classrooms
          : [],
      };
    }

    throw error;
  }
}

export async function getTeacherSessions(userId) {
  try {
    const response = await api.get(`/api/dashboard/teacher/${userId}/sessions`);
    return response.data;
  } catch (error) {
    // Backward compatibility: older backend may not expose /sessions route yet.
    const status = error?.response?.status;
    const legacyHtmlNotFound =
      typeof error?.response?.data === 'string' && error.response.data.includes('Cannot GET');

    if (status === 404 || legacyHtmlNotFound) {
      const fallbackResponse = await api.get(`/api/dashboard/teacher/${userId}`);
      return {
        teacher: fallbackResponse?.data?.teacher || null,
        sessions: Array.isArray(fallbackResponse?.data?.sessions)
          ? fallbackResponse.data.sessions
          : [],
      };
    }

    throw error;
  }
}

export async function getTeacherSessionFormOptions(userId) {
  const response = await api.get(`/api/dashboard/teacher/${userId}/sessions/form-options`);
  return response.data;
}

export async function previewTeacherSession(userId, payload) {
  const response = await api.post(`/api/dashboard/teacher/${userId}/sessions/preview`, payload);
  return response.data;
}

export async function createTeacherSession(userId, payload) {
  const response = await api.post(`/api/dashboard/teacher/${userId}/sessions`, payload);
  return response.data;
}

export async function createTeacherExam(userId, payload) {
  const response = await api.post(`/api/dashboard/teacher/${userId}/exams`, payload);
  return response.data;
}

export async function updateTeacherExam(userId, examId, payload) {
  const response = await api.put(`/api/dashboard/teacher/${userId}/exams/${examId}`, payload);
  return response.data;
}

export async function deleteTeacherExam(userId, examId) {
  const response = await api.delete(`/api/dashboard/teacher/${userId}/exams/${examId}`);
  return response.data;
}

export async function copyTeacherExam(userId, examId) {
  const response = await api.post(`/api/dashboard/teacher/${userId}/exams/${examId}/copy`);
  return response.data;
}

export async function createTeacherClassroom(userId, payload) {
  const response = await api.post(`/api/dashboard/teacher/${userId}/classrooms`, payload);
  return response.data;
}

export async function updateTeacherClassroom(userId, classroomId, payload) {
  const response = await api.put(
    `/api/dashboard/teacher/${userId}/classrooms/${classroomId}`,
    payload
  );
  return response.data;
}

export async function deleteTeacherClassroom(userId, classroomId) {
  const response = await api.delete(`/api/dashboard/teacher/${userId}/classrooms/${classroomId}`);
  return response.data;
}

export async function getTeacherClassroomDetail(userId, classroomId) {
  const response = await api.get(`/api/dashboard/teacher/${userId}/classrooms/${classroomId}`);
  return response.data;
}

export async function removeStudentFromTeacherClassroom(userId, classroomId, studentId) {
  const response = await api.delete(
    `/api/dashboard/teacher/${userId}/classrooms/${classroomId}/students/${studentId}`
  );
  return response.data;
}

export async function getStudentDashboard(userId) {
  const response = await api.get(`/api/dashboard/student/${userId}`);
  return response.data;
}
