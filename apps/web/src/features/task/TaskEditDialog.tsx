import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '@task-list/shared';
import { useStatuses } from '../../api/statuses';
import { useUpdateTask } from '../../api/tasks';
import { Button, SuccessMorphButton } from '../../ui';
import { useDialogModal } from './dialog-a11y';

export interface TaskEditDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

/** 任务基本信息编辑弹窗（标题/公司/标签/状态分类/备注）。 */
export function TaskEditDialog({ task, open, onClose }: TaskEditDialogProps) {
  const updateTask = useUpdateTask(task.id);
  const statuses = useStatuses();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogModal(dialogRef, open, onClose);

  const [title, setTitle] = useState(task.title);
  const [company, setCompany] = useState(task.company ?? '');
  const [tags, setTags] = useState<string[]>(task.tags);
  const [tagDraft, setTagDraft] = useState('');
  const [statusId, setStatusId] = useState(task.statusId);
  const [notes, setNotes] = useState(task.notes);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setCompany(task.company ?? '');
      setTags(task.tags);
      setTagDraft('');
      setStatusId(task.statusId);
      setNotes(task.notes);
      setTouched(false);
      setSubmitError(null);
    }
  }, [open, task]);

  const titleInvalid = title.trim().length === 0;
  const canSubmit = !titleInvalid && !updateTask.isPending;

  function addTag() {
    const tag = tagDraft.trim();
    if (tag.length > 0 && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagDraft('');
  }

  /** 提交前拦截表单 submit（Enter 在输入框内触发），实际提交由 SuccessMorphButton 驱动。 */
  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
  }

  // 返回真实请求 Promise；失败 rethrow → SuccessMorphButton error 态 + 行内错误可见。
  async function submitEdit(): Promise<void> {
    setTouched(true);
    if (titleInvalid) {
      throw new Error('标题不能为空');
    }
    setSubmitError(null);
    try {
      await updateTask.mutateAsync({
        title: title.trim(),
        company: company.trim() === '' ? null : company.trim(),
        tags,
        statusId,
        notes,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存失败，请稍后重试');
      throw err;
    }
  }

  if (!open) return null;

  const statusOptions = statuses.data ?? [];
  const hasCurrent = statusOptions.some((s) => s.id === statusId);

  return (
    <div
      ref={dialogRef}
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="编辑任务"
      tabIndex={-1}
    >
      <form className="dialog" onSubmit={handleFormSubmit} noValidate>
        <h2>编辑任务</h2>

        <label>
          标题 *
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="标题" />
        </label>
        {touched && titleInvalid && <p className="field-error">标题不能为空</p>}

        <label>
          公司
          <input value={company} onChange={(e) => setCompany(e.target.value)} aria-label="公司" />
        </label>

        <div className="field">
          <span>标签</span>
          <div className="tag-editor">
            {tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
                <button
                  type="button"
                  aria-label={`删除标签 ${tag}`}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="输入后回车添加"
              aria-label="标签"
            />
          </div>
        </div>

        <label>
          状态分类
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)} aria-label="状态分类">
            {!hasCurrent && <option value={statusId}>{statusId}</option>}
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          备注
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="备注" />
        </label>

        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}

        <div className="dialog-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <SuccessMorphButton
            variant="primary"
            successLabel="已保存"
            onAction={submitEdit}
            disabled={!canSubmit}
          >
            保存
          </SuccessMorphButton>
        </div>
      </form>
    </div>
  );
}