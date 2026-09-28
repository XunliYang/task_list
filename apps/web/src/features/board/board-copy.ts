import type { StageStatus } from '@task-list/shared';

/**
 * 看板页文案常量 —— 统一出口，组件与测试都从这里取文案，避免硬编码中文散落各处。
 */
export const boardCopy = {
  pageTitle: '任务看板',
  loading: '加载中…',
  loadError: '加载失败，请稍后重试。',
  retry: '重试',
  noStatuses: '暂无状态分类，请先到「状态管理」创建。',
  noTasks: '没有符合筛选条件的任务。',
  emptyColumn: '暂无任务',
  clearFilters: '清除筛选',
  keywordLabel: '关键词',
  keywordPlaceholder: '搜索标题 / 公司 / 标签',
  statusFilterLabel: '状态分类',
  statusAll: '全选',
  statusNone: '取消全选',
  stageFilterLabel: '阶段状态',
  stageAll: '全部',
  stagePending: '有未完成阶段',
  stageDone: '全部阶段已完成',
  dueFilterLabel: '截止时间',
  dueAll: '不限',
  dueThisWeek: '本周内到期',
  dueOverdue: '已逾期',
  noStages: '该任务暂无阶段',
  progressLabel: '阶段进度',
  stagesLabel: '阶段',
  tagsLabel: '标签',
  viewTaskLabel: '查看任务详情',
} as const;

/** 阶段状态 → 中文标签。 */
export const stageStatusLabel: Record<StageStatus, string> = {
  pending: '未开始',
  in_progress: '进行中',
  done: '已完成',
};

/** 逾期徽标文案。 */
export function formatOverdue(days: number): string {
  return `逾期 ${days} 天`;
}

/** 「已完成数/总数」计数文案。 */
export function formatProgress(done: number, total: number): string {
  return `${done}/${total}`;
}
