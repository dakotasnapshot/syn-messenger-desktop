/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import {
    ClientEvent,
    ConditionKind,
    PushRuleActionName,
    EventType,
    RoomEvent,
    PushRuleKind,
    type MatrixClient,
    type MatrixEvent,
} from "matrix-js-sdk/src/matrix";
import { readSchedule, roomScheduleMutes, SCHEDULE_EVENT_TYPE } from "./SyndicateNotificationSchedule";

// Same standard Matrix override used by room mute, but separately owned: never
// delete or rewrite a manual mute, room notification mode, or another app's rule.
export const SCHEDULE_MUTE_PREFIX = "app.syn.schedule.mute.v1.";
export const scheduleMuteRuleId = (roomId: string): string => SCHEDULE_MUTE_PREFIX + encodeURIComponent(roomId);
export type EnforcementStatus = "waiting" | "muted" | "normal" | "error";

export class RoomMuteScheduleController {
    private active = false;
    private hasServerBaseline = false;
    private dirty = false;
    private running?: Promise<void>;
    private timer?: ReturnType<typeof setTimeout>;
    private readonly acknowledged = new Map<string, boolean>();
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
        this.acknowledged.clear();
        void this.reconcile();
    };
    private wake = (): void => {
        this.hasServerBaseline = false;
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
    public stop(): void {
        this.active = false;
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
            // No speculative unmuting before the authenticated push-rule cache is ready.
            let rules = this.client.pushRules?.global?.override;
            if (!rules) continue;
            const knownRooms = this.client.getRooms();
            const scheduledRooms = knownRooms.filter(
                (room) => readSchedule(this.client, room.roomId)?.enforcement === "matrix",
            );
            if (!scheduledRooms.length && !rules.some((rule) => rule.rule_id.startsWith(SCHEDULE_MUTE_PREFIX)))
                continue;
            if (!this.hasServerBaseline) {
                try {
                    const confirmed = (await this.client.getPushRules()).global?.override;
                    if (!confirmed) throw new Error("Matrix push rules are not ready");
                    rules = confirmed;
                    this.hasServerBaseline = true;
                } catch {
                    for (const room of scheduledRooms) this.report(room.roomId, "error");
                    continue;
                }
            }
            const rooms = new Set(knownRooms.map((room) => room.roomId));
            for (const rule of rules) {
                if (!rule.rule_id.startsWith(SCHEDULE_MUTE_PREFIX)) continue;
                try {
                    rooms.add(decodeURIComponent(rule.rule_id.slice(SCHEDULE_MUTE_PREFIX.length)));
                } catch {
                    /* Not ours to alter. */
                }
            }
            for (const roomId of rooms) {
                if (!this.active) return;
                const policy = readSchedule(this.client, roomId);
                const desired = policy?.enforcement === "matrix" && roomScheduleMutes(this.client, roomId);
                const id = scheduleMuteRuleId(roomId);
                const rule = rules.find((value) => value.rule_id === id);
                const exists = this.acknowledged.get(id) ?? !!rule;
                if (!policy) {
                    // A room/policy may not have hydrated yet. An unknown setting
                    // is never permission to remove an existing server-side mute.
                    if (exists) this.report(roomId, "waiting");
                    continue;
                }
                const valid =
                    !!rule?.enabled &&
                    rule.actions.length === 1 &&
                    rule.actions[0] === PushRuleActionName.DontNotify &&
                    rule.conditions?.length === 1 &&
                    rule.conditions[0].kind === ConditionKind.EventMatch &&
                    rule.conditions[0].key === "room_id" &&
                    rule.conditions[0].pattern === roomId;
                try {
                    if (desired && (!exists || (!this.acknowledged.has(id) && !valid))) {
                        await this.client.addPushRule("global", PushRuleKind.Override, id, {
                            conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId }],
                            actions: [PushRuleActionName.DontNotify],
                        });
                        await this.client.setPushRuleEnabled("global", PushRuleKind.Override, id, true);
                        const confirmed = (await this.client.getPushRules()).global?.override?.find(
                            (value) => value.rule_id === id,
                        );
                        if (
                            !confirmed?.enabled ||
                            confirmed.actions.length !== 1 ||
                            confirmed.actions[0] !== PushRuleActionName.DontNotify ||
                            confirmed.conditions?.length !== 1 ||
                            confirmed.conditions[0].kind !== ConditionKind.EventMatch ||
                            confirmed.conditions[0].key !== "room_id" ||
                            confirmed.conditions[0].pattern !== roomId
                        ) {
                            throw new Error("Matrix did not confirm the scheduler mute");
                        }
                        this.acknowledged.set(id, true);
                    } else if (!desired && exists) {
                        try {
                            await this.client.deletePushRule("global", PushRuleKind.Override, id);
                        } catch (error) {
                            if ((error as { errcode?: string }).errcode !== "M_NOT_FOUND") throw error;
                        }
                        const confirmed = (await this.client.getPushRules()).global?.override;
                        if (!confirmed || confirmed.some((value) => value.rule_id === id)) {
                            throw new Error("Matrix did not confirm scheduler mute removal");
                        }
                        this.acknowledged.set(id, false);
                    }
                    if (policy?.enforcement === "matrix" || exists) this.report(roomId, desired ? "muted" : "normal");
                } catch {
                    // Retain the rule/state after failure; retry on sync/wake/minute.
                    this.report(roomId, "error");
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
