import { createHistogram, monitorEventLoopDelay } from "node:perf_hooks";

export class GameplayMetrics {
  readonly commands = createHistogram();
  readonly outboxWait = createHistogram();
  readonly loop = monitorEventLoopDelay({ resolution: 20 });
  projections = 0;
  refused = 0;
  constructor() {
    this.loop.enable();
  }
  command(ms: number) {
    this.commands.record(Math.max(1, Math.round(ms * 1000000)));
  }
  dispatched(ms: number) {
    this.outboxWait.record(Math.max(1, Math.round(ms * 1000000)));
  }
  /** Figures for the interval since the last drain, then a fresh interval. Event-loop delay is
   * owned by the admission sampler, which resets it every second, so it is read, never reset. */
  drain() {
    const figures = {
      commands: Number(this.commands.count),
      p95CommandMs: this.commands.percentile(95) / 1000000,
      p99CommandMs: this.commands.percentile(99) / 1000000,
      p95OutboxDispatchMs: this.outboxWait.percentile(95) / 1000000,
      eventLoopP99Ms: this.loop.percentile(99) / 1000000,
      rssBytes: process.memoryUsage().rss,
      projections: this.projections,
      refusals: this.refused,
    };
    this.commands.reset();
    this.outboxWait.reset();
    this.projections = 0;
    this.refused = 0;
    return figures;
  }
  close() {
    this.loop.disable();
  }
}
