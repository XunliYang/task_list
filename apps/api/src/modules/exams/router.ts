import { Router } from 'express';
import type { DataSnapshot } from '@task-list/shared';
import {
  convertExamToTaskInputSchema,
  createExamInfoInputSchema,
  examsImportInputSchema,
  updateExamInfoInputSchema,
} from '@task-list/shared';
import { JsonStore } from '../../store/json-store';
import { run } from '../../store/run';
import { HttpError } from '../../http-error';
import * as service from './service';

export function createExamsRouter(store: JsonStore<DataSnapshot>): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const type = req.query.type as 'exam' | 'interview' | undefined;
    if (type !== undefined && type !== 'exam' && type !== 'interview') {
      throw new HttpError(400, 'validation_error', `type 只能为 exam|interview，收到：${String(req.query.type)}`);
    }
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const snapshot = await store.read();
    res.json(service.listExams(snapshot, { type, q, status }));
  });

  // 批量导入（必须先于 /:id 类路由声明，/import 是字面量路径）。
  router.post('/import', async (req, res) => {
    const input = examsImportInputSchema.parse(req.body);
    const out = await run(store, (s) => service.importExams(s, input.format, input.content));
    res.status(201).json({ imported: out.imported, skipped: out.skipped, items: out.items });
  });

  router.post('/', async (req, res) => {
    const input = createExamInfoInputSchema.parse(req.body);
    const out = await run(store, (s) => service.createExam(s, input));
    res.status(201).json(out.exam);
  });

  router.post('/:id/to-task', async (req, res) => {
    const input = convertExamToTaskInputSchema.parse(req.body);
    const out = await run(store, (s) => service.convertExamToTask(s, req.params.id, input));
    res.status(201).json({ task: out.task, exam: out.exam });
  });

  router.patch('/:id', async (req, res) => {
    const input = updateExamInfoInputSchema.parse(req.body);
    const out = await run(store, (s) => service.updateExam(s, req.params.id, input));
    res.json(out.exam);
  });

  router.delete('/:id', async (req, res) => {
    await run(store, (s) => service.deleteExam(s, req.params.id));
    res.status(204).end();
  });

  return router;
}