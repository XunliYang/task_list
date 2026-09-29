import type { DragEvent } from 'react';
import type { StatusCategory, Task } from '@task-list/shared';
import { Row } from '../../ui';
import type { RowStage } from '../../ui';
import { TASK_DRAG_TYPE } from './column-drop';

interface TaskRowProps {
  task: Task;
  category: StatusCategory;
  /** 全部状态分类（「移动到…」菜单用，已按 order 排序） */
  categories: StatusCategory[];
  /** 状态变更统一回调（拖放或菜单选择）：把 taskId 移到 toStatusId */
  onTaskDrop: (taskId: string, toStatusId: string) => void;
  /** 固定时钟注入（测试用），缺省为当前时间 */
  now?: Date;
  /** 拖拽结束时回调（由列容器维护「拖后抑制误点击」） */
  onDragEnd?: () => void;
}

/**
 * 任务行（LEOY-119）：每个任务用「行」展示，不再渲染卡片外壳。
 *
 * 行结构由共享基元 `ui/Row` 提供（状态点 + 标题/公司 + 标签 Badge + 图形化
 * 阶段进度 n/m + 截止（逾期标红）+ 行尾 ⋯「移动到…」菜单），本组件只做任务
 * 数据到 Row 契约的映射，并注入看板拖拽改状态（LEOY-103）的拖拽源能力。
 *
 * - 拖拽：`draggable` + `onDragStart` 写 dataTransfer（text/plain 放 id，
 *   另设私有 MIME `application/x-task-id` 区分内部拖拽）；
 * - 防误触：拖拽结束后的紧随 click 由列容器的 capture 处理器抑制（不误跳详情）；
 * - 键盘兜底：行尾 ⋯ 菜单即 `ui/Row` 内建的键盘可达「移动到…」替代路径。
 */
export function TaskRow({
  task,
  category,
  categories,
  onTaskDrop,
  now,
  onDragEnd,
}: TaskRowProps) {
  const targets = categories.filter((c) => c.id !== category.id);

  const stages: RowStage[] = [...task.stages]
    .sort((a, b) => a.order - b.order)
    .map((stage) => ({
      id: stage.id,
      name: stage.name,
      status: stage.status,
      dueDate: stage.dueDate,
    }));

  const handleDragStart = (e: DragEvent<HTMLLIElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Row
      statusColor={category.color}
      statusName={category.name}
      statusActive={task.stages.some((stage) => stage.status === 'in_progress')}
      title={task.title}
      company={task.company}
      tags={task.tags}
      stages={stages}
      href={`/tasks/${task.id}`}
      moveTargets={targets.map((c) => ({ id: c.id, name: c.name }))}
      onMoveTo={(toStatusId) => onTaskDrop(task.id, toStatusId)}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      now={now}
    />
  );
}