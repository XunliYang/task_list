import type { ExamFilters } from './exam-filter';

export interface ExamFilterBarProps {
  value: ExamFilters;
  /** 由列表数据动态推导出的状态选项（去重后的非空 status）。 */
  statusOptions: string[];
  onChange: (next: ExamFilters) => void;
}

export function ExamFilterBar({ value, statusOptions, onChange }: ExamFilterBarProps) {
  const set = <K extends keyof ExamFilters>(key: K, next: ExamFilters[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' }}>
      <label>
        类型
        <select
          aria-label="类型"
          value={value.type}
          onChange={(e) => set('type', e.target.value as ExamFilters['type'])}
        >
          <option value="all">全部</option>
          <option value="exam">考试</option>
          <option value="interview">面试</option>
        </select>
      </label>

      <label>
        关键词
        <input
          aria-label="关键词"
          type="text"
          placeholder="搜索标题/公司"
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
        />
      </label>

      <label>
        状态
        <select
          aria-label="状态"
          value={value.status}
          onChange={(e) => set('status', e.target.value)}
        >
          <option value="">全部</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label>
        截止时间
        <select
          aria-label="截止时间"
          value={value.deadline}
          onChange={(e) => set('deadline', e.target.value as ExamFilters['deadline'])}
        >
          <option value="all">不限</option>
          <option value="this-week">本周</option>
          <option value="overdue">已逾期</option>
        </select>
      </label>

      <label>
        是否已转任务
        <select
          aria-label="是否已转任务"
          value={value.converted}
          onChange={(e) => set('converted', e.target.value as ExamFilters['converted'])}
        >
          <option value="all">不限</option>
          <option value="converted">已转任务</option>
          <option value="not-converted">未转任务</option>
        </select>
      </label>
    </div>
  );
}