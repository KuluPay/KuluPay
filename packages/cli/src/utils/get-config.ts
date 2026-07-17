import fs, { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

let possiblePaths = [
    "pay.ts",
    "pay.js",
    "pay.tsx",
    "pay.jsx",
    "kulupay.ts",
    "kulupay.js",
];

possiblePaths = [
    ...possiblePaths,
    ...possiblePaths.map((it) => `lib/${it}`),
    ...possiblePaths.map((it) => `lib/server/${it}`),
    ...possiblePaths.map((it) => `server/${it}`),
    ...possiblePaths.map((it) => `server/pay/${it}`),
    ...possiblePaths.map((it) => `config/${it}`),
    ...possiblePaths.map((it) => `src/${it}`),
    ...possiblePaths.map((it) => `src/lib/${it}`),
    ...possiblePaths.map((it) => `src/server/${it}`),
    ...possiblePaths.map((it) => `app/${it}`),
];

export interface KuluPayConfigResult {
    options: any;
    configPath: string;
}

export async function getConfig({
    cwd,
    configPath,
}: {
    cwd: string;
    configPath?: string;
}): Promise<KuluPayConfigResult | null> {
    try {
        if (configPath) {
            const resolvedPath = path.resolve(cwd, configPath);
            if (!existsSync(resolvedPath)) {
                console.error(`Config file not found at ${resolvedPath}`);
                process.exit(1);
            }
            const options = await loadConfigFile(resolvedPath, cwd);
            return { options, configPath: resolvedPath };
        }

        for (const possiblePath of possiblePaths) {
            const fullPath = path.join(cwd, possiblePath);
            if (existsSync(fullPath)) {
                const options = await loadConfigFile(fullPath, cwd);
                if (options) {
                    return { options, configPath: fullPath };
                }
            }
        }

        return null;
    } catch (e: any) {
        console.error("Couldn't read your KuluPay config.", e?.message || e);
        process.exit(1);
    }
}

async function loadConfigFile(filePath: string, cwd: string): Promise<any> {
    const require = createRequire(path.join(cwd, "package.json"));

    try {
        const ext = path.extname(filePath);
        if (ext === ".ts" || ext === ".tsx") {
            const tsx = await import("tsx");
            const mod = await tsx.tsImport(filePath, import.meta.url);
            return extractOptions(mod);
        }
        const mod = await import(filePath);
        return extractOptions(mod);
    } catch {
        try {
            const mod = require(filePath);
            return extractOptions(mod);
        } catch (e2: any) {
            console.error(`Failed to load config from ${filePath}:`, e2?.message);
            return null;
        }
    }
}

function extractOptions(mod: any): any {
    if (!mod) return null;
    if (mod.default?.options) return mod.default.options;
    if (mod.pay?.options) return mod.pay.options;
    if (mod.kuluPay?.options) return mod.kuluPay.options;
    if (mod.options) return mod.options;
    if (mod.default) return mod.default;
    return null;
}
