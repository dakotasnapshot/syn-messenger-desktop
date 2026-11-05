/*
Copyright 2026 Dakota Cole
SPDX-License-Identifier: AGPL-3.0-only
*/

import { test, expect } from "../../element-web-test";

test.use({ displayName: "Alice", config: { giphy_api_key: "synthetic-test-key" } });

test("GIF trending, search and encrypted upload", async ({ page, app, user }, testInfo) => {
    test.slow();
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    const endpoints: string[] = [];
    await page.route("https://api.giphy.com/v1/gifs/**", async (route) => {
        endpoints.push(new URL(route.request().url()).pathname);
        await route.fulfill({
            json: {
                data: [
                    {
                        id: "synthetic-cat",
                        title: "Synthetic cat",
                        images: {
                            fixed_width: { url: "https://media.giphy.com/synthetic-preview.gif" },
                            original: { url: "https://media.giphy.com/synthetic-original.gif" },
                        },
                    },
                ],
            },
        });
    });
    await page.route("https://media.giphy.com/synthetic-*.gif", (route) =>
        route.fulfill({ contentType: "image/gif", body: gif }),
    );

    const roomId = await app.client.createRoom({
        name: "GIF parity test",
        initial_state: [{ type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }],
    });
    await app.viewRoomByName("GIF parity test");
    await page.locator(".mx_MessageComposer_buttonMenu").click();
    await page.getByRole("menuitem", { name: "GIFs", exact: true }).click();
    const picker = page.locator(".mx_GIFPickerDialog");
    await expect(picker.getByText("Powered by GIPHY")).toBeVisible();
    await expect(picker.getByRole("button", { name: "Synthetic cat" })).toBeVisible();
    expect(endpoints).toContain("/v1/gifs/trending");
    await picker.getByRole("searchbox", { name: "Search GIFs" }).fill("cat");
    await expect.poll(() => endpoints.includes("/v1/gifs/search")).toBe(true);
    await picker.getByRole("button", { name: "Synthetic cat" }).click();
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeEnabled();

    const encryptedSend = page.waitForRequest(
        (request) => request.method() === "PUT" && request.url().includes("/send/m.room.encrypted/"),
    );
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    const request = await encryptedSend;
    expect(request.postDataJSON()).toMatchObject({ algorithm: "m.megolm.v1.aes-sha2" });
    expect(request.postDataJSON()).not.toHaveProperty("url");
    await expect(page.locator(".mx_ImageBody").last()).toBeVisible();
    await expect
        .poll(() =>
            app.client.evaluate((client, roomId) => {
                return client
                    .getRoom(roomId)
                    ?.getLiveTimeline()
                    .getEvents()
                    .some(
                        (event) =>
                            event.getType() === "m.room.message" &&
                            event.getContent().msgtype === "m.image" &&
                            event.getContent().file?.key?.kty === "oct",
                    );
            }, roomId),
        )
        .toBe(true);
    await page.screenshot({ path: testInfo.outputPath("encrypted-gif.png") });
});
