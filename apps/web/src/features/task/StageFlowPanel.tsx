import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Task } from '@task-list/shared';
import { useAdvanceStage, useSetCurrentStage } from '../../api/tasks';
import { Button, SuccessMorphButton } from '../../ui';
import { getFlowAction, previousStage, sortedStages } from './task-utils';

export interface StageFlowPanelProps {
  task: Task;
  /** 任务状态分类色（已完成节点着色），缺省回退珊瑚 --primary。 */
  statusColor?: string;
}

interface FlowNotice {
  kind: 'success' | 'error';
  text: string;
}

/** 阶段流转主控件：横向阶段展示 + 完成推进（success morph）+ 回退到上一阶段。 */
export function StageFlowPanel({ task, statusColor }: StageFlowPanelProps) {
  const advance = useAdvanceStage(task.id);
  const setCurrent = useSetCurrentStage(task.id);
  const [notice, setNotice] = useState<FlowNotice | null>(null);

  const action = getFlowAction(task);
  const stages = sortedStages(task.stages);
  const prev = previousStage(task);
  const busy = advance.isPending || setCurrent.isPending;

  const accentStyle = {
    '--stage-accent': statusColor ?? 'var(--primary)',
  } as CSSProperties;

  // 返回真实请求 Promise：成功/失败都如实反映（失败 rethrow 让 SuccessMorphButton 进入 error 态）。
  async function handleAdvance(): Promise<void> {
    if (action.disabled || busy) return;
    setNotice(null);
    try {
      const result = await advance.mutateAsync();
      setNotice({
        kind: 'success',
        text: result.nextStage ? `已进入「${result.nextStage.name}」` : '已完成最后一个阶段',
      });
    } catch (err) {
      setNotice({
        kind: 'error',
        text: `推进失败：${err instanceof Error ? err.message : '请稍后重试'}`,
      });
      throw err;
    }
  }

  function handleBack() {
    if (!prev || busy) return;
    if (!window.confirm(`回退到上一阶段「${prev.name}」？`)) return;
    setCurrent.mutate(prev.id, { onSuccess: () => setNotice(null) });
  }

  return (
    <section className="stage-flow" aria-label="阶段流转" style={accentStyle}>
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
        <SuccessMorphButton
          variant="primary"
          successLabel="已推进"
          onAction={handleAdvance}
          disabled={action.disabled || busy}
        >
          {action.label}
        </SuccessMorphButton>
        {prev && (
          <Button variant="secondary" onClick={handleBack} disabled={busy}>
            回退到上一阶段
          </Button>
        )}
      </div>

      {notice && (
        <p
          className={notice.kind === 'error' ? 'flow-notice flow-notice--error' : 'flow-notice'}
          role="status"
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}