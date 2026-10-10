/**
 * 本地数据备份（导出/导入）的纯工具函数，与 React 解耦便于单测。
 */

/** 备份文件名：`task-list-backup-YYYY-MM-DD.json`（本地时区日期）。 */
export function buildBackupFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `task-list-backup-${y}-${m}-${d}.json`;
}

/** 把文本内容触发为浏览器下载（JSON 备份文件）。 */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
