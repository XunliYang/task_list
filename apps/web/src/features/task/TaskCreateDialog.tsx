import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '@task-list/shared';
import { useStatuses } from '../../api/statuses';
import { useCreateTask } from '../../api/tasks';
import { DueDatePicker } from './DueDatePicker';
import { buildCreateTaskInput } from './task-create';
import type { TaskCreateStageDraft } from './task-create';
import './task.css';

export interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** 预选分类（看板列头「＋」/ `?statusId=`），可空：缺省取第一个分类。 */
  initialStatusId?: string | null;
  /** 创建成功后回调（父级据此展示「已创建」轻提示）。 */
  onCreated?: (task: Task) => void;
}

const EMPTY_STAGES: TaskCreateStageDraft[] = [{ name: '准备', dueDate: null }];

/**
 * 快捷新建任务弹窗：标题（必填）/ 公司 / 标签（回车追加、× 删除）/ 状态分类 /
 * 阶段（默认 1 个「准备」，可增删改名、可设截止时间）/ 备注。
 *
 * 提交走 `useCreateTask`，成功后 invalidate 并关闭弹窗；失败展示后端 message，不静默失败。
 */
export function TaskCreateDialog({
  open,
  onClose,
  initialStatusId = null,
  onCreated,
}: TaskCreateDialogProps) {
  const statusesQuery = useStatuses();
  const createTask = useCreateTask();

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [statusId, setStatusId] = useState('');
  const [stages, setStages] = useState<TaskCreateStageDraft[]>(EMPTY_STAGES);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const statusOptions = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [statusesQuery.data],
  );

  // 打开时重置为干净的初始表单。
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCompany('');
    setTags([]);
    setTagDraft('');
    setNotes('');
    setStages(EMPTY_STAGES);
    setTouched(false);
    setStatusId(initialStatusId ?? '');
  }, [open, initialStatusId]);

  // 优先用用户选中的 statusId；无效/未选时回退到预选分类，再回退到第一个分类。
  const effectiveStatusId = useMemo(() => {
    const has = (id: string) => statusOptions.some((s) => s.id === id);
    if (statusId && has(statusId)) return statusId;
    if (initialStatusId && has(initialStatusId)) return initialStatusId;
    return statusOptions[0]?.id ?? '';
  }, [statusId, initialStatusId, statusOptions]);

  const titleInvalid = title.trim().length === 0;
  // 阶段规整后（过滤空名）至少需 1 个：删除/清空全部阶段后禁止提交，与后端 min(1) 对齐。
  const stagesInvalid = stages.every((stage) => stage.name.trim().length === 0);
  const canSubmit = !titleInvalid && !stagesInvalid && !createTask.isPending;

  function updateStage(index: number, patch: Partial<TaskCreateStageDraft>) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStage() {
    setStages((prev) => [...prev, { name: '', dueDate: null }]);
  }

  function removeStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

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
    const input = buildCreateTaskInput({
      title,
      company,
      tags,
      statusId: effectiveStatusId,
      stages,
      notes,
    });
    if (!input) return;
    createTask.mutate(input, {
      onSuccess: (task) => {
        onCreated?.(task);
        onClose();
      },
    });
  }

  if (!open) return null;

  const submitError = createTask.isError
    ? createTask.error instanceof Error
      ? createTask.error.message
      : '创建失败，请稍后重试。'
    : '';

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="新建任务">
      <form className="dialog task-create-dialog" onSubmit={handleSubmit} noValidate>
        <h2>新建任务</h2>

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
          <select
            value={effectiveStatusId}
            onChange={(e) => setStatusId(e.target.value)}
            aria-label="状态分类"
          >
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>阶段</span>
          <ul className="stage-draft-list">
            {stages.map((stage, index) => (
              <li key={index}>
                <span className="stage-pill" aria-hidden="true">
                  {index + 1}
                </span>
                <input
                  value={stage.name}
                  onChange={(e) => updateStage(index, { name: e.target.value })}
                  aria-label={`阶段名 ${index + 1}`}
                  placeholder="阶段名称"
                />
                <DueDatePicker
                  value={stage.dueDate}
                  onChange={(v) => updateStage(index, { dueDate: v })}
                  aria-label={`截止时间 ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeStage(index)}
                  aria-label={`删除阶段 ${index + 1}`}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="create-add-stage" onClick={addStage}>
            ＋ 新增阶段
          </button>
          {stagesInvalid && <p className="field-error">至少保留一个阶段</p>}
        </div>

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
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={!canSubmit}>
            {createTask.isPending ? '创建中…' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
}