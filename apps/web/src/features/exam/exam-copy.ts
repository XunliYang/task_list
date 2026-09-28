/**
 * 考试/面试信息 feature 的文案常量与展示元信息。
 * 仅放「文字 / 颜色 / 固定表头」这类静态内容，不含业务逻辑。
 */

/** 考试/面试类型。 */
export const EXAM_TYPES = ['exam', 'interview'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/** 类型 → 展示标签 + 色块颜色。 */
export const EXAM_TYPE_META: Record<ExamType, { label: string; color: string }> = {
  exam: { label: '考试', color: '#1976d2' },
  interview: { label: '面试', color: '#7b1fa2' },
};

/** 手动添加时的默认状态文案。 */
export const DEFAULT_EXAM_STATUS = '待报名';

/** CSV 导入固定表头（顺序即列顺序）。 */
export const CSV_HEADER = [
  'title',
  'type',
  'company',
  'deadline',
  'url',
  'location',
  'status',
  'notes',
] as const;

/** 列表排序选项。 */
export const SORT_OPTIONS = [
  { key: 'deadline', label: '按截止时间（近→远）' },
  { key: 'createdAt', label: '按创建时间（新→旧）' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['key'];