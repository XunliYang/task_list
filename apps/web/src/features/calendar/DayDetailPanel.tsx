import { Link } from 'react-router-dom';
import type { CalendarEvent } from './useCalendarEvents';
import { CALENDAR_COPY } from './calendar-copy';

export interface DayDetailPanelProps {
  dateKey: string;
  /** 已排序的事件 */
  events: CalendarEvent[];
  onClose: () => void;
}

/** 点选某日后的右侧面板：列出当日全部条目，每条可跳转任务详情。 */
export function DayDetailPanel({ dateKey, events, onClose }: DayDetailPanelProps) {
  return (
    <aside className="day-detail" aria-label={CALENDAR_COPY.dayPanelTitle(dateKey)}>
      <header className="day-detail__header">
        <h2 className="day-detail__title">{dateKey}</h2>
        <button
          type="button"
          className="day-detail__close"
          onClick={onClose}
          aria-label={CALENDAR_COPY.closePanel}
        >
          ×
        </button>
      </header>

      {events.length === 0 ? (
        <p className="day-detail__empty">{CALENDAR_COPY.emptyDay}</p>
      ) : (
        <ul className="day-detail__list">
          {events.map((e) => (
            <li
              key={e.key}
              className={`day-detail__item${e.done ? ' day-detail__item--done' : ''}`}
            >
              <Link to={`/tasks/${e.taskId}`} className="day-detail__task">
                {e.taskTitle}
              </Link>

              {e.kind === 'stage-due' ? (
                <div className="day-detail__meta">
                  <span>
                    {CALENDAR_COPY.stageLabel}：{e.stageName}
                  </span>
                  <span>
                    {CALENDAR_COPY.dueLabel}：{e.stageDueDate}
                  </span>
                  {e.overdue && <span className="day-detail__overdue">{CALENDAR_COPY.overdueLabel}</span>}
                </div>
              ) : (
                <div className="day-detail__meta">
                  {CALENDAR_COPY.updatedLabel} {e.date}
                </div>
              )}

              {e.currentStageName && (
                <div className="day-detail__current">
                  {CALENDAR_COPY.currentStageLabel}：{e.currentStageName}
                  {e.currentStageDueDate ? `（${CALENDAR_COPY.dueLabel} ${e.currentStageDueDate}）` : ''}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}