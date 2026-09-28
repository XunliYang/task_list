import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '@task-list/shared';
import { useStatuses } from '../../api/statuses';
import { useUpdateTask } from '../../api/tasks';

export interface TaskEditDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

/** 任务基本信息编辑弹窗（标题/公司/标签/状态分类/备注）。 */
export function TaskEditDialog({ task, open, onClose }: TaskEditDialogProps) {
  const updateTask = useUpdateTask(task.id);
  const statuses = useStatuses();

  const [title, setTitle] = useState(task.title);
  const [company, setCompany] = useState(task.company ?? '');
  const [tags, setTags] = useState<string[]>(task.tags);
  const [tagDraft, setTagDraft] = useState('');
  const [statusId, setStatusId] = useState(task.statusId);
  const [notes, setNotes] = useState(task.notes);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setCompany(task.company ?? '');
      setTags(task.tags);
      setTagDraft('');
      setStatusId(task.statusId);
      setNotes(task.notes);
      setTouched(false);
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (titleInvalid) return;
    updateTask.mutate(
      {
        title: title.trim(),
        company: company.trim() === '' ? null : company.trim(),
        tags,
        statusId,
        notes,
      },
      { onSuccess: onClose },
    );
  }

  if (!open) return null;

  const statusOptions = statuses.data ?? [];
  const hasCurrent = statusOptions.some((s) => s.id === statusId);

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="编辑任务">
      <form className="dialog" onSubmit={handleSubmit} noValidate>
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

        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={!canSubmit}>
            保存
          </button>
        </div>
      </form>
    </div>
  );
}