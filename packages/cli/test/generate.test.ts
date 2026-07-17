import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMemoryDriver } from "@farming-labs/orm";
import { getKuluPayTables } from "@kulupay/core/db";
import { renderPrismaSchema, renderDrizzleSchema, renderSafeSql } from "@farming-labs/orm";
import type { KuluPayOptions } from "@kulupay/core";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { generateAction } from "../src/commands/generate";
import * as config from "../src/utils/get-config";

const mockOptions: KuluPayOptions = {
    database: createMemoryDriver() as any,
    providers: [],
    payment: {
        additionalFields: {
            description: { type: "string" as const, required: false },
        },
    },
};

describe("generate", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kulupay-test-"));
        vi.spyOn(process, "exit").mockImplementation((code) => code as never);
        vi.spyOn(config, "getConfig").mockImplementation(async () => ({
            options: mockOptions,
            configPath: "test/pay.ts",
        }));
    });

    it("should generate prisma schema", async () => {
        const outputFile = path.join(tmpDir, "schema.prisma");
        await generateAction({
            cwd: tmpDir,
            generator: "prisma",
            output: outputFile,
            yes: true,
        });

        const content = fs.readFileSync(outputFile, "utf-8");
        expect(content).toContain("model Payment");
        expect(content).toContain("model Customer");
        expect(content).toContain("model Subscription");
        expect(content).toContain("description");
    });

    it("should generate drizzle schema", async () => {
        const outputFile = path.join(tmpDir, "schema.ts");
        await generateAction({
            cwd: tmpDir,
            generator: "drizzle",
            output: outputFile,
            yes: true,
        });

        const content = fs.readFileSync(outputFile, "utf-8");
        expect(content).toContain("payment");
        expect(content).toContain("customer");
        expect(content).toContain("subscription");
    });

    it("should generate sql schema", async () => {
        const outputFile = path.join(tmpDir, "kulupay.sql");
        await generateAction({
            cwd: tmpDir,
            generator: "sql",
            output: outputFile,
            yes: true,
        });

        const content = fs.readFileSync(outputFile, "utf-8");
        expect(content.toLowerCase()).toContain("create table");
        expect(content.toLowerCase()).toContain("payment");
        expect(content.toLowerCase()).toContain("customer");
        expect(content.toLowerCase()).toContain("subscription");
    });

    it("should include additionalFields in generated schema", async () => {
        const outputFile = path.join(tmpDir, "schema.prisma");
        await generateAction({
            cwd: tmpDir,
            generator: "prisma",
            output: outputFile,
            yes: true,
        });

        const content = fs.readFileSync(outputFile, "utf-8");
        expect(content).toContain("description");
    });
});

describe("generate schema directly", () => {
    it("should render prisma schema with additionalFields", () => {
        const schema = getKuluPayTables(mockOptions);
        const output = renderPrismaSchema(schema, { provider: "postgresql" });
        expect(output).toContain("model Payment");
        expect(output).toContain("description");
    });

    it("should render drizzle schema with additionalFields", () => {
        const schema = getKuluPayTables(mockOptions);
        const output = renderDrizzleSchema(schema, { dialect: "pg" });
        expect(output).toContain("payment");
    });

    it("should render sql schema with additionalFields", () => {
        const schema = getKuluPayTables(mockOptions);
        const output = renderSafeSql(schema, { dialect: "postgres" });
        expect(output.toLowerCase()).toContain("create table");
        expect(output.toLowerCase()).toContain("description");
    });
});
