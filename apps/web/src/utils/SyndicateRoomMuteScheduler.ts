/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import { ClientEvent, EventType, RoomEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { getRoomNotifsState, setRoomNotifsState, RoomNotifState } from "../RoomNotifs";
import { readSchedule, scheduleMutes, SCHEDULE_EVENT_TYPE } from "./SyndicateNotificationSchedule";

// Drive the ordinary room mute used by every visible notification control.
export type EnforcementStatus = "waiting" | "muted" | "normal" | "error";

export class RoomMuteScheduleController {
    private active = false;
    private activitySent?: boolean;
    private unsubscribeNativeTick?: () => void;
    private dirty = false;
    private running?: Promise<void>;
    private timer?: ReturnType<typeof setTimeout>;
    private readonly statuses = new Map<string, EnforcementStatus>();
    private readonly listeners = new Set<() => void>();

    public constructor(private readonly client: MatrixClient) {}
    public status(roomId: string): EnforcementStatus {
        return this.statuses.get(roomId) ?? "waiting";
    }
    public subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    private report(roomId: string, status: EnforcementStatus): void {
        if (this.statuses.get(roomId) === status) return;
        this.statuses.set(roomId, status);
        for (const listener of this.listeners) listener();
    }
    private onRoomData = (event: MatrixEvent): void => {
        if (event.getType() === SCHEDULE_EVENT_TYPE) void this.reconcile();
    };
    private onAccountData = (event: MatrixEvent): void => {
        if (event.getType() !== EventType.PushRules) return;
        void this.reconcile();
    };
    private wake = (): void => {
        void this.reconcile();
    };
    private sync = (): void => {
        void this.reconcile();
    };
    private arm(): void {
        if (!this.active) return;
        clearTimeout(this.timer);
        // Wall-clock alignment, not elapsed-time arithmetic. A delayed timer after
        // sleep evaluates the current policy, never replays missed toggles.
        this.timer = setTimeout(
            () => {
                void this.reconcile();
                this.arm();
            },
            60_000 - (Date.now() % 60_000) + 10,
        );
    }
    public start(): void {
        if (this.active) return;
        this.active = true;
        if (typeof window !== "undefined") this.unsubscribeNativeTick = window.electron?.onScheduleTick?.(this.wake);
        this.client.on(RoomEvent.AccountData, this.onRoomData);
        this.client.on(ClientEvent.AccountData, this.onAccountData);
        this.client.on(ClientEvent.Sync, this.sync);
        if (typeof window !== "undefined") {
            window.addEventListener("focus", this.wake);
            window.addEventListener("online", this.wake);
            document.addEventListener("visibilitychange", this.wake);
        }
        this.arm();
        this.wake();
    }
    private publishActivity(active: boolean): void {
        if (this.activitySent === active) return;
        this.activitySent = active;
        if (typeof window !== "undefined")
            window.electron?.send("app_onAction", { action: "notification_schedule_activity", active });
    }
    public stop(): void {
        this.active = false;
        this.publishActivity(false);
        this.unsubscribeNativeTick?.();
        this.unsubscribeNativeTick = undefined;
        clearTimeout(this.timer);
        this.client.off(RoomEvent.AccountData, this.onRoomData);
        this.client.off(ClientEvent.AccountData, this.onAccountData);
        this.client.off(ClientEvent.Sync, this.sync);
        if (typeof window !== "undefined") {
            window.removeEventListener("focus", this.wake);
            window.removeEventListener("online", this.wake);
            document.removeEventListener("visibilitychange", this.wake);
        }
    }
    public reconcile(): Promise<void> {
        if (!this.active) return Promise.resolve();
        this.dirty = true;
        if (!this.running) {
            this.running = this.drain().finally(() => {
                this.running = undefined;
            });
        }
        return this.running;
    }
    private async drain(): Promise<void> {
        while (this.active && this.dirty) {
            this.dirty = false;
            if (!this.client.pushRules?.global?.override) continue;
            const rooms = this.client.getRooms().filter((room) => {
                const policy = readSchedule(this.client, room.roomId);
                return (
                    policy?.enforcement === "matrix" &&
                    (policy.enabled || (policy.override ?? "schedule") !== "schedule")
                );
            });
            this.publishActivity(rooms.length > 0);
            if (!rooms.length) continue;
            try {
                // SDK refreshes its push-rule cache here, just as the room controls
                // do. Never decide to unmute from an unhydrated/stale cache.
                await this.client.getPushRules();
            } catch {
                for (const room of rooms) this.report(room.roomId, "error");
                continue;
            }
            for (const room of rooms) {
                if (!this.active) return;
                const policy = readSchedule(this.client, room.roomId);
                if (policy?.enforcement !== "matrix") continue;
                try {
                    const desired = scheduleMutes(policy);
                    if ((getRoomNotifsState(this.client, room.roomId) === RoomNotifState.Mute) !== desired) {
                        await setRoomNotifsState(
                            this.client,
                            room.roomId,
                            desired ? RoomNotifState.Mute : RoomNotifState.AllMessages,
                            "schedule",
                        );
                        await this.client.getPushRules();
                    }
                    // A manual operation may have entered the same shared queue.
                    const latest = readSchedule(this.client, room.roomId);
                    const expected = scheduleMutes(latest);
                    if ((getRoomNotifsState(this.client, room.roomId) === RoomNotifState.Mute) !== expected)
                        throw new Error("Matrix did not confirm the room mute state");
                    this.report(room.roomId, expected ? "muted" : "normal");
                } catch {
                    this.report(room.roomId, "error");
                }
            }
        }
    }
}

const controllers = new WeakMap<MatrixClient, RoomMuteScheduleController>();
export function roomMuteScheduler(client: MatrixClient): RoomMuteScheduleController {
    let controller = controllers.get(client);
    if (!controller) {
        controller = new RoomMuteScheduleController(client);
        controllers.set(client, controller);
    }
    return controller;
}
