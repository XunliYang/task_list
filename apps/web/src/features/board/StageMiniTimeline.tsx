import type { CSSProperties } from 'react';
import type { Stage } from '@task-list/shared';
import { boardCopy } from './board-copy';
import { stageOverdueDays } from './useBoardFilters';

interface StageMiniTimelineProps {
  stages: Stage[];
  accentColor: string;
  /** 固定时钟注入（测试用），缺省为当前时间 */
  now?: Date;
}

/**
 * 卡内阶段迷你时间线：竖向列出各阶段的名称与截止日期，
 * 用状态图标（✓/脉冲点/灰点）区分阶段状态，并对逾期阶段标红。
 */
export function StageMiniTimeline({ stages, accentColor, now }: StageMiniTimelineProps) {
  if (stages.length === 0) {
    return null;
  }

  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const effectiveNow = now ?? new Date();
  const accentStyle = { '--board-accent': accentColor } as CSSProperties;

  return (
    <ol className="board-timeline" style={accentStyle} aria-label={boardCopy.stagesLabel}>
      {sorted.map((stage) => {
        const overdue = stageOverdueDays(stage, effectiveNow);
        return (
          <li
            key={stage.id}
            className={`board-timeline-item board-timeline-item--${stage.status}`}
            data-status={stage.status}
          >
            <span className="board-timeline-dot" aria-hidden="true">
              {stage.status === 'done' ? <span className="board-timeline-check">✓</span> : null}
            </span>
            <span className="board-timeline-name">{stage.name}</span>
            {stage.dueDate ? (
              <span
                className={
                  overdue !== null
                    ? 'board-timeline-due board-timeline-due--overdue'
                    : 'board-timeline-due'
                }
              >
                {stage.dueDate}
                {overdue !== null ? ` · 逾期 ${overdue} 天` : ''}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
