import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ExamInfo } from '@task-list/shared';
import { EXAM_TYPE_META } from './exam-copy';
import { isOverdue } from './exam-filter';

export interface ExamTableProps {
  /** 已按排序/筛选处理好的列表。 */
  exams: ExamInfo[];
  onEdit: (exam: ExamInfo) => void;
  onConvert: (exam: ExamInfo) => void;
}

const cellStyle: CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 10px',
  textAlign: 'left',
  verticalAlign: 'top',
};

const tagStyle = (color: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  color: '#fff',
  backgroundColor: color,
  fontSize: 12,
});

const overdueBadgeStyle: CSSProperties = {
  display: 'inline-block',
  marginLeft: 8,
  padding: '1px 6px',
  borderRadius: 4,
  backgroundColor: '#d32f2f',
  color: '#fff',
  fontSize: 12,
};

export function ExamTable({ exams, onEdit, onConvert }: ExamTableProps) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={cellStyle}>标题</th>
          <th style={cellStyle}>类型</th>
          <th style={cellStyle}>公司</th>
          <th style={cellStyle}>截止时间</th>
          <th style={cellStyle}>状态</th>
          <th style={cellStyle}>已转任务</th>
          <th style={cellStyle}>操作</th>
        </tr>
      </thead>
      <tbody>
        {exams.length === 0 ? (
          <tr>
            <td colSpan={7} style={cellStyle}>
              暂无数据
            </td>
          </tr>
        ) : (
          exams.map((exam) => {
            const overdue = isOverdue(exam.deadline) && !exam.taskId;
            const meta = EXAM_TYPE_META[exam.type];
            const rowStyle: CSSProperties = overdue
              ? { backgroundColor: '#ffecec' }
              : {};

            return (
              <tr key={exam.id} style={rowStyle} data-testid={`exam-row-${exam.id}`}>
                <td style={cellStyle}>{exam.title}</td>
                <td style={cellStyle}>
                  <span style={tagStyle(meta.color)}>{meta.label}</span>
                </td>
                <td style={cellStyle}>{exam.company ?? '—'}</td>
                <td style={cellStyle}>
                  {exam.deadline ?? '—'}
                  {overdue ? <span style={overdueBadgeStyle}>逾期</span> : null}
                </td>
                <td style={cellStyle}>{exam.status || '—'}</td>
                <td style={cellStyle}>
                  {exam.taskId ? <Link to={`/tasks/${exam.taskId}`}>查看任务</Link> : '—'}
                </td>
                <td style={cellStyle}>
                  <button type="button" onClick={() => onEdit(exam)}>
                    编辑
                  </button>{' '}
                  <button type="button" onClick={() => onConvert(exam)}>
                    转任务
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}