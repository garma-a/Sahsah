import { single } from "./invariant.js";
import { GameplayProblem } from "./problem.js";
type Lane = "protected" | "public" | "background";
interface Waiting {
  lane: Lane;
  run: () => void;
  fail: () => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Bounded work before reaching pg's pool. Active games own the reserved share. */
export class GameplayScheduler {
  private running = 0;
  private ordinary = 0;
  private queue: Waiting[] = [];
  readonly max: number;
  constructor(poolSize = Number(process.env.DATABASE_POOL_MAX ?? 5)) {
    this.max = Math.max(2, poolSize - 1);
  }
  private available(lane: Lane) {
    return (
      this.running < this.max &&
      (lane === "protected" || this.ordinary < Math.max(1, this.max - 2))
    );
  }
  async run<T>(lane: Lane, work: () => Promise<T>): Promise<T> {
    if (!this.available(lane)) {
      if (
        lane === "background" ||
        this.queue.length >= (lane === "protected" ? 128 : 16)
      )
        throw new GameplayProblem(503, "WORK_BUDGET_EXHAUSTED");
      await new Promise<void>((resolve, reject) => {
        const waiting: Waiting = {
          lane,
          run: resolve,
          fail: () => reject(new GameplayProblem(503, "WORK_BUDGET_EXHAUSTED")),
          timer: setTimeout(() => {
            const i = this.queue.indexOf(waiting);
            if (i >= 0) {
              this.queue.splice(i, 1);
              waiting.fail();
            }
          }, 1500),
        };
        waiting.timer.unref();
        this.queue.push(waiting);
      });
    } else {
      this.running++;
      if (lane !== "protected") this.ordinary++;
    }
    try {
      return await work();
    } finally {
      this.running--;
      if (lane !== "protected") this.ordinary--;
      const priorities: ("protected" | "public")[] = ["protected", "public"];
      for (const priority of priorities) {
        const i = this.queue.findIndex((w) => w.lane === priority);
        if (i >= 0 && this.available(priority)) {
          const w = single(this.queue.splice(i, 1), "SCHEDULER_QUEUED_WORK");
          clearTimeout(w.timer);
          this.running++;
          if (priority !== "protected") this.ordinary++;
          w.run();
        }
      }
    }
  }
  stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maximum: this.max,
    };
  }
}
