import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Stage, Task } from '@task-list/shared';

export type StageStatusFilter = 'all' | 'pending' | 'done';
export type DueRangeFilter = 'all' | 'this-week' | 'overdue';

/**
 * 看板筛选状态。
 * `selectedStatusIds` 为 `null` 表示「全选」（URL 未写任何 status 参数）；
 * `[]` 表示「全不选」（URL 写 `status=`）；其余为具体勾选的分类 id。
 */
export interface BoardFilterState {
  q: string;
  selectedStatusIds: string[] | null;
  stageStatus: StageStatusFilter;
  dueRange: DueRangeFilter;
}

export const DEFAULT_BOARD_FILTERS: BoardFilterState = {
  q: '',
  selectedStatusIds: null,
  stageStatus: 'all',
  dueRange: 'all',
};

// ---------------------------------------------------------------------------
// 日期 / 逾期工具（纯函数，固定 now 可注入，测试不依赖真实时钟）
// ---------------------------------------------------------------------------

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

/** 阶段逾期天数：dueDate 早于 now 且未完成时返回正天数，否则 null。 */
export function stageOverdueDays(stage: Stage, now: Date = new Date()): number | null {
  if (stage.status === 'done') return null;
  const due = parseIsoDate(stage.dueDate);
  if (!due) return null;
  const today = startOfDay(now);
  if (due.getTime() >= today.getTime()) return null;
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

/** 任务逾期天数：取各未完成阶段中的最大逾期天数；无逾期返回 null。 */
export function taskOverdueDays(task: Task, now: Date = new Date()): number | null {
  let max: number | null = null;
  for (const stage of task.stages) {
    const days = stageOverdueDays(stage, now);
    if (days !== null && (max === null || days > max)) max = days;
  }
  return max;
}

/** 任务是否「本周内到期」：存在未完成阶段且 dueDate 落在 [今天, 本周日]。 */
export function taskDueThisWeek(task: Task, now: Date = new Date()): boolean {
  const today = startOfDay(now);
  const daysToSunday = (7 - today.getDay()) % 7;
  const endOfWeek = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysToSunday,
  );
  return task.stages.some((stage) => {
    if (stage.status === 'done') return false;
    const due = parseIsoDate(stage.dueDate);
    if (!due) return false;
    return due.getTime() >= today.getTime() && due.getTime() <= endOfWeek.getTime();
  });
}

/**
 * 客户端筛选。
 * statusId / q / stageStatus 三个维度已由服务端 `GET /api/tasks` 完成（以服务端为准）；
 * 这里只兜底「取消全选 → 空集」并应用服务端不支持的「截止时间」维度。
 */
export function filterTasks(
  tasks: Task[],
  filters: BoardFilterState,
  now: Date = new Date(),
): Task[] {
  if (filters.selectedStatusIds !== null && filters.selectedStatusIds.length === 0) {
    return [];
  }
  if (filters.dueRange === 'overdue') {
    return tasks.filter((task) => taskOverdueDays(task, now) !== null);
  }
  if (filters.dueRange === 'this-week') {
    return tasks.filter((task) => taskDueThisWeek(task, now));
  }
  return tasks;
}

// ---------------------------------------------------------------------------
// URL query 读写 —— useBoardFilters 是筛选状态的唯一读写点
// ---------------------------------------------------------------------------

const P_Q = 'q';
const P_STAGE = 'stage';
const P_DUE = 'due';
const P_STATUS = 'status';

function readFilters(searchParams: URLSearchParams): BoardFilterState {
  const stageRaw = searchParams.get(P_STAGE);
  const dueRaw = searchParams.get(P_DUE);
  const statusValues = searchParams.getAll(P_STATUS);

  let selectedStatusIds: string[] | null;
  if (statusValues.length === 0) {
    selectedStatusIds = null; // 全选（未写参数）
  } else if (statusValues.length === 1 && statusValues[0] === '') {
    selectedStatusIds = []; // 全不选（?status=）
  } else {
    selectedStatusIds = statusValues.filter((v) => v !== '');
  }

  return {
    q: searchParams.get(P_Q) ?? '',
    selectedStatusIds,
    stageStatus: stageRaw === 'pending' || stageRaw === 'done' ? stageRaw : 'all',
    dueRange: dueRaw === 'this-week' || dueRaw === 'overdue' ? dueRaw : 'all',
  };
}

export interface UseBoardFiltersResult {
  filters: BoardFilterState;
  setKeyword: (q: string) => void;
  setSelectedStatusIds: (next: string[] | null) => void;
  setStageStatus: (next: StageStatusFilter) => void;
  setDueRange: (next: DueRangeFilter) => void;
  resetFilters: () => void;
}

export function useBoardFilters(): UseBoardFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const setKeyword = useCallback(
    (q: string) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (q.trim()) p.set(P_Q, q);
        else p.delete(P_Q);
        return p;
      });
    },
    [setSearchParams],
  );

  const setSelectedStatusIds = useCallback(
    (next: string[] | null) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete(P_STATUS);
        if (next === null) {
          // 全选：不写任何 status 参数
        } else if (next.length === 0) {
          p.set(P_STATUS, '');
        } else {
          for (const id of next) p.append(P_STATUS, id);
        }
        return p;
      });
    },
    [setSearchParams],
  );

  const setStageStatus = useCallback(
    (next: StageStatusFilter) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'all') p.delete(P_STAGE);
        else p.set(P_STAGE, next);
        return p;
      });
    },
    [setSearchParams],
  );

  const setDueRange = useCallback(
    (next: DueRangeFilter) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'all') p.delete(P_DUE);
        else p.set(P_DUE, next);
        return p;
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      [P_Q, P_STAGE, P_DUE, P_STATUS].forEach((key) => p.delete(key));
      return p;
    });
  }, [setSearchParams]);

  return {
    filters,
    setKeyword,
    setSelectedStatusIds,
    setStageStatus,
    setDueRange,
    resetFilters,
  };
}
