#!/usr/bin/env node

import { Command } from "commander";
import { generate } from "./commands/generate";
import { migrate } from "./commands/migrate";
import { init } from "./commands/init";
import { addProvider } from "./commands/add-provider";
import { removeProvider } from "./commands/remove-provider";
import { add, list } from "./commands/add";

import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
    const program = new Command("kulupay");

    program
        .addCommand(init)
        .addCommand(addProvider)
        .addCommand(removeProvider)
        .addCommand(generate)
        .addCommand(migrate)
        .addCommand(add)
        .addCommand(list)
        .version("0.0.5")
        .description("KuluPay CLI - init project, add providers, add checkout, generate schemas, and migrate your database")
        .action(() => program.help());

    program.parse();
}

main().catch((error) => {
    console.error("Error running KuluPay CLI:", error);
    process.exit(1);
});
