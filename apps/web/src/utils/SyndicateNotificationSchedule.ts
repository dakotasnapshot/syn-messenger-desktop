/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import { type MatrixClient, type MatrixEvent, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";

export const SCHEDULE_EVENT_TYPE = "app.syn.notification_schedule";
export type ScheduleOverride = "schedule" | "mute" | "normal";
export interface NotificationSchedule {
    version: 1;
    enabled: boolean;
    days: number[];
    start_minute: number;
    end_minute: number;
    timezone: string;
    override?: ScheduleOverride;
    enforcement?: "local" | "matrix";
}

declare module "matrix-js-sdk/src/types" {
    interface RoomAccountDataEvents {
        [SCHEDULE_EVENT_TYPE]: NotificationSchedule;
    }
}

export function defaultSchedule(): NotificationSchedule {
    return {
        version: 1,
        enforcement: "matrix",
        enabled: false,
        days: [1, 2, 3, 4, 5],
        start_minute: 540,
        end_minute: 1020,
        timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
        override: "schedule",
    };
}

export function isValidSchedule(value: unknown): value is NotificationSchedule {
    if (!value || typeof value !== "object") return false;
    const s = value as NotificationSchedule;
    if (
        s.version !== 1 ||
        (s.enforcement !== undefined && !["local", "matrix"].includes(s.enforcement)) ||
        typeof s.enabled !== "boolean" ||
        !Array.isArray(s.days) ||
        s.days.length > 7 ||
        !s.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) ||
        new Set(s.days).size !== s.days.length ||
        (s.enabled && !s.days.length) ||
        !Number.isInteger(s.start_minute) ||
        s.start_minute < 0 ||
        s.start_minute >= 1440 ||
        !Number.isInteger(s.end_minute) ||
        s.end_minute < 0 ||
        s.end_minute >= 1440 ||
        s.start_minute === s.end_minute ||
        typeof s.timezone !== "string" ||
        (s.override !== undefined && !["schedule", "mute", "normal"].includes(s.override))
    )
        return false;
    try {
        new Intl.DateTimeFormat("en", { timeZone: s.timezone }).format();
        return true;
    } catch {
        return false;
    }
}

/** Evaluate at notification delivery, including after sleep; never rely on a boundary timer. */
export function scheduleMutes(s: NotificationSchedule | undefined, now = new Date()): boolean {
    if (!isValidSchedule(s)) return false;
    if (s.override === "mute") return true;
    if (s.override === "normal" || !s.enabled) return false;
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: s.timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)!.value;
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(part("weekday")) + 1;
    const minute = Number(part("hour")) * 60 + Number(part("minute"));
    if (s.start_minute < s.end_minute) {
        return !(s.days.includes(day) && minute >= s.start_minute && minute < s.end_minute);
    }
    const previousDay = day === 1 ? 7 : day - 1;
    return !(
        (s.days.includes(day) && minute >= s.start_minute) ||
        (s.days.includes(previousDay) && minute < s.end_minute)
    );
}

interface ClientState {
    pending: Map<string, NotificationSchedule>;
    generations: Map<string, number>;
}
const clients = new WeakMap<MatrixClient, ClientState>();

function stateFor(client: MatrixClient): ClientState {
    let state = clients.get(client);
    if (!state) {
        state = { pending: new Map(), generations: new Map() };
        clients.set(client, state);
        const owned = state;
        client.on(RoomEvent.AccountData, (event: MatrixEvent, room: Room) => {
            if (event.getType() !== SCHEDULE_EVENT_TYPE) return;
            owned.pending.delete(room.roomId);
            owned.generations.set(room.roomId, (owned.generations.get(room.roomId) ?? 0) + 1);
        });
    }
    return state;
}

export function readSchedule(client: MatrixClient, roomId: string): NotificationSchedule | undefined {
    const content =
        stateFor(client).pending.get(roomId) ??
        client.getRoom(roomId)?.getAccountData(SCHEDULE_EVENT_TYPE)?.getContent();
    return isValidSchedule(content) ? content : undefined;
}

export async function saveSchedule(
    client: MatrixClient,
    roomId: string,
    schedule: NotificationSchedule,
): Promise<void> {
    if (!isValidSchedule(schedule)) throw new Error("Invalid notification schedule");
    const state = stateFor(client);
    const generation = (state.generations.get(roomId) ?? 0) + 1;
    state.generations.set(roomId, generation);
    const snapshot = { ...schedule, days: [...schedule.days] };
    await client.setRoomAccountData(roomId, SCHEDULE_EVENT_TYPE, snapshot);
    // Apply acknowledged writes immediately, but never overwrite newer sync or a newer edit.
    if (state.generations.get(roomId) === generation) state.pending.set(roomId, snapshot);
}

export function roomScheduleMutes(client: MatrixClient, roomId: string): boolean {
    return scheduleMutes(readSchedule(client, roomId));
}
