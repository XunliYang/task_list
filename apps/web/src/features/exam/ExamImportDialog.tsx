import { useRef, useState } from 'react';
import type { ExamsImportResult } from '@task-list/shared';
import { useImportExams } from '../../api/exams';
import { CSV_HEADER } from './exam-copy';
import {
  csvTemplate,
  parseCsvToDrafts,
  parseJsonToDrafts,
  type ExamImportPreview,
} from './exam-import';

export interface ExamImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExamImportDialog({ open, onClose }: ExamImportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<ExamsImportResult | null>(null);
  const [error, setError] = useState('');
  const importMutation = useImportExams();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return null;
  }

  const preview: ExamImportPreview =
    format === 'csv' ? parseCsvToDrafts(content) : parseJsonToDrafts(content);
  const totalRows = preview.drafts.length + preview.skipped;

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setError('');
    if (content.trim() === '') {
      setError('请先粘贴或选择内容');
      return;
    }
    try {
      const res = await importMutation.mutateAsync({ format, content: content.trim() });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([`${csvTemplate()}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'exams-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const switchFormat = (next: 'csv' | 'json') => {
    setFormat(next);
    setResult(null);
    setError('');
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="导入考试/面试信息">
      <h2>导入考试/面试信息</h2>

      {result ? (
        <div>
          <p>
            导入完成：成功 {result.imported} 条，跳过 {result.skipped} 条。
          </p>
          {result.skipped > 0 ? (
            <p role="alert">跳过了 {result.skipped} 条无法解析的行。</p>
          ) : null}
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      ) : (
        <>
          <div role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={format === 'csv'}
              onClick={() => switchFormat('csv')}
            >
              CSV
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={format === 'json'}
              onClick={() => switchFormat('json')}
            >
              JSON
            </button>
          </div>

          <div style={{ margin: '8px 0' }}>
            <input
              ref={fileRef}
              type="file"
              accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {format === 'csv' ? (
              <button type="button" onClick={downloadTemplate}>
                下载模板
              </button>
            ) : null}
          </div>

          <textarea
            aria-label="导入内容"
            rows={8}
            style={{ width: '100%' }}
            value={content}
            placeholder={
              format === 'csv'
                ? `粘贴 CSV 文本（表头：${CSV_HEADER.join(',')}）`
                : '粘贴 JSON 数组文本，如 [{"title":"ACME 笔试","type":"exam"}]'
            }
            onChange={(e) => setContent(e.target.value)}
          />

          {preview.error ? <p role="alert">{preview.error}</p> : null}

          {!preview.error && content.trim() !== '' && totalRows > 0 ? (
            <div>
              <p>
                预览（前 10 条，共 {totalRows} 行）：预计导入 {preview.drafts.length} 条，跳过{' '}
                {preview.skipped} 条。
              </p>
              <table style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {CSV_HEADER.map((header) => (
                      <th key={header} style={{ border: '1px solid #ddd', padding: '4px 8px' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.drafts.slice(0, 10).map((draft, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.title}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.type}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.company}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.deadline}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.url}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.location}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.status}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px 8px' }}>{draft.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {error ? <p role="alert">{error}</p> : null}

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? '导入中…' : '确认导入'}
            </button>{' '}
            <button type="button" onClick={onClose}>
              取消
            </button>
          </div>
        </>
      )}
    </div>
  );
}