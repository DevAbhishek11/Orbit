import child_process from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export interface EmbeddedMongo {
  uri: string;
  port: number;
  stop: () => void;
}

function resolveServerScript(): string {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/@rckflr/easydb-server/bin/easydb-server.js'),
    path.resolve(process.cwd(), '../node_modules/@rckflr/easydb-server/bin/easydb-server.js'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('embedded mongo server binary not found');
  return found;
}

async function waitForPort(port: number, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (open) return;
    if (Date.now() > deadline) throw new Error(`embedded mongo did not start on port ${port}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export async function startEmbeddedMongo(dbName = 'orbit_test'): Promise<EmbeddedMongo> {
  const port = 30_000 + Math.floor(Math.random() * 20_000);
  const child = child_process.spawn(
    process.execPath,
    [resolveServerScript(), '--port', String(port), '-a', 'memory'],
    { stdio: 'ignore' },
  );
  await waitForPort(port);
  return {
    uri: `mongodb://127.0.0.1:${port}/${dbName}`,
    port,
    stop: () => {
      child.kill('SIGKILL');
    },
  };
}
