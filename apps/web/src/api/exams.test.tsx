import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpdateExam } from './exams';
import { examKeys } from './query-keys';

const { mockPatch } = vi.hoisted(() => ({ mockPatch: vi.fn() }));

vi.mock('./client', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: mockPatch,
    delete: vi.fn(),
  },
}));

function wrapper(client: QueryClient) {
  return function Provider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useUpdateExam', () => {
  it('编辑保存成功后失效 exam 列表 key（前缀 exams/list），并同步失效详情 key', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockPatch.mockResolvedValue({ id: 'exam-1', title: '新标题' });

    const { result } = renderHook(() => useUpdateExam('exam-1'), {
      wrapper: wrapper(queryClient),
    });

    await result.current.mutateAsync({ title: '新标题' });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: examKeys.lists() }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: examKeys.detail('exam-1') }),
    );
  });
});
