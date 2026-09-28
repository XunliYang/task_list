import type { StatusCategory, Task } from '@task-list/shared';
import { boardCopy } from './board-copy';
import { TaskCard } from './TaskCard';

interface StatusColumnProps {
  category: StatusCategory;
  tasks: Task[];
  /** 固定时钟注入（测试用），缺省为当前时间 */
  now?: Date;
}

/**
 * 看板单列：对应一个状态分类，列头显示色块、分类名与任务数；
 * 卡片按 updatedAt 倒序；列内为空时显示空态。
 */
export function StatusColumn({ category, tasks, now }: StatusColumnProps) {
  const sorted = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section
      className="board-column"
      data-testid="status-column"
      aria-label={category.name}
    >
      <header className="board-column-head">
        <span
          className="board-column-swatch"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <h2 className="board-column-title">{category.name}</h2>
        <span className="board-column-count">{sorted.length}</span>
      </header>
      <div className="board-column-body">
        {sorted.length === 0 ? (
          <p className="board-empty">{boardCopy.emptyColumn}</p>
        ) : (
          sorted.map((task) => (
            <TaskCard key={task.id} task={task} category={category} now={now} />
          ))
        )}
      </div>
    </section>
  );
}
