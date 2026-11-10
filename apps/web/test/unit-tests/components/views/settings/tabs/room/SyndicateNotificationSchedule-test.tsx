/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import React from "react";
import { act, render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { MatrixEvent, Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import SyndicateNotificationSchedule from "../../../../../../../src/components/views/settings/tabs/room/SyndicateNotificationSchedule";
import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import { getMockClientWithEventEmitter } from "../../../../../../test-utils";
import { defaultSchedule, SCHEDULE_EVENT_TYPE } from "../../../../../../../src/utils/SyndicateNotificationSchedule";

const roomId = "!synthetic:example.org";
describe("Syndicate notification schedule settings", () => {
    const schedule = { ...defaultSchedule(), enabled: true, timezone: "Europe/Paris" };
    const setup = () => {
        const client = getMockClientWithEventEmitter({ getRoom: jest.fn(), setRoomAccountData: jest.fn() });
        const room = new Room(roomId, client, "@synthetic:example.org");
        room.addAccountData([new MatrixEvent({ type: SCHEDULE_EVENT_TYPE, content: schedule })]);
        client.getRoom.mockReturnValue(room);
        client.setRoomAccountData.mockResolvedValue({});
        render(
            <MatrixClientContext.Provider value={client}>
                <SyndicateNotificationSchedule roomId={roomId} />
            </MatrixClientContext.Provider>,
        );
        return { client, room };
    };
    it("loads and saves a disable on a normal Matrix homeserver", async () => {
        const { client } = setup();
        await userEvent.click(await screen.findByRole("checkbox", { name: "Use notification schedule" }));
        await userEvent.click(screen.getByRole("button", { name: "Save schedule" }));
        await waitFor(() =>
            expect(client.setRoomAccountData).toHaveBeenCalledWith(roomId, SCHEDULE_EVENT_TYPE, {
                ...schedule,
                enabled: false,
            }),
        );
    });
    it("saves an explicit synced manual override", async () => {
        const { client } = setup();
        await userEvent.selectOptions(await screen.findByRole("combobox"), "normal");
        await userEvent.click(screen.getByRole("button", { name: "Save schedule" }));
        await waitFor(() =>
            expect(client.setRoomAccountData).toHaveBeenCalledWith(roomId, SCHEDULE_EVENT_TYPE, {
                ...schedule,
                override: "normal",
            }),
        );
    });
    it("keeps drafts on remote edits and reloads without writing back", async () => {
        const { client, room } = setup();
        await userEvent.clear(await screen.findByLabelText("Time zone"));
        await userEvent.type(screen.getByLabelText("Time zone"), "Europe/London");
        const event = new MatrixEvent({ type: SCHEDULE_EVENT_TYPE, content: { ...schedule, timezone: "Asia/Tokyo" } });
        act(() => {
            room.addAccountData([event]);
            client.emit(RoomEvent.AccountData, event, room);
        });
        expect(screen.getByLabelText("Time zone")).toHaveValue("Europe/London");
        await userEvent.click(screen.getByRole("button", { name: "Reload synced schedule" }));
        expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Tokyo");
        expect(client.setRoomAccountData).not.toHaveBeenCalled();
    });
    it("preserves the draft on save failure", async () => {
        const { client } = setup();
        client.setRoomAccountData.mockRejectedValue(new Error("offline"));
        await userEvent.click(await screen.findByRole("button", { name: "Save schedule" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the schedule");
        expect(screen.getByLabelText("Time zone")).toHaveValue("Europe/Paris");
    });
});
