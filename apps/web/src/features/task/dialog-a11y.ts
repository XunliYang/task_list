import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * 弹层焦点管理（LEOY-124 键盘可达）：Esc 关闭 + 焦点圈在弹层内不外泄。
 *
 * - 打开时把焦点移入弹层第一个可聚焦元素；
 * - Tab / Shift+Tab 在弹层内循环（焦点不落到遮罩后的页面）；
 * - Esc 触发 onClose。
 *
 * 挂载在 role="dialog" 的容器 ref 上；open=false 时容器为 null，effect 自动失效。
 */
export function useDialogModal(
  containerRef: RefObject<HTMLElement>,
  open: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const root = container;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const contained = active != null && root.contains(active);
      if (e.shiftKey) {
        if (!contained || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!contained || active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    const first = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? root).focus();

    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, containerRef]);
}
