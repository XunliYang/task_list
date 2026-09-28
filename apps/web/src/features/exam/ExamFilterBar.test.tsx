import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExamFilterBar } from './ExamFilterBar';
import {
  DEFAULT_EXAM_FILTERS,
  applyExamFilters,
  type ExamFilters,
} from './exam-filter';
import { makeExam } from './exam-test-fixtures';

const exams = [
  makeExam({ id: 'e1', title: 'ACME 笔试', type: 'exam', company: 'ACME' }),
  makeExam({ id: 'e2', title: 'Beta 面试', type: 'interview', company: 'Beta' }),
  makeExam({ id: 'e3', title: 'ACME 二面', type: 'interview', company: 'ACME' }),
];

function Harness() {
  const [filters, setFilters] = useState<ExamFilters>(DEFAULT_EXAM_FILTERS);
  const visible = applyExamFilters(exams, filters);
  return (
    <>
      <ExamFilterBar value={filters} statusOptions={['待报名']} onChange={setFilters} />
      <ul>
        {visible.map((exam) => (
          <li key={exam.id}>{exam.title}</li>
        ))}
      </ul>
    </>
  );
}

describe('ExamFilterBar 组合筛选', () => {
  it('类型 + 关键词同时生效', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 初始：3 条全部可见。
    expect(screen.getByText('ACME 笔试')).toBeInTheDocument();
    expect(screen.getByText('Beta 面试')).toBeInTheDocument();
    expect(screen.getByText('ACME 二面')).toBeInTheDocument();

    // 选类型 = 面试。
    await user.selectOptions(screen.getByLabelText('类型'), 'interview');
    expect(screen.queryByText('ACME 笔试')).not.toBeInTheDocument();
    expect(screen.getByText('Beta 面试')).toBeInTheDocument();
    expect(screen.getByText('ACME 二面')).toBeInTheDocument();

    // 再输入关键词 ACME：类型 + 关键词叠加，只剩 ACME 二面。
    await user.type(screen.getByLabelText('关键词'), 'ACME');
    expect(screen.queryByText('Beta 面试')).not.toBeInTheDocument();
    expect(screen.getByText('ACME 二面')).toBeInTheDocument();
  });
});