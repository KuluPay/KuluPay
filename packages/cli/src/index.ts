#!/usr/bin/env node

import { Command } from "commander";
import { generate } from "./commands/generate";
import { migrate } from "./commands/migrate";

import "dotenv/config";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
    const program = new Command("kulupay");

    program
        .addCommand(generate)
        .addCommand(migrate)
        .version("0.0.1")
        .description("KuluPay CLI - generate schemas and migrate your database")
        .action(() => program.help());

    program.parse();
}

main().catch((error) => {
    console.error("Error running KuluPay CLI:", error);
    process.exit(1);
});
