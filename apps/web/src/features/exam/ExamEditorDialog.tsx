import { useEffect, useState } from 'react';
import type { ExamInfo } from '@task-list/shared';
import { useCreateExam, useUpdateExam } from '../../api/exams';
import { DEFAULT_EXAM_STATUS, EXAM_TYPE_META, EXAM_TYPES } from './exam-copy';

export interface ExamEditorDialogProps {
  open: boolean;
  /** 为 null 时是「添加」，否则是「编辑」。 */
  exam: ExamInfo | null;
  onClose: () => void;
}

interface FieldState {
  title: string;
  type: 'exam' | 'interview';
  company: string;
  deadline: string;
  appliedAt: string;
  url: string;
  location: string;
  status: string;
  notes: string;
}

const emptyFields = (): FieldState => ({
  title: '',
  type: 'exam',
  company: '',
  deadline: '',
  appliedAt: '',
  url: '',
  location: '',
  status: DEFAULT_EXAM_STATUS,
  notes: '',
});

function fieldsFromExam(exam: ExamInfo): FieldState {
  return {
    title: exam.title,
    type: exam.type,
    company: exam.company ?? '',
    deadline: exam.deadline ?? '',
    appliedAt: exam.appliedAt ?? '',
    url: exam.url ?? '',
    location: exam.location ?? '',
    status: exam.status,
    notes: exam.notes,
  };
}

const URL_RE = /^https?:\/\//i;

export function ExamEditorDialog({ open, exam, onClose }: ExamEditorDialogProps) {
  const [fields, setFields] = useState<FieldState>(emptyFields());
  const [titleError, setTitleError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const createMutation = useCreateExam();
  const updateMutation = useUpdateExam(exam?.id ?? '');

  useEffect(() => {
    if (open) {
      setFields(exam ? fieldsFromExam(exam) : emptyFields());
      setTitleError('');
      setUrlError('');
      setSubmitError('');
    }
  }, [open, exam]);

  if (!open) {
    return null;
  }

  const set = (patch: Partial<FieldState>) => setFields((f) => ({ ...f, ...patch }));
  const submitting = createMutation.isPending || updateMutation.isPending;

  const validate = (): boolean => {
    let ok = true;
    if (fields.title.trim() === '') {
      setTitleError('标题不能为空');
      ok = false;
    } else {
      setTitleError('');
    }
    const url = fields.url.trim();
    if (url !== '' && !URL_RE.test(url)) {
      setUrlError('URL 必须以 http:// 或 https:// 开头');
      ok = false;
    } else {
      setUrlError('');
    }
    return ok;
  };

  const buildInput = () => ({
    title: fields.title.trim(),
    type: fields.type,
    company: fields.company.trim() || null,
    deadline: fields.deadline || null,
    appliedAt: fields.appliedAt || null,
    url: fields.url.trim() || null,
    location: fields.location.trim() || null,
    status: fields.status.trim(),
    notes: fields.notes,
  });

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    setSubmitError('');
    try {
      if (exam) {
        await updateMutation.mutateAsync(buildInput());
      } else {
        await createMutation.mutateAsync(buildInput());
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={exam ? '编辑考试/面试信息' : '添加考试/面试信息'}>
      <h2>{exam ? '编辑' : '添加'}考试/面试信息</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <p>
          <label>
            标题 *
            <input value={fields.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          {titleError ? <span role="alert">{titleError}</span> : null}
        </p>

        <fieldset>
          <legend>类型</legend>
          {EXAM_TYPES.map((type) => (
            <label key={type}>
              <input
                type="radio"
                name="exam-type"
                checked={fields.type === type}
                onChange={() => set({ type })}
              />
              {EXAM_TYPE_META[type].label}
            </label>
          ))}
        </fieldset>

        <p>
          <label>
            公司
            <input value={fields.company} onChange={(e) => set({ company: e.target.value })} />
          </label>
        </p>
        <p>
          <label>
            截止时间
            <input
              type="date"
              value={fields.deadline}
              onChange={(e) => set({ deadline: e.target.value })}
            />
          </label>
        </p>
        <p>
          <label>
            投递时间
            <input
              type="date"
              value={fields.appliedAt}
              onChange={(e) => set({ appliedAt: e.target.value })}
            />
          </label>
        </p>
        <p>
          <label>
            URL
            <input value={fields.url} onChange={(e) => set({ url: e.target.value })} />
          </label>
          {urlError ? <span role="alert">{urlError}</span> : null}
        </p>
        <p>
          <label>
            地点
            <input value={fields.location} onChange={(e) => set({ location: e.target.value })} />
          </label>
        </p>
        <p>
          <label>
            状态
            <input value={fields.status} onChange={(e) => set({ status: e.target.value })} />
          </label>
        </p>
        <p>
          <label>
            备注
            <textarea value={fields.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </p>

        {submitError ? <p role="alert">{submitError}</p> : null}

        <div>
          <button type="submit" disabled={submitting}>
            {submitting ? '保存中…' : '保存'}
          </button>{' '}
          <button type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}