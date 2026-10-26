import { setTimeout as sleep } from "node:timers/promises";

export function delay(ms: number): Promise<void> {
  return sleep(ms);
}
