import { useState } from 'react';
import type { Task } from '@task-list/shared';
import { useAdvanceStage, useSetCurrentStage } from '../../api/tasks';
import { getFlowAction, previousStage, sortedStages } from './task-utils';

export interface StageFlowPanelProps {
  task: Task;
}

/** 阶段流转主控件：横向阶段展示 + 完成推进 + 回退到上一阶段。 */
export function StageFlowPanel({ task }: StageFlowPanelProps) {
  const advance = useAdvanceStage(task.id);
  const setCurrent = useSetCurrentStage(task.id);
  const [notice, setNotice] = useState<string | null>(null);

  const action = getFlowAction(task);
  const stages = sortedStages(task.stages);
  const prev = previousStage(task);
  const busy = advance.isPending || setCurrent.isPending;

  function handleAdvance() {
    if (action.disabled || busy) return;
    advance.mutate(undefined, {
      onSuccess: (result) => {
        setNotice(
          result.nextStage ? `已进入「${result.nextStage.name}」` : '已完成最后一个阶段',
        );
      },
    });
  }

  function handleBack() {
    if (!prev || busy) return;
    if (!window.confirm(`回退到上一阶段「${prev.name}」？`)) return;
    setCurrent.mutate(prev.id, { onSuccess: () => setNotice(null) });
  }

  return (
    <section className="stage-flow" aria-label="阶段流转">
      <ol className="stage-flow-stages">
        {stages.map((stage) => {
          const isCurrent = stage.id === task.currentStageId;
          const isDone = stage.status === 'done';
          return (
            <li
              key={stage.id}
              className={[isCurrent ? 'current' : '', isDone ? 'done' : ''].join(' ').trim()}
            >
              <span className="node" aria-hidden="true">
                {isDone ? '✓' : ''}
              </span>
              <span className="name">{stage.name}</span>
            </li>
          );
        })}
      </ol>

      <div className="stage-flow-actions">
        <button
          type="button"
          className="primary"
          disabled={action.disabled || busy}
          onClick={handleAdvance}
        >
          {action.label}
        </button>
        {prev && (
          <button type="button" onClick={handleBack} disabled={busy}>
            回退到上一阶段
          </button>
        )}
      </div>

      {notice && (
        <p className="flow-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}