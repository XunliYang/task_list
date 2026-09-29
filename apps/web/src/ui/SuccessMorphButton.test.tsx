import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SuccessMorphButton } from './SuccessMorphButton';

/** 可控的 pending promise（resolve/reject 由测试手动触发）。 */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** 冲刷挂起的微任务（await onAction() 之后的状态落地）。 */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** mock window.matchMedia：让 prefers-reduced-motion 查询返回指定值。 */
function mockMatchMedia(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SuccessMorphButton', () => {
  it('idle → pending → success → 自动回 idle 的 DOM 文案序列', async () => {
    vi.useFakeTimers();
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(<SuccessMorphButton onAction={onAction}>保存</SuccessMorphButton>);
    const btn = screen.getByRole('button');

    expect(btn).toHaveTextContent('保存');
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('处理中…');
    expect(onAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });
    expect(btn).toHaveTextContent('已完成');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(btn).toHaveTextContent('保存');
  });

  it('失败走 error（可见文案）且再点可重试成功', async () => {
    vi.useFakeTimers();
    const onAction = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    render(<SuccessMorphButton onAction={onAction}>保存</SuccessMorphButton>);
    const btn = screen.getByRole('button');

    fireEvent.click(btn);
    await flushMicrotasks();
    expect(btn).toHaveTextContent('失败，重试');

    fireEvent.click(btn); // 重试
    expect(onAction).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
    });
    expect(btn).toHaveTextContent('已完成');
  });

  it('pending 期间重复点击只触发一次 onAction', async () => {
    const { promise, resolve: resolveAction } = deferred();
    const onAction = vi.fn(() => promise);
    render(<SuccessMorphButton onAction={onAction}>保存</SuccessMorphButton>);
    const btn = screen.getByRole('button');

    fireEvent.click(btn);
    expect(btn).toHaveTextContent('处理中…');
    expect(btn).toBeDisabled();

    fireEvent.click(btn); // disabled，不应再触发 onAction
    expect(onAction).toHaveBeenCalledTimes(1);

    resolveAction();
    await flushMicrotasks();
    expect(btn).toHaveTextContent('已完成');
  });

  it('始终携带 aria-live，pending 期间携带 aria-busy', async () => {
    const { promise, resolve: resolveAction } = deferred();
    render(<SuccessMorphButton onAction={() => promise}>保存</SuccessMorphButton>);
    const btn = screen.getByRole('button');

    expect(btn).toHaveAttribute('aria-live', 'polite');
    expect(btn).not.toHaveAttribute('aria-busy');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-busy', 'true');

    resolveAction();
    await flushMicrotasks();
    expect(btn).not.toHaveAttribute('aria-busy');
  });

  it('prefers-reduced-motion: reduce 时状态语义不变（mock matchMedia + CSS 关闭动效）', async () => {
    mockMatchMedia(true);
    const css = readFileSync(resolve(process.cwd(), 'src/ui/SuccessMorphButton.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('transition: none');

    vi.useFakeTimers();
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(<SuccessMorphButton onAction={onAction}>保存</SuccessMorphButton>);
    const btn = screen.getByRole('button');

    fireEvent.click(btn);
    await act(async () => {
      await Promise.resolve();
    });
    expect(btn).toHaveTextContent('已完成');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(btn).toHaveTextContent('保存');
  });
});
