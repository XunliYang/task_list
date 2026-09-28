import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExamTable } from './ExamTable';
import { makeExam } from './exam-test-fixtures';

describe('ExamTable', () => {
  it('逾期且未转任务的行带「逾期」标记', () => {
    const overdue = makeExam({ id: 'e1', title: '逾期笔试', deadline: '2000-01-01', taskId: null });
    render(
      <MemoryRouter>
        <ExamTable exams={[overdue]} onEdit={() => {}} onConvert={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('逾期')).toBeInTheDocument();
  });

  it('已转任务的行渲染任务链接', () => {
    const converted = makeExam({ id: 'e2', title: '已转任务面试', taskId: 'task-1' });
    render(
      <MemoryRouter>
        <ExamTable exams={[converted]} onEdit={() => {}} onConvert={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '查看任务' })).toHaveAttribute('href', '/tasks/task-1');
  });

  it('逾期但已转任务的行不显示「逾期」', () => {
    const converted = makeExam({ id: 'e3', title: '已转任务且逾期', deadline: '2000-01-01', taskId: 'task-1' });
    render(
      <MemoryRouter>
        <ExamTable exams={[converted]} onEdit={() => {}} onConvert={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('逾期')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看任务' })).toBeInTheDocument();
  });
});