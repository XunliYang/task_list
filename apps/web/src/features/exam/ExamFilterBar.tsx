import type { ExamFilters } from './exam-filter';

export interface ExamFilterBarProps {
  value: ExamFilters;
  /** 由列表数据动态推导出的状态选项（去重后的非空 status）。 */
  statusOptions: string[];
  onChange: (next: ExamFilters) => void;
}

/** 该控件是否处于「已选中非默认值」的激活态（激活态用珊瑚描边/淡底）。 */
function controlClass(active: boolean): string {
  return active ? 'exam-field exam-filterbar-control--active' : 'exam-field';
}

export function ExamFilterBar({ value, statusOptions, onChange }: ExamFilterBarProps) {
  const set = <K extends keyof ExamFilters>(key: K, next: ExamFilters[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="exam-filterbar">
      <label>
        类型
        <select
          className={controlClass(value.type !== 'all')}
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
          className={controlClass(value.q.trim() !== '')}
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
          className={controlClass(value.status !== '')}
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
          className={controlClass(value.deadline !== 'all')}
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
          className={controlClass(value.converted !== 'all')}
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