import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { getQueueClient } from '../../infrastructure/redis/queueClient.js';
import { QueueNames } from '../../infrastructure/queues/index.js';
import { Queue } from 'bullmq';
import { childLogger } from '../../infrastructure/logger/index.js';

const log = childLogger({ module: 'bull-board' });

export const adminQueuesRouter = Router();

adminQueuesRouter.use(authenticate());
adminQueuesRouter.use(authorize('admin:queue', {}));

adminQueuesRouter.use('/queues', (req, res, next) => {
  try {
    const connection = getQueueClient();
    if (!connection) {
      res.status(503).json({
        success: false,
        error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Queue Redis unavailable' },
      });
      return;
    }

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const queues = QueueNames.filter((n) => n !== 'dlq').map(
      (name) => new BullMQAdapter(new Queue(name, { connection })),
    );

    createBullBoard({
      queues,
      serverAdapter,
    });

    const router = serverAdapter.getRouter();
    router(req, res, next);
  } catch (err) {
    log.error({ err: (err as Error).message }, 'bull-board setup failed');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to initialize queue dashboard' },
    });
  }
});
