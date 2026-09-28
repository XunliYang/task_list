/** 日历视图的文案常量，统一出口便于测试与后续 i18n。 */

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

export const CALENDAR_COPY = {
  /** '2026年9月' */
  monthTitle: (year: number, month: number) => `${year}年${month + 1}月`,
  prev: '上个月',
  next: '下个月',
  prevWeek: '上一周',
  nextWeek: '下一周',
  today: '今天',
  monthView: '月',
  weekView: '周',
  viewToggle: '视图切换',
  loading: '加载中…',
  error: '加载失败，请稍后重试。',
  emptyDay: '当日无到期项',
  closePanel: '关闭',
  overdueBadge: (n: number) => `${n} 项逾期`,
  more: (n: number) => `+${n}`,
  taskUpdatedLegend: '任务已更新',
  stageLabel: '阶段',
  dueLabel: '截止',
  currentStageLabel: '当前阶段',
  overdueLabel: '已逾期',
  updatedLabel: '更新于',
  dayPanelTitle: (dateKey: string) => `${dateKey} 的条目`,
} as const;
