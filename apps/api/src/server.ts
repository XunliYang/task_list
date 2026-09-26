import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`task_list api listening on http://localhost:${config.port}`);
});
