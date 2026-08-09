import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import {
    REACT_CHECKOUT,
    REACT_AMOUNT_DISPLAY,
    REACT_COUNTDOWN_TIMER,
    REACT_CONFIRMATION_STATUS,
    REACT_DISCLOSURES,
    REACT_PAY_BUTTON,
} from "./templates";

const COMPONENTS = ["checkout", "amount-display", "countdown-timer", "confirmation-status", "disclosures", "pay-button"] as const;
type ComponentName = (typeof COMPONENTS)[number];

const FRAMEWORKS = ["react", "vue", "svelte", "vanilla"] as const;
type Framework = (typeof FRAMEWORKS)[number];

const TEMPLATES: Record<Framework, Record<string, string>> = {
    react: {
        "checkout.tsx": REACT_CHECKOUT,
        "amount-display.tsx": REACT_AMOUNT_DISPLAY,
        "countdown-timer.tsx": REACT_COUNTDOWN_TIMER,
        "confirmation-status.tsx": REACT_CONFIRMATION_STATUS,
        "disclosures.tsx": REACT_DISCLOSURES,
        "pay-button.tsx": REACT_PAY_BUTTON,
    },
    vue: {},
    svelte: {},
    vanilla: {},
};

export const add = new Command("add")
    .description("Add a KuluPay component to your project (shadcn/ui style — you own the code)")
    .argument("<component>", "Component to add (checkout, amount-display, etc.)")
    .option("-f, --framework <framework>", "Framework (react, vue, svelte, vanilla)", "react")
    .option("-p, --path <path>", "Path to copy components to", "src/components/kulupay/checkout")
    .action((component: string, opts: { framework: string; path: string }) => {
        const framework = opts.framework as Framework;
        if (!FRAMEWORKS.includes(framework)) {
            console.error(`Invalid framework: ${framework}. Supported: ${FRAMEWORKS.join(", ")}`);
            process.exit(1);
        }

        const templates = TEMPLATES[framework];
        if (!templates || Object.keys(templates).length === 0) {
            console.error(`No templates available for framework: ${framework}. Coming soon.`);
            process.exit(1);
        }

        const targetDir = path.resolve(process.cwd(), opts.path);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        if (component === "checkout") {
            for (const [filename, content] of Object.entries(templates)) {
                const filePath = path.join(targetDir, filename);
                fs.writeFileSync(filePath, content);
                console.log(`  ✓ Created ${path.relative(process.cwd(), filePath)}`);
            }
            console.log(`\n  Checkout components added to ${path.relative(process.cwd(), targetDir)}`);
            console.log("  You own this code — edit, restyle, and customize freely.\n");
        } else if (COMPONENTS.includes(component as ComponentName)) {
            const filename = `${component}.tsx`;
            const content = templates[filename];
            if (!content) {
                console.error(`Component ${component} not found for framework ${framework}`);
                process.exit(1);
            }
            const filePath = path.join(targetDir, filename);
            fs.writeFileSync(filePath, content);
            console.log(`  ✓ Created ${path.relative(process.cwd(), filePath)}`);
        } else {
            console.error(`Unknown component: ${component}. Available: ${COMPONENTS.join(", ")}`);
            process.exit(1);
        }
    });

export const list = new Command("list")
    .description("List available KuluPay components")
    .action(() => {
        console.log("Available components:");
        for (const c of COMPONENTS) {
            console.log(`  - ${c}`);
        }
        console.log("\nFrameworks: react, vue, svelte, vanilla");
    });
