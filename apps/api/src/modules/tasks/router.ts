import { Router } from 'express';
import type { DataSnapshot } from '@task-list/shared';
import {
  addStageInputSchema,
  createProgressInputSchema,
  createTaskInputSchema,
  updateStageInputSchema,
  updateTaskInputSchema,
} from '@task-list/shared';
import { JsonStore } from '../../store/json-store';
import { run } from '../../store/run';
import { HttpError } from '../../http-error';
import * as service from './service';

export function createTasksRouter(store: JsonStore<DataSnapshot>): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const statusIds = Array.isArray(req.query.statusId)
      ? (req.query.statusId as string[])
      : req.query.statusId
        ? [req.query.statusId as string]
        : undefined;

    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    let stageStatus: 'done' | 'pending' | undefined;
    if (req.query.stageStatus !== undefined) {
      const raw = req.query.stageStatus as string;
      if (raw !== 'done' && raw !== 'pending') {
        throw new HttpError(400, 'validation_error', `stageStatus 只能为 done|pending，收到：${raw}`);
      }
      stageStatus = raw;
    }

    const snapshot = await store.read();
    res.json(service.listTasks(snapshot, { statusIds, q, stageStatus }));
  });

  router.get('/:id', async (req, res) => {
    const snapshot = await store.read();
    res.json(service.getTask(snapshot, req.params.id));
  });

  router.post('/', async (req, res) => {
    const input = createTaskInputSchema.parse(req.body);
    const out = await run(store, (s) => service.createTask(s, input));
    res.status(201).json(out.task);
  });

  router.patch('/:id', async (req, res) => {
    const input = updateTaskInputSchema.parse(req.body);
    const out = await run(store, (s) => service.updateTask(s, req.params.id, input));
    res.json(out.task);
  });

  router.delete('/:id', async (req, res) => {
    await run(store, (s) => service.deleteTask(s, req.params.id));
    res.status(204).end();
  });

  // -------------------------------------------------------------------------
  // 进展记录
  // -------------------------------------------------------------------------

  router.get('/:id/progress', async (req, res) => {
    const snapshot = await store.read();
    res.json(service.listProgress(snapshot, req.params.id));
  });

  router.post('/:id/progress', async (req, res) => {
    const input = createProgressInputSchema.parse(req.body);
    const out = await run(store, (s) => service.addProgress(s, req.params.id, input));
    res.status(201).json(out.entry);
  });

  // -------------------------------------------------------------------------
  // 阶段增删改
  // -------------------------------------------------------------------------

  router.post('/:id/stages', async (req, res) => {
    const input = addStageInputSchema.parse(req.body);
    const out = await run(store, (s) => service.addStage(s, req.params.id, input));
    res.status(201).json(out.task);
  });

  router.patch('/:id/stages/:stageId', async (req, res) => {
    const input = updateStageInputSchema.parse(req.body);
    const out = await run(store, (s) =>
      service.updateStage(s, req.params.id, req.params.stageId, input),
    );
    res.json(out.task);
  });

  router.delete('/:id/stages/:stageId', async (req, res) => {
    const out = await run(store, (s) => service.deleteStage(s, req.params.id, req.params.stageId));
    res.json(out.task);
  });

  // -------------------------------------------------------------------------
  // 阶段流转
  // -------------------------------------------------------------------------

  router.post('/:id/advance', async (req, res) => {
    const out = await run(store, (s) => service.advanceStage(s, req.params.id));
    res.json(out.result);
  });

  router.patch('/:id/current-stage', async (req, res) => {
    const { stageId } = req.body as { stageId?: unknown };
    if (typeof stageId !== 'string' || stageId.length === 0) {
      throw new HttpError(400, 'validation_error', 'stageId 必填且为非空字符串');
    }
    const out = await run(store, (s) => service.setCurrentStage(s, req.params.id, stageId));
    res.json(out.task);
  });

  return router;
}