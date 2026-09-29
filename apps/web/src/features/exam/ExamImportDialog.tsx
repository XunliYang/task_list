import { useRef, useState } from 'react';
import type { ExamsImportResult } from '@task-list/shared';
import { useImportExams } from '../../api/exams';
import { Button, SuccessMorphButton } from '../../ui';
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

  // 返回真实请求 Promise；空内容/请求失败抛错让 SuccessMorphButton 进入 error 态。
  const handleImport = async () => {
    setError('');
    if (content.trim() === '') {
      setError('请先粘贴或选择内容');
      throw new Error('请先粘贴或选择内容');
    }
    try {
      const res = await importMutation.mutateAsync({ format, content: content.trim() });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
      throw err;
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
    <div className="exam-dialog" role="dialog" aria-modal="true" aria-label="导入考试/面试信息">
      <h2>导入考试/面试信息</h2>

      {result ? (
        <div>
          <p>导入完成：成功 {result.imported} 条，跳过 {result.skipped} 条。</p>
          {result.skipped > 0 ? (
            <p className="exam-inline-error" role="alert">
              跳过了 {result.skipped} 条无法解析的行。
            </p>
          ) : null}
          <div className="exam-dialog-actions">
            <Button variant="secondary" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="exam-import-tabs" role="tablist">
            <Button
              variant={format === 'csv' ? 'primary' : 'ghost'}
              role="tab"
              aria-selected={format === 'csv'}
              onClick={() => switchFormat('csv')}
            >
              CSV
            </Button>
            <Button
              variant={format === 'json' ? 'primary' : 'ghost'}
              role="tab"
              aria-selected={format === 'json'}
              onClick={() => switchFormat('json')}
            >
              JSON
            </Button>
          </div>

          <div className="exam-import-file">
            <input
              ref={fileRef}
              className="exam-field"
              type="file"
              accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {format === 'csv' ? (
              <Button variant="ghost" onClick={downloadTemplate}>
                下载模板
              </Button>
            ) : null}
          </div>

          <textarea
            className="exam-field"
            aria-label="导入内容"
            rows={8}
            autoFocus
            value={content}
            placeholder={
              format === 'csv'
                ? `粘贴 CSV 文本（表头：${CSV_HEADER.join(',')}）`
                : '粘贴 JSON 数组文本，如 [{"title":"ACME 笔试","type":"exam"}]'
            }
            onChange={(e) => setContent(e.target.value)}
          />

          {preview.error ? (
            <p className="exam-inline-error" role="alert">
              {preview.error}
            </p>
          ) : null}

          {!preview.error && content.trim() !== '' && totalRows > 0 ? (
            <div className="exam-import-preview">
              <p>
                预览（前 10 条，共 {totalRows} 行）：预计导入 {preview.drafts.length} 条，跳过{' '}
                {preview.skipped} 条。
              </p>
              <table className="exam-preview-table">
                <thead>
                  <tr>
                    {CSV_HEADER.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.drafts.slice(0, 10).map((draft, index) => (
                    <tr key={index}>
                      <td>{draft.title}</td>
                      <td>{draft.type}</td>
                      <td>{draft.company}</td>
                      <td>{draft.deadline}</td>
                      <td>{draft.url}</td>
                      <td>{draft.location}</td>
                      <td>{draft.status}</td>
                      <td>{draft.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {error ? (
            <p className="exam-inline-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="exam-dialog-actions">
            <SuccessMorphButton onAction={handleImport}>确认导入</SuccessMorphButton>
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
          </div>
        </>
      )}
    </div>
  );
}