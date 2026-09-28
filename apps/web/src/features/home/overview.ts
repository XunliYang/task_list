import type { Stage, StatusCategory, Task } from '@task-list/shared';

/**
 * 首页概览聚合层 —— 纯函数，不依赖 React、不依赖真实时钟（`now` 注入）。
 *
 * 口径与看板 / 后端保持一致：
 * - 阶段「未完成」= `status !== 'done'`；
 * - 「进行中任务」= 存在未完成阶段（后端 `stageStatus=pending`）；
 * - 「已完成任务」= 有阶段且全部完成（后端 `stageStatus=done`；无阶段任务两者皆不算）；
 * - 截止压力按**阶段**粒度统计：未完成阶段中 `dueDate` 早于今天计为逾期，
 *   落在 [今天, 当周周日] 计为本周到期。
 */

export interface StatusGroup {
  statusId: string;
  name: string;
  color: string;
  /** 该分类下的任务数。 */
  count: number;
}

export interface Overview {
  /** 任务总数。 */
  total: number;
  /** 按状态分类分组的任务数（按分类 order 升序）。 */
  byStatus: StatusGroup[];
  stageStats: {
    /** 存在未完成阶段的任务数。 */
    inProgress: number;
    /** 已有阶段且全部完成的任务数。 */
    completed: number;
  };
  /** 本周内到期的阶段数（未完成 & dueDate ∈ [今天, 周日]）。 */
  dueThisWeek: number;
  /** 已逾期阶段数（未完成 & dueDate < 今天）。 */
  overdue: number;
  /** 近期进展提示：近 7 天内有更新（updatedAt）的任务数。 */
  recentProgressHint: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 解析 'YYYY-MM-DD' 为本地时区当日 0 点；非法或空值返回 null。 */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isStageOverdue(stage: Stage, now: Date): boolean {
  if (stage.status === 'done') return false;
  const due = parseIsoDate(stage.dueDate);
  if (!due) return false;
  return due.getTime() < startOfDay(now).getTime();
}

function isStageDueThisWeek(stage: Stage, now: Date): boolean {
  if (stage.status === 'done') return false;
  const due = parseIsoDate(stage.dueDate);
  if (!due) return false;
  const today = startOfDay(now);
  const daysToSunday = (7 - today.getDay()) % 7;
  const endOfWeek = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysToSunday,
  );
  return due.getTime() >= today.getTime() && due.getTime() <= endOfWeek.getTime();
}

/** 「近期进展」观察窗口：7 天。 */
const RECENT_WINDOW_MS = 7 * 86_400_000;

export function buildOverview(
  tasks: Task[],
  statuses: StatusCategory[],
  now: Date,
): Overview {
  const byStatus: StatusGroup[] = [...statuses]
    .sort((a, b) => a.order - b.order)
    .map((status) => ({
      statusId: status.id,
      name: status.name,
      color: status.color,
      count: tasks.filter((t) => t.statusId === status.id).length,
    }));

  const inProgress = tasks.filter((t) => t.stages.some((s) => s.status !== 'done')).length;
  const completed = tasks.filter(
    (t) => t.stages.length > 0 && t.stages.every((s) => s.status === 'done'),
  ).length;

  let dueThisWeek = 0;
  let overdue = 0;
  for (const task of tasks) {
    for (const stage of task.stages) {
      if (isStageOverdue(stage, now)) overdue += 1;
      if (isStageDueThisWeek(stage, now)) dueThisWeek += 1;
    }
  }

  const recentCount = tasks.filter((t) => {
    const updatedAt = Date.parse(t.updatedAt);
    if (Number.isNaN(updatedAt)) return false;
    return updatedAt <= now.getTime() && now.getTime() - updatedAt <= RECENT_WINDOW_MS;
  }).length;

  let recentProgressHint: string;
  if (tasks.length === 0) {
    recentProgressHint = '还没有任务，从新建一个开始。';
  } else if (recentCount === 0) {
    recentProgressHint = '近 7 天没有任务更新，去推进一下进展吧。';
  } else {
    recentProgressHint = `近 7 天有 ${recentCount} 个任务更新。`;
  }

  return {
    total: tasks.length,
    byStatus,
    stageStats: { inProgress, completed },
    dueThisWeek,
    overdue,
    recentProgressHint,
  };
}
