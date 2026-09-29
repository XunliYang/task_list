import { useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { StatusCategory, Task } from '@task-list/shared';
import { boardCopy, formatOverdue } from './board-copy';
import { TASK_DRAG_TYPE } from './column-drop';
import { StageMiniTimeline } from './StageMiniTimeline';
import { StageProgressBar } from './StageProgressBar';
import { taskOverdueDays } from './useBoardFilters';

interface TaskCardProps {
  task: Task;
  category: StatusCategory;
  /** 全部状态分类（「移动到…」键盘菜单用，已按 order 排序） */
  categories: StatusCategory[];
  /** 状态变更统一回调（拖放或菜单选择）：把 taskId 移到 toStatusId */
  onTaskDrop: (taskId: string, toStatusId: string) => void;
  /** 固定时钟注入（测试用），缺省为当前时间 */
  now?: Date;
}

/**
 * 任务卡：整卡可点击进入 `/tasks/:id` 详情页，同时可作为原生 HTML5 拖拽源
 * 拖到目标列切换状态分类（LEOY-103）。
 *
 * - 拖拽：`draggable` + `onDragStart` 写入 dataTransfer（text/plain 放 id，
 *   另设私有 MIME `application/x-task-id` 区分内部拖拽），拖拽中加 `.board-card--dragging`；
 * - 防误触：`onDragEnd` 后抑制紧随的一次 click，避免拖完误跳详情；
 * - 键盘兜底：右上角「移动到…」菜单按钮，列出其它状态分类完成同样的状态变更。
 */
export function TaskCard({ task, category, categories, onTaskDrop, now }: TaskCardProps) {
  const effectiveNow = now ?? new Date();
  const overdue = taskOverdueDays(task, effectiveNow);

  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const suppressClickRef = useRef(false);

  const targets = categories.filter((c) => c.id !== category.id);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
    // 拖拽结束后浏览器/测试可能补发一次 click，抑制它避免误跳详情。
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      suppressClickRef.current = false;
    }
  };

  const handleMoveTo = (toStatusId: string) => {
    setMenuOpen(false);
    onTaskDrop(task.id, toStatusId);
  };

  const handleMoveMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setMenuOpen(false);
    }
  };

  return (
    <div
      className={`board-card${dragging ? ' board-card--dragging' : ''}${
        menuOpen ? ' board-card--menu-open' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-testid="task-card"
      data-dragging={dragging || undefined}
      data-menu-open={menuOpen || undefined}
    >
      <Link
        to={`/tasks/${task.id}`}
        className="board-card-link"
        draggable={false}
        onClick={handleClick}
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

      {targets.length > 0 ? (
        <div className="board-card-actions" onKeyDown={handleMoveMenuKeyDown}>
          <button
            type="button"
            className="board-card-move"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={boardCopy.moveToLabel}
            title={boardCopy.moveToLabel}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <ul className="board-card-menu" role="menu" aria-label={boardCopy.moveToMenuLabel}>
              {targets.map((c) => (
                <li key={c.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="board-card-menu-item"
                    onClick={() => handleMoveTo(c.id)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}