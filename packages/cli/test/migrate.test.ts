import { createMemoryDriver } from "@farming-labs/orm";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { migrateAction } from "../src/commands/migrate";
import * as config from "../src/utils/get-config";

describe("migrate", () => {
    beforeEach(() => {
        vi.spyOn(process, "exit").mockImplementation((code) => code as never);
        vi.spyOn(config, "getConfig").mockImplementation(async () => ({
            options: {
                database: createMemoryDriver(),
                providers: [],
            },
            configPath: "test/pay.ts",
        }));
    });

    it("should call process.exit when database runtime cannot be detected", async () => {
        await migrateAction({
            cwd: process.cwd(),
            yes: true,
        });

        expect(process.exit).toHaveBeenCalled();
    });

    it("should call process.exit when database is missing", async () => {
        vi.spyOn(config, "getConfig").mockImplementation(async () => ({
            options: {
                database: null,
                providers: [],
            },
            configPath: "test/pay.ts",
        }));

        await migrateAction({
            cwd: process.cwd(),
            yes: true,
        });

        expect(process.exit).toHaveBeenCalled();
    });

    it("should call process.exit when config is not found", async () => {
        vi.spyOn(config, "getConfig").mockImplementation(async () => null);

        await migrateAction({
            cwd: process.cwd(),
            yes: true,
        });

        expect(process.exit).toHaveBeenCalled();
    });
});
