export interface ContentReporter {
  report(r: { refId: string; message: string; contentVersion?: number }): Promise<void>; // queues locally if offline
}
