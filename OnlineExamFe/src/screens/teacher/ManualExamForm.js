import React, { useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../../context/ToastContext';
import { createTeacherExam } from '../../services/authService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  primary: '#005BBF',
  primaryContainer: '#004aad',
  background: '#f7f9fb',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainerLowest: '#ffffff',
  outlineVariant: 'rgba(195, 198, 213, 0.2)',
  onSurface: '#191c1e',
  onSurfaceVariant: '#434653',
};

const ManualExamForm = ({ navigation, route }) => {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const user = route?.params?.user || null;
  const questions = Array.isArray(route?.params?.questions) ? route.params.questions : [];
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef(null);
  const subjectRef = useRef(null);
  const durationRef = useRef(null);

  const isTitleValid = Boolean(title.trim());
  const isSubjectValid = Boolean(subject.trim());
  const isDurationValid = Boolean(duration.trim());
  const isValid = isTitleValid && isSubjectValid && isDurationValid;

  const handleSubmit = async (action) => {
    if (!isValid) {
      setShowErrors(true);
      if (!isTitleValid) {
        titleRef.current?.focus();
      } else if (!isSubjectValid) {
        subjectRef.current?.focus();
      } else if (!isDurationValid) {
        durationRef.current?.focus();
      }
      return;
    }

    if (!user?.id) {
      showToast('Không tìm thấy thông tin giáo viên.', 'error');
      return;
    }

    if (questions.length === 0) {
      showToast('Chưa có câu hỏi để lưu đề thi.', 'error');
      return;
    }

    const durationValue = Number(duration);
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      showToast('Thời gian thi không hợp lệ.', 'error');
      durationRef.current?.focus();
      return;
    }

    const payloadQuestions = questions.map((item) => {
      const optionsMap = {};
      let correctOption = '';

      item.options.forEach((opt) => {
        optionsMap[opt.label] = opt.text;
        if (opt.isCorrect) correctOption = opt.label;
      });

      return {
        content: item.question,
        options: optionsMap,
        correctOption,
      };
    });

    try {
      setIsSubmitting(true);
      await createTeacherExam(user.id, {
        title: title.trim(),
        subject: subject.trim(),
        durationInMinutes: durationValue,
        status: action === 'draft' ? 'draft' : 'published',
        questions: payloadQuestions,
      });

      showToast(
        action === 'draft' ? 'Đã lưu bản nháp đề thi.' : 'Đã xuất bản đề thi.',
        'success'
      );

      navigation.replace('TeacherDashboard', {
        user,
        initialTab: 'exams',
        refreshToken: Date.now(),
      });
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      const status = error?.response?.status;
      const fallback = status ? `Lỗi ${status}: Không thể lưu đề thi.` : 'Không thể lưu đề thi lúc này.';
      showToast(apiMessage || error?.message || fallback, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={18} color={COLORS.onSurface} />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin cơ bản</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>
            Tên đề thi <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, showErrors && !isTitleValid && styles.inputError]}
            placeholder="Ví dụ: Kiểm tra định kỳ học kỳ 1 môn Toán"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={title}
            onChangeText={setTitle}
            ref={titleRef}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>
            Môn học <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, showErrors && !isSubjectValid && styles.inputError]}
            placeholder="Ví dụ: Toán học"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={subject}
            onChangeText={setSubject}
            ref={subjectRef}
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>
            Thời gian thi <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.durationRow}>
            <TextInput
              style={[styles.durationInput, showErrors && !isDurationValid && styles.inputError]}
              keyboardType="numeric"
              placeholder="Ví dụ: 45"
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={duration}
              onChangeText={setDuration}
              ref={durationRef}
            />
            <Text style={styles.durationUnit}>phút</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleSubmit('draft')}
            disabled={isSubmitting}
          >
            <MaterialIcons name="save" size={18} color={COLORS.onSurfaceVariant} />
            <Text style={styles.secondaryButtonText}>Lưu bản nháp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleSubmit('publish')}
            disabled={isSubmitting}
          >
            <MaterialIcons name="publish" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Xuất bản</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 24 },
  headerRow: {
    marginBottom: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#eceef0',
    marginTop: 6,
    marginBottom: 12,
  },
  backButtonText: { color: COLORS.onSurface, fontSize: 12, fontWeight: '700' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.onSurface },
  formCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.onSurface,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  required: { color: '#ef4444' },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.onSurface,
  },
  durationUnit: { color: COLORS.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eceef0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: { color: COLORS.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});

export default ManualExamForm;