/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import {
    MatrixEvent,
    Room,
    RoomEvent,
    ConditionKind,
    PushRuleActionName,
    type IPushRule,
} from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter } from "../../test-utils";
import {
    defaultSchedule,
    SCHEDULE_EVENT_TYPE,
    type NotificationSchedule,
} from "../../../src/utils/SyndicateNotificationSchedule";
import { RoomMuteScheduleController, scheduleMuteRuleId } from "../../../src/utils/SyndicateRoomMuteScheduler";

const roomId = "!schedule:example.org";
const policy: NotificationSchedule = {
    ...defaultSchedule(),
    enabled: true,
    days: [1, 2, 3, 6, 7],
    start_minute: 300,
    end_minute: 780,
    timezone: "America/Chicago",
};
const controllers: RoomMuteScheduleController[] = [];
function setup(value: NotificationSchedule = policy, overrides: IPushRule[] = []) {
    const client = getMockClientWithEventEmitter({
        getRooms: jest.fn(),
        getRoom: jest.fn(),
        addPushRule: jest.fn(),
        deletePushRule: jest.fn(),
        getPushRules: jest.fn(),
        setPushRuleEnabled: jest.fn(),
    });
    const room = new Room(roomId, client, "@synthetic:example.org");
    room.addAccountData([new MatrixEvent({ type: SCHEDULE_EVENT_TYPE, content: value })]);
    client.getRoom.mockReturnValue(room);
    client.getRooms.mockReturnValue([room]);
    client.pushRules = {
        global: {
            override: overrides,
            room: [{ rule_id: roomId, enabled: true, default: false, actions: [PushRuleActionName.DontNotify] }],
            content: [],
            sender: [],
            underride: [],
        },
    };
    const remote = JSON.parse(JSON.stringify(client.pushRules));
    client.getPushRules.mockImplementation(async () => remote);
    client.setPushRuleEnabled.mockResolvedValue({});
    client.addPushRule.mockImplementation(async (_scope, _kind, id, rule) => {
        remote.global.override = remote.global.override.filter((item: IPushRule) => item.rule_id !== id);
        remote.global.override.push({ ...rule, rule_id: id, enabled: true, default: false });
        return {};
    });
    client.deletePushRule.mockImplementation(async (_scope, _kind, id) => {
        remote.global.override = remote.global.override.filter((item: IPushRule) => item.rule_id !== id);
        return {};
    });
    const controller = new RoomMuteScheduleController(client);
    controllers.push(controller);
    const sync = (next: NotificationSchedule) => {
        const event = new MatrixEvent({ type: SCHEDULE_EVENT_TYPE, content: next });
        room.addAccountData([event]);
        client.emit(RoomEvent.AccountData, event, room);
    };
    return { client, room, controller, sync };
}
const owned = (): IPushRule => ({
    rule_id: scheduleMuteRuleId(roomId),
    enabled: true,
    default: false,
    conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId }],
    actions: [PushRuleActionName.DontNotify],
});
beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-11T20:00:00Z"));
});
afterEach(() => {
    for (const c of controllers.splice(0)) c.stop();
    jest.useRealTimers();
});

describe("Matrix-backed room mute schedules", () => {
    it("creates a standard DontNotify override after the exact 1pm cutoff", async () => {
        const { client, controller } = setup();
        controller.start();
        await controller.reconcile();
        expect(client.addPushRule).toHaveBeenCalledWith("global", "override", scheduleMuteRuleId(roomId), {
            conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId }],
            actions: [PushRuleActionName.DontNotify],
        });
        expect(controller.status(roomId)).toBe("muted");
        await controller.reconcile();
        expect(client.addPushRule).toHaveBeenCalledTimes(1);
    });
    it("transitions at 13:00 without a message or foreground interaction", async () => {
        jest.setSystemTime(new Date("2026-11-11T18:59:59Z"));
        const { client, controller } = setup();
        controller.start();
        await controller.reconcile();
        expect(client.addPushRule).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1020);
        expect(client.addPushRule).toHaveBeenCalledTimes(1);
    });
    it("preserves manual mute and the exact prior room rule when the window resumes", async () => {
        jest.setSystemTime(new Date("2026-11-11T11:00:00Z"));
        const manual = { ...owned(), rule_id: roomId };
        const { client, controller } = setup(policy, [owned(), manual]);
        const before = JSON.stringify(client.pushRules);
        controller.start();
        await controller.reconcile();
        expect(client.deletePushRule).toHaveBeenCalledWith("global", "override", scheduleMuteRuleId(roomId));
        expect(client.deletePushRule).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(client.pushRules)).toBe(before);
        expect(client.addPushRule).not.toHaveBeenCalled();
    });
    it("keeps a pre-existing manual mute when adopting a schedule", async () => {
        const manual = { ...owned(), rule_id: roomId };
        const { client, controller } = setup(policy, [manual]);
        controller.start();
        await controller.reconcile();
        expect(client.deletePushRule).not.toHaveBeenCalled();
        expect(client.pushRules!.global.override).toEqual([manual]);
    });
    it.each([undefined, "local" as const])(
        "does not silently migrate legacy local schedules (%s)",
        async (enforcement) => {
            const { client, controller } = setup({ ...policy, enforcement });
            controller.start();
            await controller.reconcile();
            expect(client.addPushRule).not.toHaveBeenCalled();
            expect(client.deletePushRule).not.toHaveBeenCalled();
        },
    );
    it.each([{ enabled: false }, { override: "normal" as const }])(
        "removes only the owned rule on disable/normal override %s",
        async (patch) => {
            const { client, controller } = setup({ ...policy, ...patch }, [owned()]);
            controller.start();
            await controller.reconcile();
            expect(client.deletePushRule).toHaveBeenCalledWith("global", "override", scheduleMuteRuleId(roomId));
        },
    );
    it("retries a failed server mutation and never reports a mute before success", async () => {
        const { client, controller } = setup();
        const succeed = client.addPushRule.getMockImplementation()!;
        client.addPushRule.mockRejectedValue(new Error("offline"));
        controller.start();
        await controller.reconcile();
        expect(controller.status(roomId)).toBe("error");
        client.addPushRule.mockImplementation(succeed);
        await controller.reconcile();
        expect(controller.status(roomId)).toBe("muted");
        expect(client.addPushRule).toHaveBeenCalledTimes(3);
    });
    it("reconciles a missed boundary after sleep using current time", async () => {
        jest.setSystemTime(new Date("2026-11-11T18:00:00Z"));
        const { client, controller } = setup();
        controller.start();
        await controller.reconcile();
        jest.setSystemTime(new Date("2026-11-11T22:00:00Z"));
        window.dispatchEvent(new Event("focus"));
        await controller.reconcile();
        expect(client.addPushRule).toHaveBeenCalledTimes(1);
    });
    it("finishes an in-flight mute then removes it if the schedule changed", async () => {
        const { client, controller, sync } = setup();
        let finish!: () => void;
        const add = client.addPushRule.getMockImplementation()!;
        client.addPushRule.mockImplementationOnce(
            (...args) =>
                new Promise((resolve) => {
                    finish = () => {
                        void Promise.resolve(add(...args)).then(resolve);
                    };
                }),
        );
        controller.start();
        await Promise.resolve();
        sync({ ...policy, enabled: false });
        finish();
        await controller.reconcile();
        expect(client.deletePushRule).toHaveBeenCalledWith("global", "override", scheduleMuteRuleId(roomId));
        expect(controller.status(roomId)).toBe("normal");
    });
    it("does nothing before authenticated rules are ready or after stop", async () => {
        const { client, controller } = setup();
        client.pushRules = undefined;
        controller.start();
        await controller.reconcile();
        expect(client.addPushRule).not.toHaveBeenCalled();
        controller.stop();
        await jest.advanceTimersByTimeAsync(120000);
        expect(client.addPushRule).not.toHaveBeenCalled();
    });
});

describe("schedule server confirmation and hydration", () => {
    it("retains an owned mute until its room policy has hydrated", async () => {
        const { client, controller } = setup(policy, [owned()]);
        client.getRoom.mockReturnValue(null);
        client.getRooms.mockReturnValue([]);
        controller.start();
        await controller.reconcile();
        expect(client.deletePushRule).not.toHaveBeenCalled();
        expect(controller.status(roomId)).toBe("waiting");
    });
    it("does not call an acknowledged HTTP write an active mute without server readback", async () => {
        const { client, controller } = setup();
        client.getPushRules.mockImplementation(async () => client.pushRules!);
        controller.start();
        await controller.reconcile();
        expect(controller.status(roomId)).toBe("error");
    });
    it("keeps failures isolated between accounts", async () => {
        const a = setup(),
            b = setup();
        a.client.addPushRule.mockRejectedValue(new Error("offline"));
        a.controller.start();
        b.controller.start();
        await Promise.all([a.controller.reconcile(), b.controller.reconcile()]);
        expect(a.controller.status(roomId)).toBe("error");
        expect(b.controller.status(roomId)).toBe("muted");
    });
    it("does not remove another account rule with a similar but different namespace", async () => {
        const other = { ...owned(), rule_id: "app.other.schedule.room" };
        const { client, controller } = setup({ ...policy, enabled: false }, [other]);
        controller.start();
        await controller.reconcile();
        expect(client.deletePushRule).not.toHaveBeenCalled();
    });
});
