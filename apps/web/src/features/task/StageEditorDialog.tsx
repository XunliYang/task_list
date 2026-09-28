import { useState } from 'react';
import type { Stage, Task } from '@task-list/shared';
import { useAddStage, useDeleteStage, useUpdateStage } from '../../api/tasks';
import { DueDatePicker } from './DueDatePicker';
import { isStageOverdue, sortedStages } from './task-utils';

export interface StageEditorDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

/**
 * 阶段增删改 + 截止时间。
 *
 * 每个操作即时持久化（走对应 mutation，成功后由 TanStack Query 失效重取），
 * 不做乐观本地状态复制。
 *
 * 注：阶段「上下调整顺序」依赖 LEOY-83 提供阶段 order 更新接口（当前
 * `UpdateStageInput` 无 order 字段、亦无批量重排端点），本 issue 文件范围内
 * 无法实现，故此处不提供排序控件，已在上报中说明。
 */
export function StageEditorDialog({ task, open, onClose }: StageEditorDialogProps) {
  const addStage = useAddStage(task.id);
  const updateStage = useUpdateStage(task.id);
  const deleteStage = useDeleteStage(task.id);

  const [nameDraft, setNameDraft] = useState('');

  const stages = sortedStages(task.stages);
  const addName = nameDraft.trim();

  function handleAdd() {
    if (addName.length === 0) return;
    addStage.mutate({ name: addName }, { onSuccess: () => setNameDraft('') });
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
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label="编辑阶段">
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
                {overdue && (
                  <span className="overdue" style={{ color: 'red' }}>
                    逾期
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(stage)}
                  aria-label={`删除阶段 ${index + 1}`}
                >
                  删除
                </button>
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
          <button type="button" onClick={handleAdd} disabled={addName.length === 0}>
            新增阶段
          </button>
        </div>

        <p className="hint">删除当前阶段后系统会自动切换到下一个未完成阶段。</p>
        <button type="button" className="dialog-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}