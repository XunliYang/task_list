import { useEffect, useState } from 'react';
import type { ExamInfo } from '@task-list/shared';
import { useCreateExam, useUpdateExam } from '../../api/exams';
import { Button, SuccessMorphButton } from '../../ui';
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

  // 返回真实请求 Promise；校验/请求失败时抛错让 SuccessMorphButton 进入 error 态（不伪造成功）。
  const handleSubmit = async () => {
    if (!validate()) {
      throw new Error('表单校验未通过');
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
      throw err;
    }
  };

  return (
    <div
      className="exam-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={exam ? '编辑考试/面试信息' : '添加考试/面试信息'}
    >
      <h2>{exam ? '编辑' : '添加'}考试/面试信息</h2>

      <p>
        <label className="exam-field-label" htmlFor="exam-title">
          标题 *{' '}
        </label>
        <input
          id="exam-title"
          className="exam-field"
          autoFocus
          value={fields.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        {titleError ? (
          <span className="exam-inline-error" role="alert">
            {titleError}
          </span>
        ) : null}
      </p>

      <fieldset>
        <legend>类型</legend>
        {EXAM_TYPES.map((type) => (
          <label key={type} className="exam-radio">
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
        <label className="exam-field-label" htmlFor="exam-company">
          公司{' '}
        </label>
        <input
          id="exam-company"
          className="exam-field"
          value={fields.company}
          onChange={(e) => set({ company: e.target.value })}
        />
      </p>
      <p>
        <label className="exam-field-label" htmlFor="exam-deadline">
          截止时间{' '}
        </label>
        <input
          id="exam-deadline"
          className="exam-field"
          type="date"
          value={fields.deadline}
          onChange={(e) => set({ deadline: e.target.value })}
        />
      </p>
      <p>
        <label className="exam-field-label" htmlFor="exam-appliedAt">
          投递时间{' '}
        </label>
        <input
          id="exam-appliedAt"
          className="exam-field"
          type="date"
          value={fields.appliedAt}
          onChange={(e) => set({ appliedAt: e.target.value })}
        />
      </p>
      <p>
        <label className="exam-field-label" htmlFor="exam-url">
          URL{' '}
        </label>
        <input
          id="exam-url"
          className="exam-field"
          value={fields.url}
          onChange={(e) => set({ url: e.target.value })}
        />
        {urlError ? (
          <span className="exam-inline-error" role="alert">
            {urlError}
          </span>
        ) : null}
      </p>
      <p>
        <label className="exam-field-label" htmlFor="exam-location">
          地点{' '}
        </label>
        <input
          id="exam-location"
          className="exam-field"
          value={fields.location}
          onChange={(e) => set({ location: e.target.value })}
        />
      </p>
      <p>
        <label className="exam-field-label" htmlFor="exam-status">
          状态{' '}
        </label>
        <input
          id="exam-status"
          className="exam-field"
          value={fields.status}
          onChange={(e) => set({ status: e.target.value })}
        />
      </p>
      <p>
        <label className="exam-field-label" htmlFor="exam-notes">
          备注{' '}
        </label>
        <textarea
          id="exam-notes"
          className="exam-field"
          value={fields.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </p>

      {submitError ? (
        <p className="exam-inline-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="exam-dialog-actions">
        <SuccessMorphButton onAction={handleSubmit}>保存</SuccessMorphButton>
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
      </div>
    </div>
  );
}