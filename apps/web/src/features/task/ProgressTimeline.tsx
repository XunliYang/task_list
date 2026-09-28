import type { ProgressEntry, Stage } from '@task-list/shared';
import { formatDateTime } from './task-utils';

export interface ProgressTimelineProps {
  entries: ProgressEntry[];
  stages: Stage[];
}

/** 进展时间线：按时间倒序展示，每条含时间、摘要与所属阶段。 */
export function ProgressTimeline({ entries, stages }: ProgressTimelineProps) {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));

  if (sorted.length === 0) {
    return <p className="empty-hint">暂无进展记录</p>;
  }

  const stageName = (id: string | null) =>
    id ? (stages.find((s) => s.id === id)?.name ?? null) : null;

  return (
    <ol className="progress-timeline">
      {sorted.map((entry) => {
        const name = stageName(entry.stageId);
        return (
          <li key={entry.id}>
            <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
            <p>{entry.summary}</p>
            {name && <span className="stage-badge">{name}</span>}
          </li>
        );
      })}
    </ol>
  );
}