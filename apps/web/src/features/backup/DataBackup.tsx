import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { localStore, parseBackupJson } from '../../api/local-store';
import { Button } from '../../ui';
import { buildBackupFilename, downloadTextFile } from './backup';
import './backup.css';

const copy = {
  hint: '数据存在浏览器本地，换设备或清理站点数据前，请先导出备份。',
  export: '导出备份',
  import: '导入备份',
  importSuccess: '导入成功，数据已恢复。',
  importFail: '导入失败，请确认所选文件是导出的备份。',
  readFail: '读取文件失败，请重试。',
  exportSuccess: '已导出备份文件。',
} as const;

/**
 * 本地数据备份：导出当前快照为 JSON 文件，或从备份文件覆盖恢复。
 * 仅作用于浏览器本地数据源（localStorage）；导入后失效所有查询缓存让界面刷新。
 */
export function DataBackup() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleExport() {
    downloadTextFile(buildBackupFilename(), localStore.exportSnapshot());
    setError(null);
    setSuccess(copy.exportSuccess);
  }

  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snapshot = parseBackupJson(String(reader.result ?? ''));
        localStore.importSnapshot(snapshot);
        // 覆盖后失效全部查询缓存，界面刷新为导入后的数据。
        void queryClient.invalidateQueries();
        setError(null);
        setSuccess(copy.importSuccess);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.importFail);
        setSuccess(null);
      }
    };
    reader.onerror = () => {
      setError(copy.readFail);
      setSuccess(null);
    };
    reader.readAsText(file);
  }

  return (
    <div className="data-backup">
      <p className="data-backup-hint">{copy.hint}</p>
      <div className="data-backup-actions">
        <Button variant="secondary" onClick={handleExport}>
          {copy.export}
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          {copy.import}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="选择备份文件"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {success ? (
        <span className="data-backup-success" role="status">
          {success}
        </span>
      ) : null}
      {error ? (
        <span className="data-backup-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
