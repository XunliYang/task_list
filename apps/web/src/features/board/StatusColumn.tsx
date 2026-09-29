import { useRef, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { StatusCategory, Task } from '@task-list/shared';
import { boardCopy } from './board-copy';
import { TASK_DRAG_TYPE } from './column-drop';
import { TaskRow } from './TaskRow';

interface StatusColumnProps {
  category: StatusCategory;
  tasks: Task[];
  /** 全部状态分类（传给 TaskRow 供「移动到…」菜单使用） */
  categories: StatusCategory[];
  /** drop 到本列时回调：把 taskId 移到本列分类 id */
  onTaskDrop: (taskId: string, toStatusId: string) => void;
  /** 固定时钟注入（测试用），缺省为当前时间 */
  now?: Date;
  /** 点击列头「＋」时回调（预填该列分类创建任务）；缺省不渲染按钮。 */
  onAddTask?: () => void;
}

/** 是否为内部任务行拖拽（而非外部文件/文本拖入）。 */
function hasTaskDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(TASK_DRAG_TYPE);
}

/**
 * 看板单列：对应一个状态分类，列头显示色块、分类名、任务数与「＋」；
 * 列体是一列任务行（`ui/Row`，行与行之间 1px `--hairline`，无独立卡片）。
 * 行按 updatedAt 倒序；列内为空时显示空态。
 *
 * 同时作为拖放目标（LEOY-103）：`onDragOver` preventDefault 才允许 drop，
 * `dragenter/dragleave` 计数维护高亮态，`aria-live` 提示当前放置目标。
 * 列体 capture 阶段抑制「拖拽结束后紧随的 click」，避免误跳详情页。
 */
export function StatusColumn({
  category,
  tasks,
  categories,
  onTaskDrop,
  now,
  onAddTask,
}: StatusColumnProps) {
  const sorted = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  // 拖拽结束后浏览器/测试可能补发一次 click，抑制它避免误跳详情。
  const suppressClickRef = useRef(false);

  const handleDragEnter = (e: DragEvent) => {
    if (!hasTaskDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (!hasTaskDrag(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    if (!hasTaskDrag(e)) return;
    // preventDefault 是「允许 drop」的前提。
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent) => {
    if (!hasTaskDrag(e)) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE) || e.dataTransfer.getData('text/plain');
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (taskId) {
      onTaskDrop(taskId, category.id);
    }
  };

  const handleRowDragEnd = () => {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleBodyClickCapture = (e: ReactMouseEvent<HTMLUListElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  return (
    <section
      className={isDragOver ? 'board-column board-column--drop-target' : 'board-column'}
      data-testid="status-column"
      data-drop-target={isDragOver || undefined}
      aria-label={category.name}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="board-column-head">
        <span
          className="board-column-swatch"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <h2 className="board-column-title">{category.name}</h2>
        <span className="board-column-count">{sorted.length}</span>
        {onAddTask && (
          <button
            type="button"
            className="board-column-add"
            onClick={onAddTask}
            aria-label={`在「${category.name}」下新建任务`}
            title="新建任务"
          >
            ＋
          </button>
        )}
      </header>
      <span className="board-visually-hidden" role="status" aria-live="polite">
        {isDragOver ? `可将任务放到「${category.name}」` : ''}
      </span>
      <div className="board-column-body">
        {sorted.length === 0 ? (
          <p className="board-empty">{boardCopy.emptyColumn}</p>
        ) : (
          <ul className="board-column-list" onClickCapture={handleBodyClickCapture}>
            {sorted.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                category={category}
                categories={categories}
                onTaskDrop={onTaskDrop}
                now={now}
                onDragEnd={handleRowDragEnd}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
