import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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

const parseQuestions = (text) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const questions = [];
  let current = null;

  const commitCurrent = () => {
    if (!current) return;
    current.question = current.question.trim();
    questions.push(current);
    current = null;
  };

  lines.forEach((line) => {
    const questionMatch = line.match(/^(cau|câu)\s*(\d+)\s*[:.\-]\s*(.*)$/i);
    if (questionMatch) {
      commitCurrent();
      current = {
        number: Number(questionMatch[2]) || questions.length + 1,
        question: questionMatch[3] || '',
        options: [],
        correctIndex: null,
      };
      return;
    }

    const optionMatch = line.match(/^\*?\s*([A-D])\s*[).:-]\s*(.*)$/i);
    if (optionMatch) {
      if (!current) {
        current = {
          number: questions.length + 1,
          question: '',
          options: [],
          correctIndex: null,
        };
      }

      const letter = optionMatch[1].toUpperCase();
      const textValue = optionMatch[2] || '';
      const isCorrect = line.trim().startsWith('*');
      const index = letter.charCodeAt(0) - 65;
      current.options[index] = textValue;
      if (isCorrect) current.correctIndex = index;
      return;
    }

    if (!current) {
      current = {
        number: questions.length + 1,
        question: line,
        options: [],
        correctIndex: null,
      };
    } else if (current.options.length === 0) {
      current.question = `${current.question} ${line}`.trim();
    }
  });

  commitCurrent();

  return questions.map((item, idx) => ({
    ...item,
    number: item.number || idx + 1,
    options: item.options
      .map((textValue, index) => ({
        label: String.fromCharCode(65 + index),
        text: textValue,
        isCorrect: item.correctIndex === index,
      }))
      .filter((opt) => opt.text !== ''),
  }));
};

const buildTextFromQuestions = (questions) => {
  return questions
    .map((q, idx) => {
      const number = q.number || idx + 1;
      const questionLine = `Câu ${number}: ${q.question || ''}`.trim();
      const optionLines = q.options
        .filter((opt) => String(opt.text || '').trim() !== '')
        .map((opt, optIndex) => {
          const prefix = opt.isCorrect ? '*' : '';
          const label = opt.label || String.fromCharCode(65 + optIndex);
          return `${prefix}${label}. ${opt.text || ''}`.trim();
        })
        .join('\n');
      return `${questionLine}\n${optionLines}`.trim();
    })
    .join('\n\n')
    .trim();
};


const ExamEditorContent = ({ navigation, route }) => {
  const user = route?.params?.user || null;
  const [inputText, setInputText] = useState('');
  const editorRef = useRef(null);

  const examplePlaceholder =
    'Câu 1: SQL là gì?\nA. Ngôn ngữ đánh dấu\n*B. Ngôn ngữ truy vấn có cấu trúc\nC. Hệ điều hành\nD. Trình duyệt';

  const questions = useMemo(() => parseQuestions(inputText), [inputText]);
  const totalPoints = 10;
  const pointsPerQuestion = questions.length > 0 ? totalPoints / questions.length : 0;
  const isValid = questions.length > 0
    && questions.every((q) => q.options.filter((opt) => opt.isCorrect).length === 1);
  const invalidQuestions = useMemo(
    () => questions.filter((q) => q.options.filter((opt) => opt.isCorrect).length !== 1),
    [questions]
  );

  const [showMissingAnswerModal, setShowMissingAnswerModal] = useState(false);
  const [missingNumbers, setMissingNumbers] = useState('');

  const handleContinue = () => {
    // Nếu đang có modal lỗi thì không cho tiếp tục
    if (showMissingAnswerModal) return;
    if (questions.length === 0) {
      setMissingNumbers('Vui lòng nhập ít nhất 1 câu hỏi trước khi tiếp tục.');
      setShowMissingAnswerModal(true);
      editorRef.current?.focus();
      return;
    }

    if (invalidQuestions.length > 0) {
      const missing = invalidQuestions.map((q) => `Câu ${q.number}`).join(', ');
      setMissingNumbers(`Vui lòng chọn đáp án đúng cho: ${missing}.`);
      setShowMissingAnswerModal(true);
      return;
    }

    // Chỉ lấy các câu hỏi hợp lệ (đủ 4 đáp án, có 1 đáp án đúng)
    const validQuestions = questions.filter(q => q.options.length === 4 && q.options.some(opt => opt.isCorrect));
    navigation.navigate('TeacherManualExamForm', {
      user,
      questions: validQuestions,
    });
  };

  const updateCorrectAnswer = (questionIndex, optionIndex) => {
    const nextQuestions = questions.map((q, idx) => {
      if (idx !== questionIndex) return q;
      return {
        ...q,
        options: q.options.map((opt, optIdx) => ({
          ...opt,
          isCorrect: optIdx === optionIndex,
        })),
      };
    });

    setInputText(buildTextFromQuestions(nextQuestions));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.replace('TeacherDashboard', { initialTab: 'exams' })}
          >
            <MaterialIcons name="arrow-back" size={18} color={COLORS.onSurface} />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo đề thi thủ công</Text>
          <Text style={styles.headerSubtitle}>
            Nhập câu hỏi theo định dạng. Dấu * là đáp án đúng.
          </Text>
        </View>

        <View style={styles.editorSection}>
          <TextInput
            style={styles.textArea}
            placeholder={examplePlaceholder}
            placeholderTextColor={COLORS.onSurfaceVariant}
            multiline
            value={inputText}
            onChangeText={setInputText}
            ref={editorRef}
          />
        </View>

        <View style={styles.previewSection}>
          {questions.length > 0 ? (
            questions.map((question, index) => (
              <PreviewCard
                key={`${question.number}-${index}`}
                number={question.number}
                question={question.question}
                options={question.options}
                pointsPerQuestion={pointsPerQuestion}
                onSelectOption={(optionIndex) => updateCorrectAnswer(index, optionIndex)}
              />
            ))
          ) : (
            <Text style={styles.emptyPreview}>Chưa có câu hỏi để xem trước.</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>Tiếp tục</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Modal xác nhận thiếu đáp án đúng */}
      <Modal
        visible={showMissingAnswerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMissingAnswerModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, minWidth: 280, alignItems: 'center' }}>
            <MaterialIcons name="error-outline" size={36} color={COLORS.primary} style={{ marginBottom: 12 }} />
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Thiếu đáp án đúng</Text>
            <Text style={{ color: COLORS.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>{missingNumbers}</Text>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32, marginTop: 8 }}
              onPress={() => setShowMissingAnswerModal(false)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const PreviewCard = ({ number, question, options, pointsPerQuestion, onSelectOption }) => (
  <View style={styles.previewCard}>
    <View style={styles.previewHeaderRow}>
      <View style={styles.previewBadge}>
        <Text style={styles.previewBadgeText}>Câu {number}</Text>
      </View>
      <Text style={styles.pointsText}>{pointsPerQuestion.toFixed(2)} điểm</Text>
    </View>
    <Text style={styles.previewQuestion}>{question}</Text>
    <View style={styles.optionsGrid}>
      {options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.optionItem, opt.isCorrect && styles.optionItemCorrect]}
          onPress={() => onSelectOption(idx)}
        >
          <View style={[styles.optionLabel, opt.isCorrect && styles.optionLabelCorrect]}>
            <Text style={[styles.optionLabelText, opt.isCorrect && styles.optionLabelTextCorrect]}>
              {opt.label}
            </Text>
          </View>
          <Text style={[styles.optionText, opt.isCorrect && styles.optionTextCorrect]}>{opt.text}</Text>
          {opt.isCorrect ? (
            <MaterialIcons name="check-circle" size={18} color="#16a34a" />
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceContainerLowest },
  scrollContent: { padding: 16, paddingBottom: 24 },
  headerSection: {
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
    marginBottom: 10,
  },
  backButtonText: { color: COLORS.onSurface, fontSize: 12, fontWeight: '700' },
  headerTitle: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: COLORS.onSurfaceVariant, fontSize: 12, marginTop: 4 },
  editorSection: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 180,
    textAlignVertical: 'top',
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.onSurface,
  },
  previewSection: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
  },
  emptyPreview: { color: COLORS.onSurfaceVariant, fontSize: 12 },
  previewCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 16,
  },
  previewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  previewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  pointsText: { color: COLORS.onSurfaceVariant, fontSize: 11, fontWeight: '700' },
  previewQuestion: { color: COLORS.onSurface, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  optionsGrid: { gap: 10 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  optionItemCorrect: { borderColor: 'rgba(34, 197, 94, 0.4)', backgroundColor: 'rgba(34, 197, 94, 0.08)' },
  optionLabel: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  optionLabelCorrect: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  optionLabelText: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant },
  optionLabelTextCorrect: { color: '#ffffff' },
  optionText: { flex: 1, color: COLORS.onSurfaceVariant, fontSize: 13 },
  optionTextCorrect: { color: '#14532d', fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eceef0',
  },
  secondaryButtonText: { color: '#44474e', fontSize: 12, fontWeight: '700' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});

export default ExamEditorContent;