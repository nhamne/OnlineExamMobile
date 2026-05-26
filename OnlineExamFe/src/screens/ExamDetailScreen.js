import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import examApi from '../api/exam.api';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const ExamDetailScreen = ({ route, navigation }) => {
  const { attemptId } = route.params;
  const submittedScore = route?.params?.submittedScore;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await examApi.getResultDetail(attemptId);
        setDetail(response.data);
      } catch (error) {
        console.error('Failed to fetch result detail:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [attemptId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-container-low">
        <View className="bg-primary px-6 pt-10 pb-8 rounded-b-[40px] shadow-lg">
          <Text className="text-white text-3xl font-black tracking-tight mb-2">Kết quả chi tiết</Text>
          {submittedScore !== undefined ? (
            <View className="bg-white/20 px-3 py-1 rounded-full self-start mt-2">
              <Text className="text-white font-bold text-sm">Điểm: {Number(submittedScore).toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
        <View className="flex-1 justify-center items-center bg-surface">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <View className="flex-1 justify-center items-center bg-surface px-6">
        <Text className="text-on-surface-variant text-center">Không tìm thấy thông tin chi tiết bài làm.</Text>
      </View>
    );
  }

  const renderQuestion = (item, index) => {
    const isCorrect = item.selectedOption === item.correctOption;
    
    return (
      <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-primary font-black uppercase text-xs tracking-widest">Câu {index + 1}</Text>
          <MaterialIcons 
            name={isCorrect ? "check-circle" : "cancel"} 
            size={24} 
            color={isCorrect ? COLORS.success : COLORS.danger} 
          />
        </View>
        <Text className="text-base text-on-surface leading-6 font-medium mb-4">{item.content}</Text>
        
        {['A', 'B', 'C', 'D'].map(opt => {
          const isSelected = item.selectedOption === opt;
          const isCorrectOpt = item.correctOption === opt;
          
          let optionBgClass = "bg-slate-50";
          let optionBorderClass = "border-transparent";
          let textClass = "text-on-surface-variant";

          if (isSelected) {
            optionBorderClass = "border-primary";
          }
          if (isCorrectOpt) {
            optionBgClass = "bg-green-500";
            optionBorderClass = "border-green-500";
            textClass = "text-white";
          } else if (isSelected && !isCorrectOpt) {
            optionBgClass = "bg-red-500";
            optionBorderClass = "border-red-500";
            textClass = "text-white";
          }

          return (
            <View 
              key={opt} 
              className={`flex-row justify-between items-center p-4 rounded-xl mb-2 border ${optionBgClass} ${optionBorderClass}`}
            >
              <Text className={`text-sm flex-1 font-semibold ${textClass}`}>
                {opt}. {item[`option${opt}`]}
              </Text>
              {isCorrectOpt && <MaterialIcons name="check" size={20} color="#FFF" />}
              {isSelected && !isCorrectOpt && <MaterialIcons name="close" size={20} color="#FFF" />}
            </View>
          );
        })}
        
        {item.explanation && (
          <View className="mt-4 p-4 bg-blue-50 rounded-xl border-l-4 border-primary">
            <Text className="text-xs font-black text-primary uppercase mb-1">Giải thích:</Text>
            <Text className="text-sm text-on-surface-variant leading-5 italic">{item.explanation}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-surface-container-low"
      style={Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}}
    >
      <View className="bg-primary px-6 pt-10 pb-8 rounded-b-[40px] shadow-lg">
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-white/20 items-center justify-center mb-4"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-3xl font-black tracking-tight mb-2">Kết quả chi tiết</Text>
        <View className="flex-row gap-4 mt-2">
          <View className="bg-white/20 px-3 py-1 rounded-full">
            <Text className="text-white font-bold text-sm">Điểm: {detail.score}</Text>
          </View>
          <View className="bg-white/20 px-3 py-1 rounded-full">
            <Text className="text-white font-bold text-sm">Đúng: {detail.correctCount}/{detail.totalQuestions}</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 72 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {Array.isArray(detail?.questions)
            ? detail.questions.map((item, index) => (
                <View key={String(item.id || index)}>{renderQuestion(item, index)}</View>
              ))
            : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default ExamDetailScreen;
