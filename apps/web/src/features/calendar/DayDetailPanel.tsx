import type { CalendarEvent } from './useCalendarEvents';
import { Row } from '../../ui';
import type { RowStage } from '../../ui';
import { CALENDAR_COPY } from './calendar-copy';

export interface DayDetailPanelProps {
  dateKey: string;
  /** 已排序的事件 */
  events: CalendarEvent[];
  onClose: () => void;
  /** 注入的「今天」（逾期显示用，测试可固定；缺省真实当前时间） */
  now?: Date;
}

/** stage-due 事件的次要说明行：阶段名 + （可选）当前阶段。 */
function stageSubtitle(e: CalendarEvent): string {
  const parts: string[] = [];
  if (e.stageName) parts.push(`${CALENDAR_COPY.stageLabel}：${e.stageName}`);
  if (e.currentStageName && e.currentStageName !== e.stageName) {
    parts.push(`${CALENDAR_COPY.currentStageLabel}：${e.currentStageName}`);
  }
  return parts.join(' · ');
}

function toRowStage(e: CalendarEvent): RowStage[] | undefined {
  if (e.kind !== 'stage-due') return undefined;
  return [
    {
      id: e.stageId ?? e.key,
      name: e.stageName ?? '',
      status: e.done ? 'done' : 'pending',
      dueDate: e.stageDueDate,
    },
  ];
}

/** 点选某日后的右侧面板：列出当日全部条目，每条用 ui/Row 展示，可跳转任务详情。 */
export function DayDetailPanel({ dateKey, events, onClose, now }: DayDetailPanelProps) {
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
            <Row
              key={e.key}
              statusColor={e.color}
              statusName={e.statusName}
              title={e.taskTitle}
              subtitle={
                e.kind === 'stage-due'
                  ? stageSubtitle(e)
                  : `${CALENDAR_COPY.updatedLabel} ${e.date}`
              }
              stages={toRowStage(e)}
              href={`/tasks/${e.taskId}`}
              now={now}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
