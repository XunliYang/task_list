/**
 * 考试/面试列表的筛选与排序（纯逻辑，便于单测）。
 * 与 React 解耦：ExamListPage 持有筛选状态并调用这里。
 */
import type { ExamInfo } from '@task-list/shared';
import type { SortKey } from './exam-copy';

export interface ExamFilters {
  type: 'all' | 'exam' | 'interview';
  /** 关键词（匹配标题/公司，忽略大小写）。 */
  q: string;
  /** 状态（'' = 全部）。 */
  status: string;
  deadline: 'all' | 'this-week' | 'overdue';
  converted: 'all' | 'converted' | 'not-converted';
}

export const DEFAULT_EXAM_FILTERS: ExamFilters = {
  type: 'all',
  q: '',
  status: '',
  deadline: 'all',
  converted: 'all',
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今天（本地时区）的 ISO 日期字符串。 */
export function todayIso(): string {
  return toIso(new Date());
}

/** deadline 严格早于今天视为「已逾期」；空 deadline 不算。 */
export function isOverdue(deadline: string | null, today = todayIso()): boolean {
  if (!deadline) {
    return false;
  }
  return deadline < today;
}

/** 返回本周周一 00:00（本地时区）。 */
function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (date.getDay() + 6) % 7; // 距周一天数（周日 getDay()=0 → 6）。
  date.setDate(date.getDate() - diff);
  return date;
}

/** deadline 落在本周（周一至周日，含端点）；空 deadline 不算。 */
export function isThisWeek(deadline: string | null): boolean {
  if (!deadline) {
    return false;
  }
  const monday = startOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return deadline >= toIso(monday) && deadline <= toIso(sunday);
}

function matchesKeyword(exam: ExamInfo, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [exam.title, exam.company ?? ''].join('\n').toLowerCase().includes(needle);
}

/** 按组合条件筛选（各维度独立、可叠加）。 */
export function applyExamFilters(exams: ExamInfo[], filters: ExamFilters): ExamInfo[] {
  return exams.filter((exam) => {
    if (filters.type !== 'all' && exam.type !== filters.type) {
      return false;
    }
    if (!matchesKeyword(exam, filters.q)) {
      return false;
    }
    if (filters.status !== '' && exam.status !== filters.status) {
      return false;
    }
    if (filters.deadline === 'overdue' && !isOverdue(exam.deadline)) {
      return false;
    }
    if (filters.deadline === 'this-week' && !isThisWeek(exam.deadline)) {
      return false;
    }
    if (filters.converted === 'converted' && exam.taskId === null) {
      return false;
    }
    if (filters.converted === 'not-converted' && exam.taskId !== null) {
      return false;
    }
    return true;
  });
}

/** 排序返回新数组，不修改入参。deadline 升序（空 deadline 排最后）；createdAt 降序。 */
export function sortExams(exams: ExamInfo[], key: SortKey): ExamInfo[] {
  const copy = [...exams];
  if (key === 'createdAt') {
    return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return copy.sort((a, b) => {
    const da = a.deadline;
    const db = b.deadline;
    if (da && db) {
      return da.localeCompare(db);
    }
    if (da && !db) {
      return -1;
    }
    if (!da && db) {
      return 1;
    }
    // 均为空：按创建时间倒序稳定排序。
    return b.createdAt.localeCompare(a.createdAt);
  });
}