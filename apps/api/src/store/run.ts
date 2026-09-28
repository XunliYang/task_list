import type { DataSnapshot } from '@task-list/shared';
import { JsonStore } from './json-store';

/**
 * 在串行写队列内执行一次变更，并把业务结果「带出来」。
 *
 * service 层的纯函数统一返回 `{ snapshot, ...result }`（snapshot 为新快照，
 * 其余字段为本次变更的产物），此处把新快照落盘并提供给 store.write 的
 * mutator，同时把整个对象原样返回给调用方。
 */
export async function run<TExtra>(
  store: JsonStore<DataSnapshot>,
  mutator: (snapshot: DataSnapshot) => { snapshot: DataSnapshot } & TExtra,
): Promise<TExtra> {
  let out: { snapshot: DataSnapshot } & TExtra = {} as { snapshot: DataSnapshot } & TExtra;
  await store.write((snapshot) => {
    out = mutator(snapshot);
    return out.snapshot;
  });
  return out;
}