import type { AppEvent } from "@/domain/types";
export interface Outbox {
  enqueue(e: AppEvent): Promise<void>;
  peek(n: number): Promise<AppEvent[]>; // oldest first
  ack(clientIds: string[]): Promise<void>;
  size(): Promise<number>;
}
