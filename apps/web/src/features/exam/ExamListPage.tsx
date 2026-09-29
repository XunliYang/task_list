import { useMemo, useState } from 'react';
import type { ExamInfo } from '@task-list/shared';
import { useExams } from '../../api/exams';
import { Button } from '../../ui';
import { ExamFilterBar } from './ExamFilterBar';
import { ExamTable } from './ExamTable';
import { ExamEditorDialog } from './ExamEditorDialog';
import { ExamImportDialog } from './ExamImportDialog';
import { ConvertToTaskDialog } from './ConvertToTaskDialog';
import { SORT_OPTIONS, type SortKey } from './exam-copy';
import {
  DEFAULT_EXAM_FILTERS,
  applyExamFilters,
  sortExams,
  type ExamFilters,
} from './exam-filter';
import './exam.css';

export function ExamListPage() {
  const { data: exams = [] } = useExams();

  const [filters, setFilters] = useState<ExamFilters>(DEFAULT_EXAM_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('deadline');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamInfo | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [convertExam, setConvertExam] = useState<ExamInfo | null>(null);

  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const exam of exams) {
      if (exam.status) {
        seen.add(exam.status);
      }
    }
    return [...seen];
  }, [exams]);

  const visible = useMemo(
    () => sortExams(applyExamFilters(exams, filters), sortKey),
    [exams, filters, sortKey],
  );

  const openCreate = () => {
    setEditingExam(null);
    setEditorOpen(true);
  };
  const openEdit = (exam: ExamInfo) => {
    setEditingExam(exam);
    setEditorOpen(true);
  };

  return (
    <section className="exam-page">
      <header className="exam-page-header">
        <h1 className="exam-title">考试信息</h1>
        <div className="exam-toolbar">
          <Button variant="primary" onClick={openCreate}>
            添加
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            导入
          </Button>
          <label className="exam-sort">
            排序
            <select
              className="exam-field"
              aria-label="排序"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <ExamFilterBar value={filters} statusOptions={statusOptions} onChange={setFilters} />

      <ExamTable exams={visible} onEdit={openEdit} onConvert={setConvertExam} />

      <ExamEditorDialog open={editorOpen} exam={editingExam} onClose={() => setEditorOpen(false)} />
      <ExamImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ConvertToTaskDialog
        exam={convertExam}
        open={convertExam !== null}
        onClose={() => setConvertExam(null)}
        onConverted={() => undefined}
      />
    </section>
  );
}