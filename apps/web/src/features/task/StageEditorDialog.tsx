import { useRef, useState } from 'react';
import type { Stage, Task } from '@task-list/shared';
import { useAddStage, useDeleteStage, useReorderStages, useUpdateStage } from '../../api/tasks';
import { Button } from '../../ui';
import { useDialogModal } from './dialog-a11y';
import { DueDatePicker } from './DueDatePicker';
import { isStageOverdue, sortedStages } from './task-utils';

export interface StageEditorDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

/**
 * 阶段增删改 + 截止时间 + 上下调整顺序。
 *
 * 每个操作即时持久化（走对应 mutation，成功后由 TanStack Query 失效重取），
 * 不做乐观本地状态复制。重排走批量端点（一次提交整组顺序）。
 */
export function StageEditorDialog({ task, open, onClose }: StageEditorDialogProps) {
  const addStage = useAddStage(task.id);
  const updateStage = useUpdateStage(task.id);
  const deleteStage = useDeleteStage(task.id);
  const reorderStages = useReorderStages(task.id);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogModal(dialogRef, open, onClose);

  const [nameDraft, setNameDraft] = useState('');

  const stages = sortedStages(task.stages);
  const addName = nameDraft.trim();

  function handleAdd() {
    if (addName.length === 0) return;
    addStage.mutate({ name: addName }, { onSuccess: () => setNameDraft('') });
  }

  function handleMove(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= stages.length) return;
    const ids = stages.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderStages.mutate(ids);
  }

  function handleRename(stage: Stage, name: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === stage.name) return;
    updateStage.mutate({ stageId: stage.id, input: { name: trimmed } });
  }

  function handleDelete(stage: Stage) {
    const isCurrent = stage.id === task.currentStageId;
    const message = isCurrent
      ? `删除当前阶段「${stage.name}」？删除后系统会自动切换到下一个未完成阶段。`
      : `删除阶段「${stage.name}」？`;
    if (!window.confirm(message)) return;
    deleteStage.mutate(stage.id);
  }

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="编辑阶段"
      tabIndex={-1}
    >
      <div className="dialog">
        <h2>阶段与截止时间</h2>

        <ul className="stage-editor-list">
          {stages.map((stage, index) => {
            const overdue = isStageOverdue(stage);
            const isCurrent = stage.id === task.currentStageId;
            return (
              <li key={stage.id} className={isCurrent ? 'current' : undefined}>
                <span className="stage-pill" aria-hidden="true">
                  {stage.status === 'done' ? '✓' : String(index + 1)}
                </span>
                <input
                  defaultValue={stage.name}
                  aria-label={`阶段名 ${index + 1}`}
                  onBlur={(e) => handleRename(stage, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
                <DueDatePicker
                  value={stage.dueDate}
                  onChange={(v) => updateStage.mutate({ stageId: stage.id, input: { dueDate: v } })}
                  aria-label={`截止时间 ${index + 1}`}
                />
                {overdue && <span className="overdue">逾期</span>}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label={`上移阶段 ${index + 1}`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === stages.length - 1}
                  aria-label={`下移阶段 ${index + 1}`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDelete(stage)}
                  aria-label={`删除阶段 ${index + 1}`}
                >
                  删除
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="stage-add-row">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="新阶段名称"
            aria-label="新阶段名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" variant="primary" onClick={handleAdd} disabled={addName.length === 0}>
            新增阶段
          </Button>
        </div>

        <p className="hint">删除当前阶段后系统会自动切换到下一个未完成阶段。</p>
        <Button type="button" variant="secondary" className="dialog-close" onClick={onClose}>
          关闭
        </Button>
      </div>
    </div>
  );
}