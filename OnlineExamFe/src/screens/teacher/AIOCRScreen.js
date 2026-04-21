import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  TextInput,
} from 'react-native';
// Sử dụng Lucide cho các Icon hiện đại
import { CloudUpload, Bolt, ArrowRight } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { API_BASE_URL } from '../../config/api';
import { useToast } from '../../context/ToastContext';

// --- DESIGN SYSTEM TOKENS ---
const COLORS = {
  primary: '#00357f',
  primaryContainer: '#004aad',
  surface: '#f7f9fb', // Base Layer
  surfaceContainerLow: '#f2f4f6', // Secondary Layer
  surfaceContainerLowest: '#ffffff', // Top Interactive Layer
  onSurface: '#191c1e',
  onSurfaceVariant: '#434653',
  primaryFixed: '#d9e2ff',
  secondaryContainer: '#d5e3fc',
  outlineVariant: 'rgba(195, 198, 213, 0.3)', // Ghost border
};

const QuestionItem = ({
  number,
  question,
  options,
  selectedIndex,
  onChangeQuestion,
  onChangeOption,
  onSelectCorrect,
  onAddOption,
}) => (
  <View style={styles.questionCard}>
    <View style={styles.questionHeader}>
      <View style={styles.questionBadge}>
        <Text style={styles.questionBadgeText}>{number}</Text>
      </View>
      <TextInput
        style={styles.questionInput}
        value={question}
        onChangeText={onChangeQuestion}
        placeholder="Nhập nội dung câu hỏi"
        placeholderTextColor={COLORS.onSurfaceVariant}
        multiline
      />
    </View>
    <View style={styles.optionsGrid}>
      {options.map((opt, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.optionItem, selectedIndex === index && styles.optionSelected]}
          onPress={() => onSelectCorrect(index)}
        >
          <View style={styles.optionLabelWrapper}>
            <Text style={[styles.optionLabel, selectedIndex === index && styles.optionLabelActive]}>
              {opt.label}.
            </Text>
          </View>
          <TextInput
            style={[styles.optionInput, selectedIndex === index && styles.optionContentActive]}
            value={opt.text}
            onChangeText={(value) => onChangeOption(index, value)}
            placeholder="Nhập đáp án"
            placeholderTextColor={COLORS.onSurfaceVariant}
          />
          {selectedIndex === index ? (
            <MaterialIcons name="check-circle" size={18} color="#16a34a" />
          ) : null}
        </TouchableOpacity>
      ))}
      {options.length < 4 ? (
        <TouchableOpacity style={styles.addOptionButton} onPress={onAddOption}>
          <MaterialIcons name="add" size={16} color={COLORS.primary} />
          <Text style={styles.addOptionText}>Thêm đáp án</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

export default function AIOCRScreen({ navigation }) {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [editableQuestions, setEditableQuestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    setSelectedFile({
      name: file.name,
      size: file.size,
      type: file.mimeType,
      uri: file.uri,
      file: file.file,
    });
  }, []);

  const handleDragOver = useCallback((event) => {
    if (Platform.OS === 'web') {
      event.preventDefault();
    }
  }, []);

  const handleDrop = useCallback((event) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    setSelectedFile({
      name: file.name,
      size: file.size,
      type: file.type,
      uri: URL.createObjectURL(file),
      file,
    });
  }, []);

  const hasFile = Boolean(selectedFile?.uri || selectedFile?.file);

  const handleAnalyze = useCallback(async () => {
    if (!hasFile) {
      showToast('Vui lòng chọn file ảnh hoặc PDF trước.', 'error');
      return;
    }

    const formData = new FormData();
    if (Platform.OS === 'web' && selectedFile?.file) {
      formData.append('file', selectedFile.file);
    } else {
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name || 'upload',
        type: selectedFile.type || 'application/octet-stream',
      });
    }

    try {
      setIsAnalyzing(true);
      const response = await fetch(`${API_BASE_URL}/api/ai-ocr/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.message || `Lỗi ${response.status}: Không phân tích được.`;
        showToast(message, 'error');
        return;
      }

      const data = await response.json();
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!questions.length) {
        showToast('Không trích xuất được câu hỏi từ file này.', 'info');
      }
      setExtractedQuestions(questions);
      setEditableQuestions(
        questions.map((item, index) => ({
          number: item.number || index + 1,
          question: item.question || '',
          options: Array.isArray(item.options)
            ? item.options.map((opt, optIndex) => ({
              label: opt.label || String.fromCharCode(65 + optIndex),
              text: opt.text || '',
            }))
            : [],
          correctIndex: Number.isInteger(item.correctIndex) ? item.correctIndex : null,
        }))
      );
    } catch (error) {
      showToast(error?.message || 'Không thể kết nối máy chủ OCR.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [hasFile, selectedFile, showToast]);

  const displayQuestions = useMemo(() => editableQuestions, [editableQuestions]);

  const updateQuestionText = (questionIndex, value) => {
    setEditableQuestions((prev) =>
      prev.map((q, idx) => (idx === questionIndex ? { ...q, question: value } : q))
    );
  };

  const updateOptionText = (questionIndex, optionIndex, value) => {
    setEditableQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== questionIndex) return q;
        const nextOptions = q.options.map((opt, optIdx) =>
          optIdx === optionIndex ? { ...opt, text: value } : opt
        );
        return { ...q, options: nextOptions };
      })
    );
  };

  const selectCorrectOption = (questionIndex, optionIndex) => {
    setEditableQuestions((prev) =>
      prev.map((q, idx) => (idx === questionIndex ? { ...q, correctIndex: optionIndex } : q))
    );
  };

  const addOption = (questionIndex) => {
    setEditableQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== questionIndex) return q;
        if (q.options.length >= 4) return q;
        const nextLabel = String.fromCharCode(65 + q.options.length);
        return {
          ...q,
          options: [...q.options, { label: nextLabel, text: '' }],
        };
      })
    );
  };

  const handleContinue = () => {
    if (displayQuestions.length === 0) {
      Alert.alert('Chưa có câu hỏi', 'Vui lòng phân tích hoặc nhập câu hỏi trước khi tiếp tục.');
      return;
    }

    const invalidQuestions = displayQuestions.filter((q) =>
      !Number.isInteger(q.correctIndex)
    );

    if (invalidQuestions.length > 0) {
      const missingNumbers = invalidQuestions.map((q) => `Câu ${q.number}`).join(', ');
      Alert.alert('Thiếu đáp án đúng', `Vui lòng chọn đáp án đúng cho: ${missingNumbers}.`);
      return;
    }

    const formattedQuestions = displayQuestions.map((q) => ({
      number: q.number,
      question: q.question,
      options: q.options.map((opt, index) => ({
        label: opt.label || String.fromCharCode(65 + index),
        text: opt.text,
        isCorrect: q.correctIndex === index,
      })),
    }));

    navigation.navigate('TeacherManualExamForm', {
      questions: formattedQuestions,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={18} color={COLORS.onSurface} />
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo đề thi bằng AI OCR</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* 2. File Upload Area */}
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handlePickFile}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <View style={styles.uploadIconCircle}>
            <CloudUpload size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.uploadTitle}>Kéo thả ảnh hoặc file PDF tại đây</Text>
          <Text style={styles.uploadSubtitle}>Hỗ trợ định dạng JPG, PNG, PDF tối đa 20MB</Text>

          {selectedFile ? (
            <View style={styles.fileInfo}>
              <MaterialIcons name="insert-drive-file" size={18} color={COLORS.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
            </View>
          ) : null}
          
          <View style={styles.uploadButton}>
            <Text style={styles.uploadButtonText}>Chọn tệp từ thiết bị</Text>
          </View>
        </TouchableOpacity>

        {/* 3. Analysis Section */}
        <View style={styles.analysisContainer}>
          <TouchableOpacity style={styles.startBtn} onPress={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Bolt size={20} color="#fff" fill="#fff" />
            )}
            <Text style={styles.startBtnText}>
              {isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu phân tích'}
            </Text>
          </TouchableOpacity>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Câu hỏi đã trích xuất</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{displayQuestions.length} câu hỏi</Text>
            </View>
          </View>

          {displayQuestions.length > 0 ? (
            displayQuestions.map((item, idx) => (
              <QuestionItem
                key={`${item.number}-${idx}`}
                number={item.number}
                question={item.question}
                options={item.options}
                selectedIndex={item.correctIndex}
                onChangeQuestion={(value) => updateQuestionText(idx, value)}
                onChangeOption={(optIndex, value) => updateOptionText(idx, optIndex, value)}
                onSelectCorrect={(optIndex) => selectCorrectOption(idx, optIndex)}
                onAddOption={() => addOption(idx)}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Chưa có dữ liệu trích xuất.</Text>
          )}
        </View>
      </ScrollView>

      {/* 4. Bottom Action Bar */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleContinue}>
          <Text style={styles.nextButtonText}>Tiếp tục</Text>
          <ArrowRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  
  // Header styles
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
    paddingBottom: 8,
    backgroundColor: 'rgba(247, 249, 251, 0.8)',
    ...Platform.select({ ios: { zIndex: 10 }, android: { elevation: 4 } }),
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
  backText: { color: COLORS.onSurface, fontWeight: '700', fontSize: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary },

  scrollBody: { paddingBottom: 100 },

  // Upload Area styles
  uploadArea: {
    margin: 20,
    padding: 32,
    borderWidth: 2,
    borderColor: COLORS.outlineVariant,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontSize: 15, fontWeight: '600', color: COLORS.onSurface, marginBottom: 8 },
  uploadSubtitle: { fontSize: 13, color: COLORS.onSurfaceVariant, textAlign: 'center', marginBottom: 24 },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: 16,
    maxWidth: '100%',
  },
  fileName: { fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1 },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  uploadButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Analysis List styles
  analysisContainer: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 400,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    elevation: 2,
  },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    paddingBottom: 8,
    marginBottom: 16,
  },
  listTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onSurface },
  countBadge: { backgroundColor: COLORS.secondaryContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  countText: { fontSize: 11, fontWeight: '600', color: COLORS.onSurfaceVariant },

  // Question Card styles
  questionCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 213, 0.3)',
    elevation: 1,
  },
  questionHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  questionBadge: { 
    width: 24, height: 24, backgroundColor: COLORS.primaryFixed, 
    borderRadius: 4, justifyContent: 'center', alignItems: 'center' 
  },
  questionBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  questionText: { flex: 1, fontSize: 14, color: COLORS.onSurface, lineHeight: 20, fontWeight: '500' },
  questionInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.onSurface,
    lineHeight: 20,
    fontWeight: '500',
    padding: 0,
  },
  optionsGrid: { gap: 8, paddingLeft: 36 },
  optionItem: { 
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 213, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionSelected: { backgroundColor: 'rgba(0, 74, 173, 0.1)', borderColor: COLORS.primaryContainer },
  optionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  optionLabelActive: { color: COLORS.primaryContainer },
  optionLabelWrapper: { width: 22 },
  optionInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  optionContentActive: { color: COLORS.onSurface, fontWeight: '600' },
  addOptionButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 53, 127, 0.08)',
  },
  addOptionText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // Footer styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surfaceContainerLowest,
    padding: 16,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  nextButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});