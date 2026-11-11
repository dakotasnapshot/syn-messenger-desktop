/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import { MatrixEvent, Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter } from "../../test-utils";
import {
    defaultSchedule,
    isValidSchedule,
    readSchedule,
    roomScheduleMutes,
    saveSchedule,
    scheduleMutes,
    SCHEDULE_EVENT_TYPE,
    type NotificationSchedule,
} from "../../../src/utils/SyndicateNotificationSchedule";

const schedule: NotificationSchedule = {
    ...defaultSchedule(),
    enabled: true,
    days: [1],
    start_minute: 540,
    end_minute: 1020,
    timezone: "Europe/Paris",
};
describe("universal Syndicate schedules", () => {
    it.each([
        ["2026-11-09T07:59:00Z", true],
        ["2026-11-09T08:00:00Z", false],
        ["2026-11-09T15:59:00Z", false],
        ["2026-11-09T16:00:00Z", true],
        ["2026-11-10T10:00:00Z", true],
    ])("evaluates delivery time %s including resume after sleep", (instant, muted) => {
        expect(scheduleMutes(schedule, new Date(instant as string))).toBe(muted);
    });
    it("anchors overnight Sunday windows to Sunday across the week boundary", () => {
        const overnight = { ...schedule, days: [7], start_minute: 1320, end_minute: 120 };
        expect(scheduleMutes(overnight, new Date("2026-11-08T22:00Z"))).toBe(false);
        expect(scheduleMutes(overnight, new Date("2026-11-09T00:59Z"))).toBe(false);
        expect(scheduleMutes(overnight, new Date("2026-11-09T01:00Z"))).toBe(true);
    });
    it("handles repeated and skipped DST hours in the chosen timezone", () => {
        const dst = { ...schedule, days: [7], start_minute: 90, end_minute: 150, timezone: "America/New_York" };
        for (const time of ["2026-11-01T05:45Z", "2026-11-01T06:45Z", "2026-03-08T06:45Z"]) {
            expect(scheduleMutes(dst, new Date(time))).toBe(false);
        }
        for (const time of ["2026-11-01T06:15Z", "2026-03-08T07:00Z"]) {
            expect(scheduleMutes(dst, new Date(time))).toBe(true);
        }
    });
    it("respects explicit overrides without forcing underlying normal notifications", () => {
        expect(scheduleMutes({ ...schedule, override: "mute" }, new Date("2026-11-09T10:00Z"))).toBe(true);
        expect(scheduleMutes({ ...schedule, override: "normal" }, new Date("2026-11-10T10:00Z"))).toBe(false);
        expect(scheduleMutes({ ...schedule, enabled: false })).toBe(false);
    });
    it.each([
        { ...schedule, timezone: "Moon/Base" },
        { ...schedule, days: [1, 1] },
        { ...schedule, days: [8] },
        { ...schedule, days: [] },
        { ...schedule, start_minute: -1 },
        { ...schedule, end_minute: 1440 },
        { ...schedule, version: 99 },
        { ...schedule, enabled: "yes" },
    ])("ignores malformed and unsupported settings", (value) => {
        expect(isValidSchedule(value)).toBe(false);
        expect(scheduleMutes(value as NotificationSchedule)).toBe(false);
    });
});

describe("schedule sync", () => {
    const roomId = "!synthetic:example.org";
    const makeClient = () => {
        const client = getMockClientWithEventEmitter({ getRoom: jest.fn(), setRoomAccountData: jest.fn() });
        const room = new Room(roomId, client, "@synthetic:example.org");
        client.getRoom.mockReturnValue(room);
        client.setRoomAccountData.mockResolvedValue({});
        const sync = (content: NotificationSchedule) => {
            const event = new MatrixEvent({ type: SCHEDULE_EVENT_TYPE, content });
            room.addAccountData([event]);
            client.emit(RoomEvent.AccountData, event, room);
        };
        return { client, room, sync };
    };
    it("saves via standard account data and applies successful writes immediately", async () => {
        const { client } = makeClient();
        const value = { ...schedule, override: "mute" as const };
        await saveSchedule(client, roomId, value);
        expect(client.setRoomAccountData).toHaveBeenCalledWith(roomId, SCHEDULE_EVENT_TYPE, value);
        expect(readSchedule(client, roomId)).toEqual(value);
        expect(roomScheduleMutes(client, roomId)).toBe(false);
    });
    it("honours remote sync without writing back or leaking between accounts", async () => {
        const a = makeClient(),
            b = makeClient();
        await saveSchedule(a.client, roomId, { ...schedule, override: "mute" });
        a.sync({ ...schedule, override: "normal" });
        expect(roomScheduleMutes(a.client, roomId)).toBe(false);
        expect(readSchedule(b.client, roomId)).toBeUndefined();
        expect(a.client.setRoomAccountData).toHaveBeenCalledTimes(1);
        expect(b.client.setRoomAccountData).not.toHaveBeenCalled();
    });
    it("does not let a delayed response overwrite newer sync", async () => {
        const { client, sync } = makeClient();
        let finish!: () => void;
        client.setRoomAccountData.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = () => resolve({});
                }),
        );
        const pending = saveSchedule(client, roomId, { ...schedule, override: "mute" });
        sync({ ...schedule, override: "normal" });
        finish();
        await pending;
        expect(roomScheduleMutes(client, roomId)).toBe(false);
    });
    it("does not apply failed writes locally", async () => {
        const { client } = makeClient();
        client.setRoomAccountData.mockRejectedValue(new Error("offline"));
        await expect(saveSchedule(client, roomId, schedule)).rejects.toThrow("offline");
        expect(readSchedule(client, roomId)).toBeUndefined();
    });
});
