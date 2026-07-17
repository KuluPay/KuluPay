import { getKuluPayTables } from "@kulupay/core/db";
import { renderSafeSql } from "@farming-labs/orm";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

async function main() {
  const env = readFileSync(".env.local", "utf8");
  let dbUrl = env.match(/DATABASE_URL=(.*)/)?.[1]?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL not found in .env.local");
    process.exit(1);
  }
  dbUrl = dbUrl.replace("&channel_binding=require", "").replace("channel_binding=require&", "").replace("channel_binding=require", "");

  const schema = getKuluPayTables({ database: dbUrl, providers: [] });
  const sql = renderSafeSql(schema, { dialect: "postgres" });

  console.log("SQL to execute:");
  console.log("---");
  console.log(sql);
  console.log("---\n");

  const sqlClient = neon(dbUrl);
  const stmts = sql.split(";").filter((s) => s.trim());
  for (const stmt of stmts) {
    console.log("Executing:", stmt.trim().substring(0, 80) + "...");
    await sqlClient.query(stmt + ";");
  }

  console.log("\n✅ Migration completed successfully!");
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
