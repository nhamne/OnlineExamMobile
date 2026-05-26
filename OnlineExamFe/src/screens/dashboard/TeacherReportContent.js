import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Users, BookOpen, Calendar, HelpCircle } from 'lucide-react-native';

const TeacherReportContent = ({ summary, classrooms = [], examPapers = [], sessions = [] }) => {
  // Aggregated data
  const totalStudents = summary?.TotalStudents || 0;
  const mostPopulousClass = summary?.MostPopulousClass || null;
  const longestExam = summary?.LongestExam || null;
  const mostQuestionsExam = summary?.MostQuestionsExam || null;

  const ambientShadow = {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  };

  return (
    <View className="mb-10 mt-2">
      <View className="mb-2 px-1">
        <Text className="text-sm mb-2" style={{ color: '#64748B' }}>
          Đánh giá nhanh hoạt động giảng dạy của bạn
        </Text>
      </View>

      <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
        <View className="w-[48%] rounded-3xl p-4" style={{ backgroundColor: '#EEF2FF', ...ambientShadow }}>
          <View className="w-10 h-10 rounded-full bg-white opacity-80 items-center justify-center mb-3">
            <Users size={20} color="#4F46E5" />
          </View>
          <Text className="text-3xl font-extrabold mb-1" style={{ color: '#312E81' }}>{totalStudents}</Text>
          <Text className="text-sm font-semibold" style={{ color: '#4338CA' }}>Tổng học sinh</Text>
        </View>

        <View className="w-[48%] rounded-3xl p-4" style={{ backgroundColor: '#ECFDF5', ...ambientShadow }}>
          <View className="w-10 h-10 rounded-full bg-white opacity-80 items-center justify-center mb-3">
            <BookOpen size={20} color="#059669" />
          </View>
          <Text className="text-3xl font-extrabold mb-1" style={{ color: '#064E3B' }}>{summary?.ExamPaperCount || 0}</Text>
          <Text className="text-sm font-semibold" style={{ color: '#047857' }}>Bộ đề thi</Text>
        </View>

        <View className="w-[48%] rounded-3xl p-4" style={{ backgroundColor: '#FFFBEB', ...ambientShadow }}>
          <View className="w-10 h-10 rounded-full bg-white opacity-80 items-center justify-center mb-3">
            <Calendar size={20} color="#D97706" />
          </View>
          <Text className="text-3xl font-extrabold mb-1" style={{ color: '#78350F' }}>{summary?.SessionCount || 0}</Text>
          <Text className="text-sm font-semibold" style={{ color: '#B45309' }}>Tổng ca thi</Text>
        </View>

        <View className="w-[48%] rounded-3xl p-4" style={{ backgroundColor: '#FFF1F2', ...ambientShadow }}>
          <View className="w-10 h-10 rounded-full bg-white opacity-80 items-center justify-center mb-3">
            <HelpCircle size={20} color="#E11D48" />
          </View>
          <Text className="text-3xl font-extrabold mb-1" style={{ color: '#881337' }}>{summary?.ClassroomCount || 0}</Text>
          <Text className="text-sm font-semibold" style={{ color: '#BE123C' }}>Số lớp học</Text>
        </View>
      </View>

      <View className="mb-4 px-1 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-on-surface">Điểm nổi bật</Text>
      </View>

      <View
        className="bg-white rounded-3xl p-5 mb-4 flex-row items-center"
        style={{ borderWidth: 1, borderColor: '#EEF2FF', ...ambientShadow }}
      >
        <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: '#EEF2FF' }}>
          <MaterialIcons name="groups" size={28} color="#4F46E5" />
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Lớp đông học sinh nhất</Text>
          <Text className="text-base font-bold text-on-surface" numberOfLines={1}>
            {mostPopulousClass ? mostPopulousClass.ClassName : 'Chưa có lớp nào'}
          </Text>
        </View>
        <View className="items-end pl-2" style={{ borderLeftWidth: 1, borderColor: '#F1F5F9' }}>
          <Text className="text-2xl font-black" style={{ color: '#4F46E5' }}>
            {mostPopulousClass ? mostPopulousClass.StudentCount : 0}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: '#94A3B8' }}>học sinh</Text>
        </View>
      </View>

      <View
        className="bg-white rounded-3xl p-5 mb-4 flex-row items-center"
        style={{ borderWidth: 1, borderColor: '#ECFDF5', ...ambientShadow }}
      >
        <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: '#ECFDF5' }}>
          <MaterialIcons name="assignment" size={28} color="#059669" />
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Đề thi dài nhất</Text>
          <Text className="text-base font-bold text-on-surface" numberOfLines={1}>
            {longestExam ? longestExam.Title : 'Chưa có đề thi nào'}
          </Text>
        </View>
        <View className="items-end pl-2" style={{ borderLeftWidth: 1, borderColor: '#F1F5F9' }}>
          <Text className="text-2xl font-black" style={{ color: '#059669' }}>
            {longestExam ? longestExam.DurationInMinutes : 0}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: '#94A3B8' }}>phút</Text>
        </View>
      </View>

      <View
        className="bg-white rounded-3xl p-5 mb-4 flex-row items-center"
        style={{ borderWidth: 1, borderColor: '#FFFBEB', ...ambientShadow }}
      >
        <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: '#FFFBEB' }}>
          <MaterialIcons name="format-list-numbered" size={28} color="#D97706" />
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-sm font-semibold mb-1" style={{ color: '#64748B' }}>Đề nhiều câu hỏi nhất</Text>
          <Text className="text-base font-bold text-on-surface" numberOfLines={1}>
            {mostQuestionsExam ? mostQuestionsExam.Title : 'Chưa có đề thi nào'}
          </Text>
        </View>
        <View className="items-end pl-2" style={{ borderLeftWidth: 1, borderColor: '#F1F5F9' }}>
          <Text className="text-2xl font-black" style={{ color: '#D97706' }}>
            {mostQuestionsExam ? mostQuestionsExam.QuestionCount : 0}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: '#94A3B8' }}>câu hỏi</Text>
        </View>
      </View>

    </View>
  );
};

export default TeacherReportContent;
