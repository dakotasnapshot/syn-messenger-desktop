/* Copyright 2026 Syndicate contributors. SPDX-License-Identifier: AGPL-3.0-only */
import {
    ConditionKind,
    MatrixEvent,
    Room,
    RoomEvent,
    PushRuleActionName,
    PushRuleKind,
    type IPushRule,
} from "matrix-js-sdk/src/matrix";
import { getRoomNotifsState, RoomNotifState, setRoomNotifsState } from "../../../src/RoomNotifs";
import { getMockClientWithEventEmitter } from "../../test-utils";
import {
    defaultSchedule,
    readSchedule,
    roomScheduleMutes,
    SCHEDULE_EVENT_TYPE,
    type NotificationSchedule,
} from "../../../src/utils/SyndicateNotificationSchedule";
import { RoomMuteScheduleController } from "../../../src/utils/SyndicateRoomMuteScheduler";
const id = "!shared:example.org";
const policy: NotificationSchedule = {
    ...defaultSchedule(),
    enabled: true,
    days: [1, 2, 3, 6, 7],
    start_minute: 300,
    end_minute: 780,
    timezone: "America/Chicago",
};
const controllers: RoomMuteScheduleController[] = [];
function setup(value = policy, muted = false) {
    const client = getMockClientWithEventEmitter({
        getRooms: jest.fn(),
        getRoom: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        getRoomPushRule: jest.fn(),
        getPushRules: jest.fn(),
        addPushRule: jest.fn(),
        deletePushRule: jest.fn(),
        setRoomAccountData: jest.fn(),
    });
    const room = new Room(id, client, "@synthetic:example.org");
    const sync = (p: NotificationSchedule) => {
        const event = new MatrixEvent({ type: SCHEDULE_EVENT_TYPE, content: p });
        room.addAccountData([event]);
        client.emit(RoomEvent.AccountData, event, room);
    };
    sync(value);
    client.getRoom.mockReturnValue(room);
    client.getRooms.mockReturnValue([room]);
    const rules = {
        global: { override: [] as IPushRule[], room: [] as IPushRule[], content: [], sender: [], underride: [] },
    };
    if (muted)
        rules.global.override.push({
            rule_id: id,
            enabled: true,
            default: false,
            conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: id }],
            actions: [PushRuleActionName.DontNotify],
        });
    client.pushRules = JSON.parse(JSON.stringify(rules));
    client.getPushRules.mockImplementation(async () => {
        client.pushRules = JSON.parse(JSON.stringify(rules));
        return client.pushRules!;
    });
    client.getRoomPushRule.mockImplementation((_scope, roomId) =>
        client.pushRules?.global?.room?.find((r) => r.rule_id === roomId),
    );
    client.setRoomAccountData.mockImplementation(async (_room, _type, content) => {
        sync(content as NotificationSchedule);
        return {};
    });
    client.addPushRule.mockImplementation(async (_scope, kind, ruleId, body) => {
        const list = kind === PushRuleKind.Override ? rules.global.override : rules.global.room;
        const old = list.findIndex((r) => r.rule_id === ruleId);
        if (old >= 0) list.splice(old, 1);
        list.push({ ...body, rule_id: ruleId, enabled: true, default: false });
        return {};
    });
    client.deletePushRule.mockImplementation(async (_scope, kind, ruleId) => {
        const list = kind === PushRuleKind.Override ? rules.global.override : rules.global.room;
        const old = list.findIndex((r) => r.rule_id === ruleId);
        if (old >= 0) list.splice(old, 1);
        return {};
    });
    const controller = new RoomMuteScheduleController(client);
    controllers.push(controller);
    return { client, controller, rules, sync };
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-11T20:00:00Z"));
});
afterEach(() => {
    for (const c of controllers.splice(0)) c.stop();
    jest.useRealTimers();
});
describe("One shared room mute", () => {
    it("uses the ordinary room-id mute rule and visible room state", async () => {
        const { client, controller, rules } = setup();
        controller.start();
        await controller.reconcile();
        expect(rules.global.override.map((r) => r.rule_id)).toEqual([id]);
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.Mute);
        expect(controller.status(id)).toBe("muted");
    });
    it("toggles that same mute at exactly 13:00 without messages", async () => {
        jest.setSystemTime(new Date("2026-11-11T18:59:59Z"));
        const { client, controller } = setup();
        controller.start();
        await controller.reconcile();
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.AllMessages);
        await jest.advanceTimersByTimeAsync(1020);
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.Mute);
    });
    it("opens the same existing room mute at 05:00, not a separate hidden rule", async () => {
        jest.setSystemTime(new Date("2026-11-14T10:59:59Z"));
        const { client, controller, rules } = setup(policy, true);
        controller.start();
        await controller.reconcile();
        await jest.advanceTimersByTimeAsync(1020);
        expect(rules.global.override).toEqual([]);
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.AllMessages);
    });
    it("manual unmute overrides quiet hours and survives subsequent timer reconciliations", async () => {
        const { client, controller, rules } = setup();
        controller.start();
        await controller.reconcile();
        await setRoomNotifsState(client, id, RoomNotifState.AllMessages);
        await controller.reconcile();
        expect(readSchedule(client, id)?.override).toBe("normal");
        await jest.advanceTimersByTimeAsync(120000);
        expect(rules.global.override).toEqual([]);
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.AllMessages);
        expect(roomScheduleMutes(client, id)).toBe(false);
    });
    it("manual mute overrides allowed hours through the same standard rule", async () => {
        jest.setSystemTime(new Date("2026-11-11T16:00:00Z"));
        const { client, controller, rules } = setup();
        controller.start();
        await controller.reconcile();
        await setRoomNotifsState(client, id, RoomNotifState.Mute);
        await controller.reconcile();
        expect(readSchedule(client, id)?.override).toBe("mute");
        expect(rules.global.override.map((r) => r.rule_id)).toEqual([id]);
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.Mute);
    });
    it("resuming the existing schedule replaces a manual override", async () => {
        const { client, controller, sync } = setup({ ...policy, override: "normal" });
        controller.start();
        await controller.reconcile();
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.AllMessages);
        sync({ ...policy, override: "schedule" });
        await controller.reconcile();
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.Mute);
    });
    it("serializes a manual click behind a delayed scheduled write so the click wins", async () => {
        const { client, controller, rules } = setup();
        const add = client.addPushRule.getMockImplementation()!;
        let release!: () => void;
        let entered!: () => void;
        const started = new Promise<void>((r) => {
            entered = r;
        });
        const held = new Promise<void>((r) => {
            release = r;
        });
        client.addPushRule.mockImplementationOnce(async (...args) => {
            entered();
            await held;
            return add(...args);
        });
        controller.start();
        await started;
        const manual = setRoomNotifsState(client, id, RoomNotifState.AllMessages);
        release();
        await manual;
        await controller.reconcile();
        expect(rules.global.override).toEqual([]);
        expect(readSchedule(client, id)?.override).toBe("normal");
    });
    it("reports server failure without speculatively clearing a room mute", async () => {
        jest.setSystemTime(new Date("2026-11-11T16:00:00Z"));
        const { client, controller, rules } = setup(policy, true);
        client.getPushRules.mockRejectedValue(new Error("offline"));
        controller.start();
        await controller.reconcile();
        expect(controller.status(id)).toBe("error");
        expect(rules.global.override.map((r) => r.rule_id)).toEqual([id]);
    });
    it("does not silently migrate legacy schedules", async () => {
        const { client, controller } = setup({ ...policy, enforcement: undefined });
        controller.start();
        await controller.reconcile();
        expect(client.addPushRule).not.toHaveBeenCalled();
        expect(client.deletePushRule).not.toHaveBeenCalled();
    });
    it("disabling a schedule leaves the single current mute state alone", async () => {
        const { client, controller } = setup({ ...policy, enabled: false }, true);
        controller.start();
        await controller.reconcile();
        expect(client.deletePushRule).not.toHaveBeenCalled();
        expect(getRoomNotifsState(client, id)).toBe(RoomNotifState.Mute);
    });
});
