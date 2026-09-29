import type { ExamInfo } from '@task-list/shared';
import { Link } from 'react-router-dom';
import { Badge, Button } from '../../ui';
import { EXAM_TYPE_META } from './exam-copy';
import { isOverdue } from './exam-filter';

export interface ExamTableProps {
  /** 已按排序/筛选处理好的列表。 */
  exams: ExamInfo[];
  onEdit: (exam: ExamInfo) => void;
  onConvert: (exam: ExamInfo) => void;
}

/** 类型 → Badge 语义变体（走令牌，不写死颜色）。 */
function typeBadgeVariant(type: ExamInfo['type']): 'primary' | 'warning' {
  return type === 'exam' ? 'primary' : 'warning';
}

/** 来源 → 中文标签。 */
function sourceLabel(source: ExamInfo['source']): string {
  return source === 'import' ? '导入' : '手动';
}

interface ExamRowProps {
  exam: ExamInfo;
  onEdit: (exam: ExamInfo) => void;
  onConvert: (exam: ExamInfo) => void;
}

function ExamRow({ exam, onEdit, onConvert }: ExamRowProps) {
  const overdue = isOverdue(exam.deadline) && !exam.taskId;
  const meta = EXAM_TYPE_META[exam.type];

  return (
    <li className="exam-row" data-testid={`exam-row-${exam.id}`}>
      <div className="exam-grid">
        <span className="exam-col-type">
          <Badge variant={typeBadgeVariant(exam.type)}>{meta.label}</Badge>
        </span>

        <span className="exam-col-title">{exam.title}</span>

        <span className="exam-col-company">{exam.company ?? '—'}</span>

        <span className="exam-col-status">{exam.status || '—'}</span>

        <span className="exam-col-deadline">
          <span className={overdue ? 'exam-dl-date exam-dl-date--overdue' : 'exam-dl-date'}>
            {exam.deadline ?? '—'}
          </span>
          {overdue ? <span className="exam-dl-overdue">逾期</span> : null}
        </span>

        <span className="exam-col-source">
          <Badge variant="neutral">{sourceLabel(exam.source)}</Badge>
        </span>

        <span className="exam-col-actions">
          {exam.taskId ? (
            <>
              <Badge variant="success">已转化</Badge>
              <Link className="exam-view-link" to={`/tasks/${exam.taskId}`}>
                查看任务
              </Link>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onConvert(exam)}>
              转任务
            </Button>
          )}
          <Button variant="ghost" onClick={() => onEdit(exam)}>
            编辑
          </Button>
        </span>
      </div>
    </li>
  );
}

export function ExamTable({ exams, onEdit, onConvert }: ExamTableProps) {
  return (
    <div className="exam-table">
      <div className="exam-table-header" aria-hidden="true">
        <div className="exam-grid">
          <span className="exam-col-type">类型</span>
          <span className="exam-col-title">标题</span>
          <span className="exam-col-company">公司</span>
          <span className="exam-col-status">状态</span>
          <span className="exam-col-deadline">截止</span>
          <span className="exam-col-source">来源</span>
          <span className="exam-col-actions">操作</span>
        </div>
      </div>
      <ul className="exam-table-body">
        {exams.length === 0 ? (
          <li className="exam-row exam-row--empty">暂无数据</li>
        ) : (
          exams.map((exam) => (
            <ExamRow key={exam.id} exam={exam} onEdit={onEdit} onConvert={onConvert} />
          ))
        )}
      </ul>
    </div>
  );
}