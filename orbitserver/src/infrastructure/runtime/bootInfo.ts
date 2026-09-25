const bootTime = Date.now();

export const startedAt = new Date(bootTime).toISOString();

export function uptimeSeconds(): number {
  return Math.round((Date.now() - bootTime) / 1000);
}
