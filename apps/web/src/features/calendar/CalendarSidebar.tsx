import { Link } from 'react-router-dom';
import { useRecentProgress } from '../../api/progress';
import { DayDetailPanel } from './DayDetailPanel';
import { buildScheduleEvents } from './useCalendarEvents';
import type { CalendarEvent } from './useCalendarEvents';
import { CALENDAR_COPY } from './calendar-copy';

export interface CalendarSidebarProps {
  /** 全部日历事件（同一投影，供「日程」复用）。 */
  events: CalendarEvent[];
  /** 按日期分组的事件（选中日期时供 DayDetailPanel 聚焦展示）。 */
  eventsByDate: Map<string, CalendarEvent[]>;
  /** 选中日期键；非空时「日程」聚焦该日，否则展示今日起近 7 天。 */
  selectedDate: string | null;
  /** 取消选中（关闭聚焦面板）。 */
  onCloseDate: () => void;
  /** 注入的「今天」（相对时间 / 逾期判定，测试可固定）。 */
  now?: Date;
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 超 7 天回退为日期（YYYY-MM-DD）。 */
export function formatRelativeTime(at: string, now: Date = new Date()): string {
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return at.slice(0, 10);
  const diff = now.getTime() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return at.slice(0, 10);
}

/**
 * 日历侧栏（常显 320px sticky 栏）：
 * - 「日程」：复用 useCalendarEvents 的 stage-due 投影，今日起近 7 天 + 逾期置顶标红；
 *   选中日期时聚焦该日（DayDetailPanel）。
 * - 「动态」：GET /api/progress 跨任务最近进展，倒序展示「任务 · 摘要 · 相对时间」。
 */
export function CalendarSidebar({
  events,
  eventsByDate,
  selectedDate,
  onCloseDate,
  now,
}: CalendarSidebarProps) {
  const { data: recentProgress, isLoading, isError } = useRecentProgress(10);
  const schedule = buildScheduleEvents(events, { now, days: 7 });

  return (
    <aside className="calendar-sidebar" aria-label={CALENDAR_COPY.sidebarLabel}>
      <section className="calendar-sidebar__section" aria-label={CALENDAR_COPY.scheduleTitle}>
        <h2 className="calendar-sidebar__heading">{CALENDAR_COPY.scheduleTitle}</h2>

        {selectedDate ? (
          <DayDetailPanel
            dateKey={selectedDate}
            events={eventsByDate.get(selectedDate) ?? []}
            onClose={onCloseDate}
            now={now}
          />
        ) : schedule.length === 0 ? (
          <p className="calendar-sidebar__empty">{CALENDAR_COPY.emptySchedule}</p>
        ) : (
          <ul className="calendar-sidebar__list">
            {schedule.map((e) => (
              <li key={e.key}>
                <Link
                  className={
                    e.overdue
                      ? 'calendar-sidebar__item calendar-sidebar__item--overdue'
                      : 'calendar-sidebar__item'
                  }
                  to={`/tasks/${e.taskId}`}
                >
                  <span
                    className="calendar-sidebar__dot"
                    style={{ backgroundColor: e.color }}
                    aria-hidden="true"
                  />
                  <span className="calendar-sidebar__item-main">
                    <span className="calendar-sidebar__item-title">{e.taskTitle}</span>
                    <span className="calendar-sidebar__item-sub">
                      {e.stageName ? `${CALENDAR_COPY.stageLabel}：${e.stageName} · ` : ''}
                      {e.date}
                      {e.overdue ? ` · ${CALENDAR_COPY.overdueSuffix}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="calendar-sidebar__section" aria-label={CALENDAR_COPY.activityTitle}>
        <h2 className="calendar-sidebar__heading">{CALENDAR_COPY.activityTitle}</h2>

        {isLoading ? (
          <p className="calendar-sidebar__empty">{CALENDAR_COPY.loading}</p>
        ) : isError ? (
          <p className="calendar-sidebar__empty">{CALENDAR_COPY.error}</p>
        ) : !recentProgress || recentProgress.length === 0 ? (
          <p className="calendar-sidebar__empty">{CALENDAR_COPY.emptyActivity}</p>
        ) : (
          <ul className="calendar-sidebar__list">
            {recentProgress.map((entry) => (
              <li key={entry.id}>
                <Link className="calendar-sidebar__item" to={`/tasks/${entry.taskId}`}>
                  <span className="calendar-sidebar__item-main">
                    <span className="calendar-sidebar__item-title">{entry.taskTitle}</span>
                    <span className="calendar-sidebar__item-sub">
                      {entry.summary} · {formatRelativeTime(entry.at, now)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
