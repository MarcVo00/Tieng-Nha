// Stub, replaced in T10
export type SyncService = {
  start(): void;
  stop(): void;
  flush(): Promise<{ sent: number }>;
  onSizeChange(cb: (n: number) => void): () => void;
};
export function createSyncService(): SyncService {
  return { start() {}, stop() {}, async flush() { return { sent: 0 }; }, onSizeChange() { return () => {}; } };
}
