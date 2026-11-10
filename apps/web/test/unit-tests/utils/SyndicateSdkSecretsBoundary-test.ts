/*
Copyright 2026 Syndicate contributors.
SPDX-License-Identifier: AGPL-3.0-only
*/
// eslint-disable-next-line no-restricted-imports -- Exercise the pinned dependency implementation directly.
import { MSC4108SignInWithQR, PayloadType } from "matrix-js-sdk/src/rendezvous/MSC4108SignInWithQR";
// eslint-disable-next-line no-restricted-imports -- Also verify the published JS entry point, not only SDK source.
import { MSC4108SignInWithQR as CompiledQR } from "matrix-js-sdk/lib/rendezvous/MSC4108SignInWithQR";
import { getMockClientWithEventEmitter } from "../../test-utils";

describe.each(["source", "compiled"])("pinned SDK exported-secrets boundary (%s)", (variant) => {
    const setup = (bundle: unknown) => {
        const secureSend = jest.fn().mockResolvedValue(undefined);
        const channel = {
            secureSend,
            secureReceive: jest.fn().mockResolvedValue({ type: PayloadType.Success }),
            cancelled: false,
        };
        const client = getMockClientWithEventEmitter({
            getDevice: jest.fn().mockResolvedValue({ device_id: "SYNTHETIC" }),
            getCrypto: jest.fn().mockReturnValue({ exportSecretsBundle: jest.fn().mockResolvedValue(bundle) }),
        });
        const qr =
            variant === "source"
                ? new MSC4108SignInWithQR(
                      channel as unknown as ConstructorParameters<typeof MSC4108SignInWithQR>[0],
                      false,
                      client,
                  )
                : new CompiledQR(
                      channel as unknown as ConstructorParameters<typeof CompiledQR>[0],
                      false,
                      client as unknown as ConstructorParameters<typeof CompiledQR>[2],
                  );
        Object.defineProperty(qr, "expectingNewDeviceId", { value: "SYNTHETIC" });
        return { qr, secureSend };
    };
    it("transmits an object unchanged while protecting the protocol discriminator", async () => {
        const bundle = { synthetic: "not-a-real-key", nested: { synthetic: true }, type: "not-a-protocol-type" };
        const { qr, secureSend } = setup(bundle);
        expect(await qr.shareSecrets()).toEqual({ secrets: bundle });
        expect(secureSend).toHaveBeenLastCalledWith({ ...bundle, type: PayloadType.Secrets });
    });
    it.each([null, undefined, "not-an-object", 5, ["not-an-object-bundle"]])(
        "rejects malformed export %p before secret transmission",
        async (bundle) => {
            const { qr, secureSend } = setup(bundle);
            await expect(qr.shareSecrets()).rejects.toThrow("Invalid exported secrets bundle");
            expect(secureSend).toHaveBeenCalledTimes(1);
            expect(secureSend).toHaveBeenCalledWith({ type: PayloadType.ProtocolAccepted });
        },
    );
});
