import path from 'node:path';
import { createApp } from './app';
import { loadConfig } from './config';
import { JsonStore } from './store/json-store';
import { createSeedSnapshot } from './store/seed';

const config = loadConfig();

// 单文件 JSON 快照存储：file 为 <DATA_DIR>/store.json，不存在时用默认状态分类 seed。
const store = new JsonStore(path.join(config.dataDir, 'store.json'), createSeedSnapshot);

const app = createApp({ store });

app.listen(config.port, () => {
  console.log(`task_list api listening on http://localhost:${config.port}`);
});