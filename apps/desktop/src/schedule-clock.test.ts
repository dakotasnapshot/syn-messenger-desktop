/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomScheduleClock } from "./schedule-clock";
let clock: RoomScheduleClock;
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T18:59:59Z"));
    clock = new RoomScheduleClock();
});
afterEach(() => {
    clock.stop();
    vi.useRealTimers();
});
const target = () => ({ isDestroyed: vi.fn(() => false), send: vi.fn() });
describe("native room-schedule clock", () => {
    it("ticks at the exact minute independently of renderer timers", () => {
        const t = target();
        clock.setActive(t, true);
        vi.advanceTimersByTime(1010);
        expect(t.send).toHaveBeenCalledExactlyOnceWith("notification_schedule_tick");
    });
    it("does not tick unrelated or disabled windows", () => {
        const a = target(),
            b = target();
        clock.setActive(a, true);
        clock.setActive(b, false);
        vi.advanceTimersByTime(1010);
        expect(a.send).toHaveBeenCalledTimes(1);
        expect(b.send).not.toHaveBeenCalled();
        clock.setActive(a, false);
        vi.advanceTimersByTime(120000);
        expect(a.send).toHaveBeenCalledTimes(1);
    });
    it("wakes immediately after sleep and re-aligns to the new wall clock", () => {
        const t = target();
        clock.setActive(t, true);
        vi.setSystemTime(new Date("2026-11-14T10:59:59Z"));
        clock.wake();
        expect(t.send).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1010);
        expect(t.send).toHaveBeenCalledTimes(2);
    });
    it("drops destroyed renderer targets", () => {
        const t = target();
        clock.setActive(t, true);
        t.isDestroyed.mockReturnValue(true);
        vi.advanceTimersByTime(1010);
        expect(t.send).not.toHaveBeenCalled();
        expect(clock.isActive(t)).toBe(false);
    });
    it("stops without changing any window visibility or sleep preferences", () => {
        const t = target();
        clock.setActive(t, true);
        clock.stop();
        vi.advanceTimersByTime(120000);
        expect(t.send).not.toHaveBeenCalled();
        expect(clock.isActive(t)).toBe(false);
    });
});
