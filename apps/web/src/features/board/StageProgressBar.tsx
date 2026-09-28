import type { CSSProperties } from 'react';
import type { Stage } from '@task-list/shared';
import { boardCopy, stageStatusLabel } from './board-copy';

interface StageProgressBarProps {
  /** 任务所属阶段（按 order 排序展示） */
  stages: Stage[];
  /** 任务所属状态分类色 —— 已完成段填充色 / 当前段描边色 */
  accentColor: string;
}

/**
 * 图形化阶段进展条（核心组件）。
 *
 * - 每段一个阶段、宽度均分；
 * - 已完成段用状态分类色填充并带 ✓（颜色 + 形状双通道，色盲友好）；
 * - 当前段（in_progress）用描边 + 呼吸动画 + 中心脉冲点区分；
 * - 未开始段为灰底；
 * - 无阶段任务渲染空态文案，不渲染空条；
 * - 无障碍：role="progressbar" + aria-valuemin/max/now，每段 aria-label 含阶段名与状态。
 */
export function StageProgressBar({ stages, accentColor }: StageProgressBarProps) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const total = sorted.length;
  const done = sorted.filter((s) => s.status === 'done').length;

  if (total === 0) {
    return (
      <p className="board-progress-empty" data-testid="stage-progress-empty">
        {boardCopy.noStages}
      </p>
    );
  }

  const currentIndex = sorted.findIndex((s) => s.status === 'in_progress');
  // 超过 3 个阶段时只标首/当前/末，其余 hover 显示 tooltip（title）。
  const labelIndexes =
    total > 3
      ? new Set<number>([0, sorted.length - 1, ...(currentIndex >= 0 ? [currentIndex] : [])])
      : new Set<number>(sorted.map((_, i) => i));

  const accentStyle = { '--board-accent': accentColor } as CSSProperties;

  return (
    <div className="board-progress" style={accentStyle}>
      <div className="board-progress-main">
        <div
          className="board-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={`${boardCopy.progressLabel} ${done}/${total}`}
        >
          {sorted.map((stage) => (
            <span
              key={stage.id}
              role="img"
              className={`board-progress-segment board-progress-segment--${stage.status}`}
              style={stage.status === 'done' ? { backgroundColor: accentColor } : undefined}
              aria-label={`${stage.name}：${stageStatusLabel[stage.status]}`}
              title={`${stage.name}：${stageStatusLabel[stage.status]}`}
              data-testid="stage-segment"
              data-status={stage.status}
            >
              {stage.status === 'done' ? (
                <span className="board-segment-check" aria-hidden="true">
                  ✓
                </span>
              ) : stage.status === 'in_progress' ? (
                <span className="board-segment-pulse" aria-hidden="true" />
              ) : null}
            </span>
          ))}
        </div>
        <div className="board-progress-labels" aria-hidden="true">
          {sorted.map((stage, i) => (
            <span
              key={stage.id}
              className={
                labelIndexes.has(i)
                  ? 'board-progress-label'
                  : 'board-progress-label board-progress-label--hidden'
              }
            >
              {stage.name}
            </span>
          ))}
        </div>
      </div>
      <span className="board-progress-count" aria-hidden="true">
        {done}/{total}
      </span>
    </div>
  );
}
