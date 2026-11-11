/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
import React, { useContext, useEffect, useState, type JSX } from "react";
import { type MatrixEvent, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";

import {
    defaultSchedule,
    isValidSchedule,
    readSchedule,
    saveSchedule,
    SCHEDULE_EVENT_TYPE,
    type NotificationSchedule,
    type ScheduleOverride,
} from "../../../../../utils/SyndicateNotificationSchedule";

import { roomMuteScheduler } from "../../../../../utils/SyndicateRoomMuteScheduler";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import AccessibleButton from "../../../elements/AccessibleButton";
import { _t } from "../../../../../languageHandler";

const time = (minute: number): string =>
    `${Math.floor(minute / 60)
        .toString()
        .padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
const minutes = (value: string): number => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
};

export default function SyndicateNotificationSchedule({ roomId }: { roomId: string }): JSX.Element {
    const client = useContext(MatrixClientContext);
    const [schedule, setSchedule] = useState<NotificationSchedule>(defaultSchedule);
    const [loading, setLoading] = useState(true);
    const [supported, setSupported] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [saved, setSaved] = useState(false);
    const [retry, setRetry] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [remoteChanged, setRemoteChanged] = useState(false);
    const [, refreshEnforcement] = useState(0);
    useEffect(() => roomMuteScheduler(client).subscribe(() => refreshEnforcement((value) => value + 1)), [client]);
    useEffect(() => {
        setSchedule(readSchedule(client, roomId) ?? defaultSchedule());
        setSupported(!!client.getRoom(roomId));
        setLoading(false);
        setDirty(false);
        setRemoteChanged(false);
        setSaved(false);
    }, [client, roomId, retry]);
    useEffect(() => {
        const update = (event: MatrixEvent, room: Room): void => {
            if (room.roomId !== roomId || event.getType() !== SCHEDULE_EVENT_TYPE) return;
            if (dirty) {
                setRemoteChanged(true);
            } else {
                setSchedule(readSchedule(client, roomId) ?? defaultSchedule());
                setSaved(false);
            }
        };
        client.on(RoomEvent.AccountData, update);
        return () => {
            client.off(RoomEvent.AccountData, update);
        };
    }, [client, roomId, dirty]);
    const change = (patch: Partial<NotificationSchedule>): void => {
        setSchedule((value) => ({ ...value, ...patch }));
        setDirty(true);
        setSaved(false);
    };
    const save = async (): Promise<void> => {
        setSaving(true);
        setError(false);
        setSaved(false);
        try {
            const upgraded = { ...schedule, enforcement: "matrix" as const };
            await saveSchedule(client, roomId, upgraded);
            setSchedule(upgraded);
            const controller = roomMuteScheduler(client);
            controller.start();
            await controller.reconcile();
            setDirty(false);
            setRemoteChanged(false);
            setSaved(true);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };
    const invalid = !isValidSchedule(schedule);
    return (
        <SettingsSubsection heading={_t("syndicate_schedule|title")}>
            {loading ? (
                <p>{_t("common|loading")}</p>
            ) : !supported ? (
                <>
                    <p>{_t("syndicate_schedule|unavailable")}</p>
                    <AccessibleButton onClick={() => setRetry((value) => value + 1)}>
                        {_t("syndicate_schedule|retry")}
                    </AccessibleButton>
                </>
            ) : (
                <>
                    <fieldset className="mx_SyndicateNotificationSchedule" disabled={saving}>
                        <label>
                            <input
                                type="checkbox"
                                checked={schedule.enabled}
                                onChange={(event) => change({ enabled: event.target.checked })}
                            />
                            {_t("syndicate_schedule|enabled")}
                        </label>
                        <label>
                            {_t("syndicate_schedule|override")}
                            <select
                                value={schedule.override ?? "schedule"}
                                onChange={(event) => change({ override: event.target.value as ScheduleOverride })}
                            >
                                <option value="schedule">{_t("syndicate_schedule|follow")}</option>
                                <option value="mute">{_t("syndicate_schedule|force_mute")}</option>
                                <option value="normal">{_t("syndicate_schedule|force_normal")}</option>
                            </select>
                        </label>
                        {schedule.enabled && (
                            <>
                                <div className="mx_SyndicateNotificationSchedule_days">
                                    {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => (
                                        <label key={day}>
                                            <input
                                                type="checkbox"
                                                checked={schedule.days.includes(day)}
                                                onChange={(event) =>
                                                    change({
                                                        days: event.target.checked
                                                            ? [...schedule.days, day].sort()
                                                            : schedule.days.filter((value) => value !== day),
                                                    })
                                                }
                                            />
                                            {new Intl.DateTimeFormat(undefined, {
                                                weekday: "long",
                                                timeZone: "UTC",
                                            }).format(new Date(1767571200000 + (day - 1) * 86400000))}
                                        </label>
                                    ))}
                                </div>
                                <label>
                                    {_t("syndicate_schedule|start")}
                                    <input
                                        type="time"
                                        required
                                        value={time(schedule.start_minute)}
                                        onChange={(event) => change({ start_minute: minutes(event.target.value) })}
                                    />
                                </label>
                                <label>
                                    {_t("syndicate_schedule|end")}
                                    <input
                                        type="time"
                                        required
                                        value={time(schedule.end_minute)}
                                        onChange={(event) => change({ end_minute: minutes(event.target.value) })}
                                    />
                                </label>
                                <label>
                                    {_t("syndicate_schedule|timezone")}
                                    <input
                                        value={schedule.timezone}
                                        onChange={(event) => change({ timezone: event.target.value })}
                                        placeholder="Europe/Paris"
                                    />
                                </label>
                            </>
                        )}
                        <p>{_t("syndicate_schedule|description")}</p>
                        {schedule.enforcement !== "matrix" && <p>{_t("syndicate_schedule|upgrade")}</p>}
                        {schedule.enforcement === "matrix" && (
                            <p role={roomMuteScheduler(client).status(roomId) === "error" ? "alert" : "status"}>
                                {_t(`syndicate_schedule|status_${roomMuteScheduler(client).status(roomId)}`)}
                            </p>
                        )}
                        {invalid && <p role="alert">{_t("syndicate_schedule|invalid")}</p>}
                        <AccessibleButton kind="primary" disabled={saving || invalid} onClick={save}>
                            {_t("syndicate_schedule|save")}
                        </AccessibleButton>
                    </fieldset>
                    {remoteChanged && (
                        <div>
                            <p role="status">{_t("syndicate_schedule|remote_changed")}</p>
                            <AccessibleButton onClick={() => setRetry((value) => value + 1)}>
                                {_t("syndicate_schedule|reload")}
                            </AccessibleButton>
                        </div>
                    )}
                    {error && <p role="alert">{_t("syndicate_schedule|save_error")}</p>}
                    {saved && <p role="status">{_t("syndicate_schedule|saved")}</p>}
                </>
            )}
        </SettingsSubsection>
    );
}
