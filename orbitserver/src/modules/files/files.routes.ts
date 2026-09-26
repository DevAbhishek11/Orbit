import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './files.controller.js';
import { confirmSchema, fileParamsSchema, presignSchema } from './files.schema.js';

export const filesRouter = Router();

const uploadLimit = rateLimit({ tier: 'upload' });
const writeLimit = rateLimit({ tier: 'write' });

filesRouter.use(authenticate());

filesRouter.post(
  '/files/presign',
  uploadLimit,
  validate({ body: presignSchema }),
  authorize('file:upload', {}),
  controller.presign,
);

filesRouter.post(
  '/files/:id/confirm',
  writeLimit,
  validate({ params: fileParamsSchema, body: confirmSchema }),
  authorize('file:upload', {}),
  controller.confirm,
);

filesRouter.get('/files', authorize('board:read', {}), controller.listFiles);

filesRouter.get(
  '/files/:id/download',
  validate({ params: fileParamsSchema }),
  authorize('board:read', {}),
  controller.downloadFile,
);

filesRouter.get(
  '/files/:id',
  validate({ params: fileParamsSchema }),
  authorize('board:read', {}),
  controller.getFile,
);

filesRouter.delete(
  '/files/:id',
  writeLimit,
  validate({ params: fileParamsSchema }),
  authorize('file:delete', {}),
  controller.deleteFile,
);

filesRouter.post(
  '/files/:id/raw',
  uploadLimit,
  validate({ params: fileParamsSchema }),
  authorize('file:upload', {}),
  controller.rawUpload,
);
