import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }));
