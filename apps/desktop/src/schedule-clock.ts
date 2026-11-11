/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
interface ScheduleTarget {
    isDestroyed(): boolean;
    send(channel: string): void;
}
/** Main-process clock: minimized renderer timer throttling cannot delay a boundary. */
export class RoomScheduleClock {
    private readonly targets = new Set<ScheduleTarget>();
    private timer?: ReturnType<typeof setTimeout>;
    public isActive(target: ScheduleTarget): boolean {
        return this.targets.has(target);
    }
    public setActive(target: ScheduleTarget, active: boolean): void {
        if (active) this.targets.add(target);
        else this.targets.delete(target);
        if (!this.targets.size) {
            clearTimeout(this.timer);
            this.timer = undefined;
        } else if (!this.timer) this.arm();
    }
    public wake(): void {
        for (const target of this.targets) {
            if (target.isDestroyed()) this.targets.delete(target);
            else target.send("notification_schedule_tick");
        }
        this.arm();
    }
    private arm(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        if (this.targets.size) this.timer = setTimeout(() => this.wake(), 60_000 - (Date.now() % 60_000) + 10);
    }
    public stop(): void {
        this.targets.clear();
        clearTimeout(this.timer);
        this.timer = undefined;
    }
}
export const roomScheduleClock = new RoomScheduleClock();
