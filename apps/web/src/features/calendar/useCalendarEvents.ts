import { useMemo } from 'react';
import type { StatusCategory, Task } from '@task-list/shared';
import { useStatuses } from '../../api/statuses';
import { useTasks } from '../../api/tasks';
import { addDays, toDateKey } from './calendar-date';

/**
 * 把 Task[] 投影成日历事件。
 *
 * 两种事件：
 * - stage-due：每个阶段 dueDate 非空时产生一条，展示「任务标题·阶段名」。
 * - task-updated：可选（默认关闭），来自 task.updatedAt 的日期部分，渲染为淡淡点标记。
 *
 * 纯函数 `buildCalendarEvents` 不依赖 React，可单测；`useCalendarEvents` 是其
 * 在数据 hooks 之上的薄封装。
 */

export type CalendarEventKind = 'stage-due' | 'task-updated';

export interface CalendarEvent {
  /** 稳定唯一键（同一天内同一阶段不会重复） */
  key: string;
  kind: CalendarEventKind;
  /** 'YYYY-MM-DD' 事件所在日 */
  date: string;
  taskId: string;
  taskTitle: string;
  statusId: string;
  /** 任务状态分类色 */
  color: string;
  /** 任务状态分类名（供详情面板 ui/Row 的 StatusDot 无障碍标签） */
  statusName: string;
  stageId: string | null;
  stageName: string | null;
  stageDueDate: string | null;
  /** 阶段已完成（渲染划线灰态但可见） */
  done: boolean;
  /** 逾期：今天之前仍未完成的 stage-due */
  overdue: boolean;
  /** 该任务当前阶段信息（供详情面板展示） */
  currentStageName: string | null;
  currentStageDueDate: string | null;
}

export interface ProjectCalendarOptions {
  /** 是否生成 task-updated 事件（默认关闭） */
  includeTaskUpdated?: boolean;
  /** 注入的「今天」（逾期判定用，测试可固定；缺省真实当前时间） */
  now?: Date;
}

/** 状态分类缺失时的兜底色 / 兜底名。 */
const FALLBACK_COLOR = '#888888';
const FALLBACK_NAME = '';

function colorMapOf(statuses: StatusCategory[]): Map<string, string> {
  return new Map(statuses.map((s) => [s.id, s.color]));
}

function statusByNameMap(statuses: StatusCategory[]): Map<string, string> {
  return new Map(statuses.map((s) => [s.id, s.name]));
}

export function buildCalendarEvents(
  tasks: Task[],
  statuses: StatusCategory[],
  options: ProjectCalendarOptions = {},
): CalendarEvent[] {
  const { includeTaskUpdated = false, now = new Date() } = options;
  const todayKey = toDateKey(now);
  const colorByStatus = colorMapOf(statuses);
  const nameByStatus = statusByNameMap(statuses);

  const events: CalendarEvent[] = [];

  for (const task of tasks) {
    const color = colorByStatus.get(task.statusId) ?? FALLBACK_COLOR;
    const statusName = nameByStatus.get(task.statusId) ?? FALLBACK_NAME;
    const currentStage = task.stages.find((s) => s.id === task.currentStageId) ?? null;

    for (const stage of task.stages) {
      if (!stage.dueDate) continue; // 空 dueDate 不产生事件
      const done = stage.status === 'done';
      events.push({
        key: `stage-due:${task.id}:${stage.id}`,
        kind: 'stage-due',
        date: stage.dueDate,
        taskId: task.id,
        taskTitle: task.title,
        statusId: task.statusId,
        color,
        statusName,
        stageId: stage.id,
        stageName: stage.name,
        stageDueDate: stage.dueDate,
        done,
        overdue: !done && stage.dueDate < todayKey,
        currentStageName: currentStage?.name ?? null,
        currentStageDueDate: currentStage?.dueDate ?? null,
      });
    }

    if (includeTaskUpdated && task.updatedAt) {
      const date = task.updatedAt.slice(0, 10); // ISO datetime → 'YYYY-MM-DD'
      events.push({
        key: `task-updated:${task.id}:${date}`,
        kind: 'task-updated',
        date,
        taskId: task.id,
        taskTitle: task.title,
        statusId: task.statusId,
        color,
        statusName,
        stageId: null,
        stageName: null,
        stageDueDate: null,
        done: false,
        overdue: false,
        currentStageName: currentStage?.name ?? null,
        currentStageDueDate: currentStage?.dueDate ?? null,
      });
    }
  }

  return events;
}

/** 同日排序：未完成优先，再按任务标题。 */
export function compareCalendarEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return a.taskTitle.localeCompare(b.taskTitle, 'zh-Hans-CN');
}

export function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(compareCalendarEvents);
}

/** 按日期分组，且每组内按「未完成优先、再按标题」排序。 */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  for (const list of map.values()) list.sort(compareCalendarEvents);
  return map;
}

// ---------------------------------------------------------------------------
// 侧栏「日程」数据选择（复用同一投影，不新增事件源）
// ---------------------------------------------------------------------------

export interface ScheduleOptions {
  /** 注入的「今天」（默认真实当前时间） */
  now?: Date;
  /** 覆盖的后续天数（含今天，默认 7） */
  days?: number;
}

/**
 * 由 stage-due 投影产出「日程」列表：今日起 N 天的阶段截止事件，逾期置顶。
 *
 * - 只取未完成的 stage-due（已完成的阶段不再是「待办截止」）。
 * - 逾期（日期早于今天且未完成）一律置顶、最早逾期在前。
 * - 其后为今天 → 今天+N-1 天内的未完成截止，按日期升序；同日按标题。
 * - 仅做排序/切片，不改事件字段（overdue 标记仍驱动展示层的标红）。
 */
export function buildScheduleEvents(
  events: CalendarEvent[],
  options: ScheduleOptions = {},
): CalendarEvent[] {
  const { now = new Date(), days = 7 } = options;
  const todayKey = toDateKey(now);
  const endKey = toDateKey(addDays(now, days - 1));

  const byDate = (a: CalendarEvent, b: CalendarEvent): number =>
    a.date.localeCompare(b.date) || compareCalendarEvents(a, b);

  const pendingDeadlines = events.filter((e) => e.kind === 'stage-due' && !e.done);
  const overdue = pendingDeadlines.filter((e) => e.overdue);
  const upcoming = pendingDeadlines.filter(
    (e) => !e.overdue && e.date >= todayKey && e.date <= endKey,
  );

  return [...overdue.sort(byDate), ...upcoming.sort(byDate)];
}

export function useCalendarEvents(options: ProjectCalendarOptions = {}) {
  const { includeTaskUpdated = false, now } = options;
  const tasksQuery = useTasks();
  const statusesQuery = useStatuses();

  // 未注入 now 时只在挂载时取一次当前时间，避免每次渲染都变化触发重算。
  const nowValue = useMemo(() => now ?? new Date(), [now]);

  const events = useMemo(() => {
    if (!tasksQuery.data || !statusesQuery.data) return [];
    return buildCalendarEvents(tasksQuery.data, statusesQuery.data, {
      includeTaskUpdated,
      now: nowValue,
    });
  }, [tasksQuery.data, statusesQuery.data, includeTaskUpdated, nowValue]);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  return {
    events,
    eventsByDate,
    isLoading: tasksQuery.isLoading || statusesQuery.isLoading,
    isError: tasksQuery.isError || statusesQuery.isError,
  };
}