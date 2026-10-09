import type { ContentReporter } from "@/ports";

export type FakeReport = { refId: string; message: string; contentVersion?: number };

export class FakeContentReporter implements ContentReporter {
  reports: FakeReport[] = [];

  async report(r: FakeReport): Promise<void> {
    this.reports.push(r);
  }
}
