import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataBackup } from './DataBackup';

const mocks = vi.hoisted(() => ({
  exportSnapshot: vi.fn(() => JSON.stringify({ version: 1 })),
  importSnapshot: vi.fn(),
  parseBackupJson: vi.fn((json: string) => JSON.parse(json)),
}));

vi.mock('../../api/local-store', () => ({
  localStore: {
    exportSnapshot: mocks.exportSnapshot,
    importSnapshot: mocks.importSnapshot,
  },
  parseBackupJson: mocks.parseBackupJson,
}));

const downloadMocks = vi.hoisted(() => ({
  downloadTextFile: vi.fn(),
}));

vi.mock('./backup', () => ({
  buildBackupFilename: () => 'task-list-backup-test.json',
  downloadTextFile: downloadMocks.downloadTextFile,
}));

function renderBackup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={client}>
      <DataBackup />
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

const seed = {
  version: 1,
  tasks: [],
  statusCategories: [
    { id: 'status-todo', name: '待开始', color: '#9e9e9e', order: 0 },
  ],
  progressEntries: [],
  examInfos: [],
};

describe('DataBackup', () => {
  beforeEach(() => {
    mocks.exportSnapshot.mockReturnValue(JSON.stringify(seed));
    mocks.parseBackupJson.mockImplementation((json: string) => JSON.parse(json));
    mocks.importSnapshot.mockClear();
    downloadMocks.downloadTextFile.mockClear();
  });

  it('导出：下载 JSON 备份并展示成功提示', () => {
    renderBackup();
    fireEvent.click(screen.getByRole('button', { name: '导出备份' }));
    expect(downloadMocks.downloadTextFile).toHaveBeenCalledWith(
      'task-list-backup-test.json',
      JSON.stringify(seed),
    );
    expect(screen.getByRole('status')).toHaveTextContent('已导出备份文件');
  });

  it('导入合法备份：解析 → 覆盖 store → 失效缓存 → 成功提示', async () => {
    const { invalidate } = renderBackup();
    const file = new File(['{"version":1}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('选择备份文件'), { target: { files: [file] } });

    await waitFor(() => expect(mocks.importSnapshot).toHaveBeenCalledTimes(1));
    expect(mocks.parseBackupJson).toHaveBeenCalledWith('{"version":1}');
    expect(invalidate).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('导入成功');
  });

  it('导入非法备份：展示错误提示且不写入', async () => {
    mocks.parseBackupJson.mockImplementation(() => {
      throw new Error('备份文件不是合法 JSON');
    });
    renderBackup();
    const file = new File(['not json'], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('选择备份文件'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('备份文件不是合法 JSON');
    expect(mocks.importSnapshot).not.toHaveBeenCalled();
  });
});
