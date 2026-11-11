/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, type RenderResult, screen, within } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import NotificationSettingsTab from "../../../../../../../src/components/views/settings/tabs/room/NotificationSettingsTab";
import { mkStubRoom, stubClient } from "../../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { EchoChamber } from "../../../../../../../src/stores/local-echo/EchoChamber";
import { type RoomEchoChamber } from "../../../../../../../src/stores/local-echo/RoomEchoChamber";
import { PROPERTY_UPDATED } from "../../../../../../../src/stores/local-echo/GenericEchoChamber";
import { RoomNotifState } from "../../../../../../../src/RoomNotifs";
import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../../src/settings/SettingLevel";

describe("NotificationSettingsTab", () => {
    const roomId = "!room:example.com";
    let cli: MatrixClient;
    let roomProps: RoomEchoChamber;

    const renderTab = (): RenderResult => {
        return render(
            <MatrixClientContext.Provider value={cli}>
                <NotificationSettingsTab roomId={roomId} closeSettingsFn={() => {}} />
            </MatrixClientContext.Provider>,
        );
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        const room = mkStubRoom(roomId, "test room", cli);
        roomProps = EchoChamber.forRoom(room);

        NotificationSettingsTab.contextType = React.createContext<MatrixClient>(cli);
    });

    afterEach(() => {
        SettingsStore.reset();
    });

    it("updates the ordinary mute control when the shared room state changes, and unsubscribes", () => {
        const volume = jest.spyOn(roomProps, "notificationVolume", "get").mockReturnValue(RoomNotifState.AllMessages);
        const previousListeners = roomProps.listenerCount(PROPERTY_UPDATED);
        const tab = renderTab();
        expect(tab.container.querySelector('input[value="all_messages"]')).toBeChecked();
        volume.mockReturnValue(RoomNotifState.Mute);
        act(() => {
            roomProps.emit(PROPERTY_UPDATED);
        });
        expect(tab.container.querySelector('input[value="mute"]')).toBeChecked();
        volume.mockReturnValue(RoomNotifState.AllMessages);
        act(() => {
            roomProps.emit(PROPERTY_UPDATED);
        });
        expect(tab.container.querySelector('input[value="all_messages"]')).toBeChecked();
        tab.unmount();
        expect(roomProps.listenerCount(PROPERTY_UPDATED)).toBe(previousListeners);
        volume.mockRestore();
    });

    it("should prevent »Settings« link click from bubbling up to radio buttons", async () => {
        const tab = renderTab();

        // settings link of mentions_only volume
        const settingsLink = within(tab.getByText("@mentions and replies only")).getByRole("button", {
            name: "settings",
        });
        if (!settingsLink) throw new Error("settings link does not exist.");

        await userEvent.click(settingsLink);

        expect(roomProps.notificationVolume).not.toBe("mentions_only");
    });

    it("should show the currently chosen custom notification sound", async () => {
        SettingsStore.setValue("notificationSound", roomId, SettingLevel.ACCOUNT, {
            url: "mxc://server/custom-sound-123",
            name: "custom-sound-123",
        });
        renderTab();

        await screen.findByText("custom-sound-123");
    });

    it("should show the currently chosen custom notification sound url if no name", async () => {
        SettingsStore.setValue("notificationSound", roomId, SettingLevel.ACCOUNT, {
            url: "mxc://server/custom-sound-123",
        });
        renderTab();

        await screen.findByText("http://this.is.a.url/server/custom-sound-123");
    });
});
