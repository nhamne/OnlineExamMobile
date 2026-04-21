import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../../context/ToastContext';
import {
  createTeacherExamQuestion,
  deleteTeacherExamQuestion,
  getTeacherExamDetail,
  updateTeacherExam,
  updateTeacherExamQuestion,
} from '../../services/authService';

const COLORS = {
  primary: '#005BBF',
  primaryContainer: '#004aad',
  surface: '#f7f9fb',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVariant: '#434653',
  outlineVariant: 'rgba(195, 198, 213, 0.4)',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
};

const QuestionCard = ({
  number,
  question,
  hasError,
  options = [],
  correctOption,
  onDelete,
  onEdit,
  isEditing,
  editQuestion,
  editOptions,
  editCorrectOption,
  onChangeQuestion,
  onChangeOption,
  onChangeCorrectOption,
  onCancelEdit,
  onSaveEdit,
  savingEdit,
}) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.badgeRow}>
        <Text style={styles.questionLabel}>CÂU {number}</Text>
        {hasError && (
          <View style={styles.errorBadge}>
            <Text style={styles.errorBadgeText}>LỖI NỘI DUNG</Text>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onEdit} hitSlop={10}>
          <MaterialIcons name="edit" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} hitSlop={10}>
          <MaterialIcons name="delete" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>

    {isEditing ? (
      <View style={styles.editSection}>
        <TextInput
          style={styles.editQuestionInput}
          value={editQuestion}
          onChangeText={onChangeQuestion}
          placeholder="Nhập nội dung câu hỏi"
          placeholderTextColor={COLORS.onSurfaceVariant}
        />
        {['A', 'B', 'C', 'D'].map((label, index) => (
          <View key={label} style={styles.editOptionRow}>
            <TouchableOpacity
              style={[styles.correctBadge, editCorrectOption === label && styles.correctBadgeActive]}
              onPress={() => onChangeCorrectOption(label)}
            >
              <Text
                style={[styles.correctBadgeText, editCorrectOption === label && styles.correctBadgeTextActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.editOptionInput}
              value={editOptions[label]}
              onChangeText={(value) => onChangeOption(label, value)}
              placeholder={`Đáp án ${label}`}
              placeholderTextColor={COLORS.onSurfaceVariant}
            />
          </View>
        ))}
        <View style={styles.editActionsRow}>
          <TouchableOpacity style={styles.editCancelButton} onPress={onCancelEdit}>
            <Text style={styles.editCancelText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editSaveButton, savingEdit && styles.editSaveButtonDisabled]}
            onPress={onSaveEdit}
            disabled={savingEdit}
          >
            {savingEdit ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.editSaveText}>Lưu</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      <>
        <Text style={styles.questionText}>{question}</Text>

        {hasError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={COLORS.onSurfaceVariant} />
            <Text style={styles.errorText}>Vui lòng cập nhật các lựa chọn cho câu hỏi này.</Text>
          </View>
        ) : (
          <View style={styles.optionsList}>
            {options.map((opt, index) => {
              const label = String.fromCharCode(65 + index);
              const isCorrect = correctOption === label;
              return (
                <View key={index} style={[styles.optionItem, isCorrect && styles.optionItemCorrect]}>
                  <View style={[styles.optionDot, isCorrect && styles.optionDotCorrect]} />
                  <Text style={[styles.optionLabel, isCorrect && styles.optionLabelCorrect]}>{label}.</Text>
                  <Text style={[styles.optionText, isCorrect && styles.optionTextCorrect]}>{opt}</Text>
                </View>
              );
            })}
          </View>
        )}
      </>
    )}
  </View>
);

export default function ExamDetailScreen({ navigation, route }) {
  const { showToast } = useToast();
  const routeExam = route?.params?.exam || null;
  const user = route?.params?.user || null;
  const examId = routeExam?.Id || routeExam?.id || route?.params?.examId || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exam, setExam] = useState(routeExam);
  const [questions, setQuestions] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [savingExam, setSavingExam] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState({ A: '', B: '', C: '', D: '' });
  const [correctOption, setCorrectOption] = useState(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState({ A: '', B: '', C: '', D: '' });
  const [editCorrectOption, setEditCorrectOption] = useState(null);
  const [savingEditQuestion, setSavingEditQuestion] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formIsDraft, setFormIsDraft] = useState(false);
  const originalExamRef = useRef(null);

  useEffect(() => {
    const loadDetail = async () => {
      if (!user?.id || !examId) {
        setError('Không tìm thấy thông tin đề thi.');
        setLoading(false);
        return;
      }

      try {
        setError('');
        const data = await getTeacherExamDetail(user.id, examId);
        setExam(data?.examPaper || null);
        setQuestions(Array.isArray(data?.questions) ? data.questions : []);
        setFormTitle(data?.examPaper?.Title || '');
        setFormSubject(data?.examPaper?.Subject || '');
        setFormDuration(String(data?.examPaper?.DurationInMinutes ?? ''));
        setFormIsDraft(Boolean(data?.examPaper?.IsDraft));
        originalExamRef.current = data?.examPaper || null;
      } catch (err) {
        setError(err?.response?.data?.message || 'Không tải được chi tiết đề thi.');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [user?.id, examId]);

  const questionItems = useMemo(() => (
    questions.map((q, index) => ({
      number: String(index + 1).padStart(2, '0'),
      question: q.Content,
      hasError: !q.OptionA || !q.OptionB || !q.OptionC || !q.OptionD,
      options: [q.OptionA, q.OptionB, q.OptionC, q.OptionD],
      correctOption: q.CorrectOption || null,
      id: q.Id,
    }))
  ), [questions]);

  const currentEditingQuestion = useMemo(
    () => (editingId ? questions.find((item) => item.Id === editingId) : null),
    [editingId, questions]
  );

  const isExamDirty = useMemo(() => {
    const originalExam = originalExamRef.current;
    if (!originalExam) return false;
    const titleChanged = formTitle.trim() !== String(originalExam.Title || '').trim();
    const subjectChanged = formSubject.trim() !== String(originalExam.Subject || '').trim();
    const durationChanged = Number(formDuration) !== Number(originalExam.DurationInMinutes || 0);
    const draftChanged = Boolean(formIsDraft) !== Boolean(originalExam.IsDraft);
    return titleChanged || subjectChanged || durationChanged || draftChanged;
  }, [formTitle, formSubject, formDuration, formIsDraft]);

  const isEditingDirty = useMemo(() => {
    if (!currentEditingQuestion) return false;
    if (editQuestion.trim() !== String(currentEditingQuestion.Content || '').trim()) return true;
    if (editOptions.A.trim() !== String(currentEditingQuestion.OptionA || '').trim()) return true;
    if (editOptions.B.trim() !== String(currentEditingQuestion.OptionB || '').trim()) return true;
    if (editOptions.C.trim() !== String(currentEditingQuestion.OptionC || '').trim()) return true;
    if (editOptions.D.trim() !== String(currentEditingQuestion.OptionD || '').trim()) return true;
    if ((editCorrectOption || '') !== (currentEditingQuestion.CorrectOption || '')) return true;
    return false;
  }, [currentEditingQuestion, editQuestion, editOptions, editCorrectOption]);

  const isDirty = isExamDirty || isEditingDirty;

  const performDelete = async (questionId) => {
    try {
      setDeletingId(questionId);
      await deleteTeacherExamQuestion(user.id, examId, questionId);
      setQuestions((prev) => prev.filter((item) => item.Id !== questionId));
      setExam((prev) => {
        if (!prev) return prev;
        const currentCount = Number(prev.QuestionCount ?? questions.length);
        const nextCount = Math.max(0, currentCount - 1);
        return { ...prev, QuestionCount: nextCount };
      });
      showToast('Đã xóa câu hỏi.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể xóa câu hỏi.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteQuestion = (questionId) => {
    if (!user?.id || !examId) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    if (!questionId) {
      showToast('Không tìm thấy câu hỏi để xóa.', 'error');
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bạn chắc chắn muốn xóa câu hỏi này?');
      if (confirmed) {
        performDelete(questionId);
      }
      return;
    }

    Alert.alert('Xóa câu hỏi', 'Bạn chắc chắn muốn xóa câu hỏi này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => performDelete(questionId),
      },
    ]);
  };

  const handleChangeOption = (key, value) => {
    setNewOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpenAddModal = () => {
    setNewQuestion('');
    setNewOptions({ A: '', B: '', C: '', D: '' });
    setCorrectOption(null);
    setShowAddModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!user?.id || !examId) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    if (!newQuestion.trim()) {
      showToast('Vui lòng nhập nội dung câu hỏi.', 'error');
      return;
    }

    if (!newOptions.A.trim() || !newOptions.B.trim() || !newOptions.C.trim() || !newOptions.D.trim()) {
      showToast('Vui lòng nhập đủ 4 đáp án.', 'error');
      return;
    }

    if (!correctOption) {
      showToast('Vui lòng chọn đáp án đúng.', 'error');
      return;
    }

    try {
      setSavingQuestion(true);
      const result = await createTeacherExamQuestion(user.id, examId, {
        content: newQuestion.trim(),
        optionA: newOptions.A.trim(),
        optionB: newOptions.B.trim(),
        optionC: newOptions.C.trim(),
        optionD: newOptions.D.trim(),
        correctOption,
      });

      if (result?.question) {
        setQuestions((prev) => [...prev, result.question]);
        setExam((prev) => {
          if (!prev) return prev;
          const currentCount = Number(prev.QuestionCount ?? questions.length);
          return { ...prev, QuestionCount: currentCount + 1 };
        });
      }

      setShowAddModal(false);
      showToast('Đã thêm câu hỏi.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể thêm câu hỏi.', 'error');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleStartEditQuestion = (item) => {
    setEditingId(item.id);
    setEditQuestion(item.question || '');
    setEditOptions({
      A: item.options[0] || '',
      B: item.options[1] || '',
      C: item.options[2] || '',
      D: item.options[3] || '',
    });
    setEditCorrectOption(item.correctOption || null);
  };

  const handleCancelEditQuestion = () => {
    setEditingId(null);
  };

  const handleChangeEditOption = (key, value) => {
    setEditOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEditQuestion = async (questionId) => {
    if (!user?.id || !examId) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    if (!editQuestion.trim()) {
      showToast('Vui lòng nhập nội dung câu hỏi.', 'error');
      return;
    }

    if (!editOptions.A.trim() || !editOptions.B.trim() || !editOptions.C.trim() || !editOptions.D.trim()) {
      showToast('Vui lòng nhập đủ 4 đáp án.', 'error');
      return;
    }

    if (!editCorrectOption) {
      showToast('Vui lòng chọn đáp án đúng.', 'error');
      return;
    }

    try {
      setSavingEditQuestion(true);
      const result = await updateTeacherExamQuestion(user.id, examId, questionId, {
        content: editQuestion.trim(),
        optionA: editOptions.A.trim(),
        optionB: editOptions.B.trim(),
        optionC: editOptions.C.trim(),
        optionD: editOptions.D.trim(),
        correctOption: editCorrectOption,
      });

      setQuestions((prev) => prev.map((item) => (
        item.Id === questionId ? (result?.question || {
          ...item,
          Content: editQuestion.trim(),
          OptionA: editOptions.A.trim(),
          OptionB: editOptions.B.trim(),
          OptionC: editOptions.C.trim(),
          OptionD: editOptions.D.trim(),
          CorrectOption: editCorrectOption,
        }) : item
      )));
      setEditingId(null);
      showToast('Đã cập nhật câu hỏi.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể cập nhật câu hỏi.', 'error');
    } finally {
      setSavingEditQuestion(false);
    }
  };

  const resetFormToOriginal = useCallback(() => {
    const originalExam = originalExamRef.current;
    if (!originalExam) return;
    setFormTitle(originalExam.Title || '');
    setFormSubject(originalExam.Subject || '');
    setFormDuration(String(originalExam.DurationInMinutes ?? ''));
    setFormIsDraft(Boolean(originalExam.IsDraft));
  }, []);

  const discardPendingChanges = useCallback(() => {
    resetFormToOriginal();
    setEditingId(null);
    setEditQuestion('');
    setEditOptions({ A: '', B: '', C: '', D: '' });
    setEditCorrectOption(null);
  }, [resetFormToOriginal]);

  const savePendingChanges = useCallback(async () => {
    if (!user?.id || !examId) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return false;
    }

    if (isExamDirty) {
      if (!formTitle.trim()) {
        showToast('Vui lòng nhập tên đề thi.', 'error');
        return false;
      }

      if (!formSubject.trim()) {
        showToast('Vui lòng nhập môn học.', 'error');
        return false;
      }

      const durationValue = Number(formDuration);
      if (!Number.isFinite(durationValue) || durationValue <= 0) {
        showToast('Thời gian thi không hợp lệ.', 'error');
        return false;
      }

      try {
        setSavingExam(true);
        const result = await updateTeacherExam(user.id, examId, {
          title: formTitle.trim(),
          subject: formSubject.trim(),
          durationInMinutes: durationValue,
          isDraft: formIsDraft,
        });

        setExam(result?.examPaper || exam);
        originalExamRef.current = result?.examPaper || exam || originalExamRef.current;
      } catch (err) {
        showToast(err?.response?.data?.message || 'Không thể cập nhật đề thi.', 'error');
        return false;
      } finally {
        setSavingExam(false);
      }
    }

    if (isEditingDirty && editingId) {
      if (!editQuestion.trim()) {
        showToast('Vui lòng nhập nội dung câu hỏi.', 'error');
        return false;
      }

      if (!editOptions.A.trim() || !editOptions.B.trim() || !editOptions.C.trim() || !editOptions.D.trim()) {
        showToast('Vui lòng nhập đủ 4 đáp án.', 'error');
        return false;
      }

      if (!editCorrectOption) {
        showToast('Vui lòng chọn đáp án đúng.', 'error');
        return false;
      }

      try {
        setSavingEditQuestion(true);
        const result = await updateTeacherExamQuestion(user.id, examId, editingId, {
          content: editQuestion.trim(),
          optionA: editOptions.A.trim(),
          optionB: editOptions.B.trim(),
          optionC: editOptions.C.trim(),
          optionD: editOptions.D.trim(),
          correctOption: editCorrectOption,
        });

        setQuestions((prev) => prev.map((item) => (
          item.Id === editingId ? (result?.question || {
            ...item,
            Content: editQuestion.trim(),
            OptionA: editOptions.A.trim(),
            OptionB: editOptions.B.trim(),
            OptionC: editOptions.C.trim(),
            OptionD: editOptions.D.trim(),
            CorrectOption: editCorrectOption,
          }) : item
        )));
        setEditingId(null);
      } catch (err) {
        showToast(err?.response?.data?.message || 'Không thể cập nhật câu hỏi.', 'error');
        return false;
      } finally {
        setSavingEditQuestion(false);
      }
    }

    return true;
  }, [
    user?.id,
    examId,
    showToast,
    isExamDirty,
    formTitle,
    formSubject,
    formDuration,
    formIsDraft,
    exam,
    isEditingDirty,
    editingId,
    editQuestion,
    editOptions,
    editCorrectOption,
  ]);

  useEffect(() => {
    const beforeRemove = navigation.addListener('beforeRemove', (event) => {
      if (!isDirty) return;

      event.preventDefault();

      const confirmAction = async (shouldSave) => {
        if (shouldSave) {
          const saved = await savePendingChanges();
          if (saved) {
            navigation.dispatch(event.data.action);
          }
          return;
        }

        discardPendingChanges();
        navigation.dispatch(event.data.action);
      };

      setShowConfirmModal(true);
      confirmActionRef.current = confirmAction;
      return;
      // Modal xác nhận cập nhật đề thi
      const [showConfirmModal, setShowConfirmModal] = useState(false);
      const confirmActionRef = useRef(null);
      const handleConfirmSave = (shouldSave) => {
        setShowConfirmModal(false);
        if (confirmActionRef.current) {
          confirmActionRef.current(shouldSave);
          confirmActionRef.current = null;
        }
      };
          <Modal
            visible={showConfirmModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowConfirmModal(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, minWidth: 280, alignItems: 'center' }}>
                <MaterialIcons name="help-outline" size={36} color={COLORS.primary} style={{ marginBottom: 12 }} />
                <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Chưa lưu thay đổi</Text>
                <Text style={{ color: COLORS.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
                  Bạn có muốn lưu thay đổi trước khi rời đi không?
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ backgroundColor: '#e5e7eb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}
                    onPress={() => handleConfirmSave(false)}
                  >
                    <Text style={{ color: COLORS.onSurface, fontWeight: 'bold', fontSize: 15 }}>Không lưu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}
                    onPress={() => handleConfirmSave(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Lưu</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
    });

    return beforeRemove;
  }, [navigation, isDirty, savePendingChanges, discardPendingChanges]);

  const handleUpdateExam = async () => {
    if (!user?.id || !examId) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    if (!formTitle.trim()) {
      showToast('Vui lòng nhập tên đề thi.', 'error');
      return;
    }

    if (!formSubject.trim()) {
      showToast('Vui lòng nhập môn học.', 'error');
      return;
    }

    const durationValue = Number(formDuration);
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      showToast('Thời gian thi không hợp lệ.', 'error');
      return;
    }

    try {
      setSavingExam(true);
      const result = await updateTeacherExam(user.id, examId, {
        title: formTitle.trim(),
        subject: formSubject.trim(),
        durationInMinutes: durationValue,
        isDraft: formIsDraft,
      });

      setExam(result?.examPaper || exam);
      originalExamRef.current = result?.examPaper || exam || originalExamRef.current;
      showToast('Đã cập nhật đề thi.', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể cập nhật đề thi.', 'error');
    } finally {
      setSavingExam(false);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Chi tiết đề thi</Text>
          <Text style={styles.headerSubtitle}>Chỉnh sửa đề thi</Text>
        </View>
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdateExam} disabled={savingExam}>
          {savingExam ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.updateButtonText}>Cập nhật</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải chi tiết đề thi...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errorBoxInline}>
              <Text style={styles.errorTextInline}>{error}</Text>
            </View>
          ) : null}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tên đề thi</Text>
            <TextInput
              style={styles.infoInput}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Nhập tên đề thi"
              placeholderTextColor={COLORS.onSurfaceVariant}
            />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Môn học</Text>
            <TextInput
              style={styles.infoInput}
              value={formSubject}
              onChangeText={setFormSubject}
              placeholder="Nhập môn học"
              placeholderTextColor={COLORS.onSurfaceVariant}
            />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thời gian thi</Text>
            <View style={styles.durationRow}>
              <TextInput
                style={styles.infoInput}
                value={formDuration}
                onChangeText={setFormDuration}
                keyboardType="numeric"
                placeholder="Phút"
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              <Text style={styles.durationUnit}>phút</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Trạng thái</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={styles.statusOption}
                onPress={() => setFormIsDraft(false)}
              >
                <View style={[styles.statusDot, !formIsDraft && styles.statusDotActive]}> 
                  {!formIsDraft ? <View style={[styles.statusDotInner, styles.statusDotInnerPublish]} /> : null}
                </View>
                <Text style={[styles.statusText, !formIsDraft && styles.statusTextActive]}>Xuất bản</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.statusOption}
                onPress={() => setFormIsDraft(true)}
              >
                <View style={[styles.statusDot, formIsDraft && styles.statusDotActive]}>
                  {formIsDraft ? <View style={[styles.statusDotInner, styles.statusDotInnerDraft]} /> : null}
                </View>
                <Text style={[styles.statusText, formIsDraft && styles.statusTextActive]}>Bản nháp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Danh sách câu hỏi</Text>
          <Text style={styles.listCount}>Tổng: {exam?.QuestionCount ?? questions.length}</Text>
        </View>

        <View style={styles.listSection}>
          {questionItems.length > 0 ? (
            questionItems.map((item) => (
              <QuestionCard
                key={item.id}
                number={item.number}
                question={item.question}
                hasError={item.hasError}
                options={item.options}
                correctOption={item.correctOption}
                onDelete={() => handleDeleteQuestion(item.id)}
                onEdit={() => handleStartEditQuestion(item)}
                isEditing={editingId === item.id}
                editQuestion={editQuestion}
                editOptions={editOptions}
                editCorrectOption={editCorrectOption}
                onChangeQuestion={setEditQuestion}
                onChangeOption={handleChangeEditOption}
                onChangeCorrectOption={setEditCorrectOption}
                onCancelEdit={handleCancelEditQuestion}
                onSaveEdit={() => handleSaveEditQuestion(item.id)}
                savingEdit={savingEditQuestion}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Chưa có câu hỏi nào.</Text>
          )}
        </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fabContainer} activeOpacity={0.8} onPress={handleOpenAddModal}>
        <View style={styles.fabGradient}>
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Thêm câu hỏi</Text>
        </View>
      </TouchableOpacity>

      <Modal transparent visible={showAddModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="note-add" size={18} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Thêm câu hỏi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <MaterialIcons name="close" size={20} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.questionRow}>
                <Text style={styles.questionLabelModal}>Câu {questions.length + 1}</Text>
                <TextInput
                  style={styles.questionInput}
                  value={newQuestion}
                  onChangeText={setNewQuestion}
                  placeholder="Nhập nội dung câu hỏi"
                  placeholderTextColor={COLORS.onSurfaceVariant}
                />
              </View>

              {['A', 'B', 'C', 'D'].map((label) => (
                <View key={label} style={styles.optionRow}>
                  <TouchableOpacity
                    style={[styles.correctBadge, correctOption === label && styles.correctBadgeActive]}
                    onPress={() => setCorrectOption(label)}
                  >
                    <Text style={[styles.correctBadgeText, correctOption === label && styles.correctBadgeTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.optionInput}
                    value={newOptions[label]}
                    onChangeText={(value) => handleChangeOption(label, value)}
                    placeholder={`Đáp án ${label}`}
                    placeholderTextColor={COLORS.onSurfaceVariant}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalAddButton, savingQuestion && styles.modalAddButtonDisabled]}
              onPress={handleSaveQuestion}
              disabled={savingQuestion}
            >
              {savingQuestion ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalAddButtonText}>Thêm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onSurface },
  headerSubtitle: { fontSize: 12, color: COLORS.onSurfaceVariant },
  updateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  scrollContent: { paddingBottom: 120 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.onSurfaceVariant },
  errorBoxInline: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  errorTextInline: { color: '#b91c1c', fontSize: 12 },
  emptyText: { color: COLORS.onSurfaceVariant, fontSize: 12, marginTop: 8 },
  
  infoSection: {
    margin: 16,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    gap: 12,
  },
  infoRow: { gap: 6 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase' },
  infoInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durationUnit: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotActive: { borderColor: COLORS.primary },
  statusDotInner: { width: 8, height: 8, borderRadius: 4 },
  statusDotInnerPublish: { backgroundColor: '#16a34a' },
  statusDotInnerDraft: { backgroundColor: '#f59e0b' },
  statusText: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  statusTextActive: { color: COLORS.onSurface },
  statusSummary: { fontSize: 12, fontWeight: '700' },

  listHeaderRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.onSurface },
  listCount: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  listSection: { paddingHorizontal: 16 },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, opacity: 0.6 },
  errorBadge: { backgroundColor: COLORS.errorContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  errorBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.onErrorContainer },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  
  questionText: { fontSize: 15, color: COLORS.onSurface, lineHeight: 22, fontWeight: '600', marginBottom: 16 },
  
  errorBox: {
    height: 100,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  errorText: { fontSize: 13, color: COLORS.onSurfaceVariant, fontStyle: 'italic', textAlign: 'center' },

  optionsList: { gap: 12 },
  optionItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionItemCorrect: { backgroundColor: 'rgba(22, 163, 74, 0.08)', borderRadius: 8, padding: 6 },
  optionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, opacity: 0.4 },
  optionDotCorrect: { backgroundColor: '#16a34a', opacity: 1 },
  optionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  optionLabelCorrect: { color: '#166534' },
  optionText: { fontSize: 13, color: COLORS.onSurfaceVariant, flex: 1 },
  optionTextCorrect: { color: '#166534', fontWeight: '600' },

  editSection: { gap: 12 },
  editQuestionInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  editOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editOptionInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  editActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  editCancelText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  editSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  editSaveButtonDisabled: { opacity: 0.6 },
  editSaveText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    borderRadius: 30,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
    backgroundColor: COLORS.primary,
  },
  fabText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  modalBody: { gap: 12 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  questionLabelModal: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant, width: 50 },
  questionInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  correctBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  correctBadgeActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  correctBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  correctBadgeTextActive: { color: '#fff' },
  optionInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  modalAddButton: {
    marginTop: 16,
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalAddButtonDisabled: { opacity: 0.6 },
  modalAddButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});