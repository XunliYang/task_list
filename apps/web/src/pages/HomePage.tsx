import { Link } from 'react-router-dom';
import { useStatuses } from '../api/statuses';
import { useTasks } from '../api/tasks';
import { buildOverview } from '../features/home/overview';
import { SectionCard } from '../features/home/SectionCard';
import '../features/home/home.css';

export interface HomePageProps {
  /** 固定时钟注入（测试 / 截图避免依赖真实时间），缺省为当前时间。 */
  now?: Date;
}

const homeCopy = {
  pageTitle: '概览',
  loading: '加载中…',
  loadError: '加载失败，请稍后重试。',
  retry: '重试',
  total: '任务总数',
  inProgress: '进行中',
  completed: '已完成',
  dueThisWeek: '本周到期',
  overdue: '已逾期',
  byStatusTitle: '按状态分类',
  byStatusEmpty: '暂无状态分类，请先到「状态管理」创建。',
  quickEntryTitle: '快捷入口',
  board: '看板',
  boardHint: '查看任务列',
  calendar: '日历',
  calendarHint: '查看日程',
  exams: '考试信息',
  examsHint: '查看考试与面试',
  statuses: '状态管理',
  statusesHint: '管理状态分类',
  newTask: '＋ 新建任务',
  newTaskHint: '去看板快速创建',
  emptyTitle: '还没有任务',
  emptyHint: '创建一个任务，开始追踪你的求职进展，从这里直达看板。',
} as const;

const quickEntries = [
  { title: homeCopy.board, hint: homeCopy.boardHint, to: '/board' },
  { title: homeCopy.calendar, hint: homeCopy.calendarHint, to: '/calendar' },
  { title: homeCopy.exams, hint: homeCopy.examsHint, to: '/exams' },
  { title: homeCopy.statuses, hint: homeCopy.statusesHint, to: '/statuses' },
];

/**
 * 首页概览：聚合真实任务 / 状态分类数据，给出指标、下一步快捷入口、
 * 以及空态 / 加载态 / 失败态。数据一律来自既有 hooks，不新造接口。
 */
export function HomePage({ now }: HomePageProps = {}) {
  const tasksQuery = useTasks();
  const statusesQuery = useStatuses();

  const effectiveNow = now ?? new Date();

  if (tasksQuery.isLoading || statusesQuery.isLoading) {
    return (
      <p className="home-state" role="status">
        {homeCopy.loading}
      </p>
    );
  }

  if (tasksQuery.isError || statusesQuery.isError) {
    const retry = () => {
      tasksQuery.refetch();
      statusesQuery.refetch();
    };
    return (
      <div className="home-state" role="alert">
        <p>{homeCopy.loadError}</p>
        <button type="button" className="home-retry" onClick={retry}>
          {homeCopy.retry}
        </button>
      </div>
    );
  }

  const overview = buildOverview(
    tasksQuery.data ?? [],
    statusesQuery.data ?? [],
    effectiveNow,
  );

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-title">{homeCopy.pageTitle}</h1>
        <p className="home-hint">{overview.recentProgressHint}</p>
      </header>

      {overview.total === 0 ? (
        <section className="home-empty" data-testid="home-empty">
          <h2 className="home-empty-title">{homeCopy.emptyTitle}</h2>
          <p className="home-empty-hint">{homeCopy.emptyHint}</p>
          <Link className="home-empty-new" to="/board?new=1">
            {homeCopy.newTask}
          </Link>
        </section>
      ) : (
        <>
          <section className="home-metrics" aria-label={homeCopy.pageTitle}>
            <SectionCard title={homeCopy.total} value={overview.total} />
            <SectionCard title={homeCopy.inProgress} value={overview.stageStats.inProgress} />
            <SectionCard title={homeCopy.completed} value={overview.stageStats.completed} />
            <SectionCard title={homeCopy.dueThisWeek} value={overview.dueThisWeek} />
            <SectionCard title={homeCopy.overdue} value={overview.overdue} />
          </section>

          <SectionCard title={homeCopy.byStatusTitle}>
            {overview.byStatus.length === 0 ? (
              <p className="home-status-empty">{homeCopy.byStatusEmpty}</p>
            ) : (
              <ul className="home-status-list">
                {overview.byStatus.map((group) => (
                  <li className="home-status-row" key={group.statusId}>
                    <span
                      className="home-status-swatch"
                      style={{ backgroundColor: group.color }}
                      aria-hidden="true"
                    />
                    <span className="home-status-name">{group.name}</span>
                    <span className="home-status-count">{group.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}

      <section className="home-entries" aria-label={homeCopy.quickEntryTitle}>
        {quickEntries.map((entry) => (
          <SectionCard key={entry.to} title={entry.title} to={entry.to}>
            <p className="home-entry-hint">{entry.hint}</p>
          </SectionCard>
        ))}
        {overview.total > 0 ? (
          <SectionCard title={homeCopy.newTask} to="/board?new=1" accent>
            <p className="home-entry-hint">{homeCopy.newTaskHint}</p>
          </SectionCard>
        ) : null}
      </section>
    </div>
  );
}