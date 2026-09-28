import { Link } from 'react-router-dom';
import type { StatusCategory, Task } from '@task-list/shared';
import { boardCopy, formatOverdue } from './board-copy';
import { StageMiniTimeline } from './StageMiniTimeline';
import { StageProgressBar } from './StageProgressBar';
import { taskOverdueDays } from './useBoardFilters';

interface TaskCardProps {
  task: Task;
  category: StatusCategory;
  /** 固定时钟注入（测试用），缺省为当前时间 */
  now?: Date;
}

/**
 * 任务卡：整卡可点击，进入 `/tasks/:id` 详情页（详情 + 编辑 + 阶段流转由 LEOY-86 提供）。
 * 卡片不提供编辑控件，避免与详情页编辑入口语义重复。
 */
export function TaskCard({ task, category, now }: TaskCardProps) {
  const effectiveNow = now ?? new Date();
  const overdue = taskOverdueDays(task, effectiveNow);

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="board-card"
      data-testid="task-card"
      aria-label={`${boardCopy.viewTaskLabel}：${task.title}`}
    >
      <div className="board-card-head">
        <h3 className="board-card-title">{task.title}</h3>
        {overdue !== null ? (
          <span className="board-overdue" data-testid="overdue-badge">
            {formatOverdue(overdue)}
          </span>
        ) : null}
      </div>

      {task.company ? <p className="board-card-company">{task.company}</p> : null}

      {task.tags.length > 0 ? (
        <ul className="board-card-tags" aria-label={boardCopy.tagsLabel}>
          {task.tags.map((tag) => (
            <li key={tag} className="board-tag">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <StageProgressBar stages={task.stages} accentColor={category.color} />
      <StageMiniTimeline stages={task.stages} accentColor={category.color} now={effectiveNow} />
    </Link>
  );
}
