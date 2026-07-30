import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";

const db = drizzle(new Database(":memory:"));
const driver = drizzleAdapter(db, { provider: "sqlite" });
console.log("handle:", driver.handle);
