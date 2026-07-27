# @kulupay/adapter-sql

SQL database adapters for KuluPay (PostgreSQL, MySQL, SQLite).

## Install

```bash
npm install @kulupay/adapter-sql
```

And the driver you need:

```bash
npm install pg        # PostgreSQL
npm install mysql2    # MySQL
npm install better-sqlite3  # SQLite
```

## Usage

### PostgreSQL

```ts
import { kuluPay } from "@kulupay/kulupay";
import { pg } from "@kulupay/adapter-sql";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const pay = kuluPay({
  database: pg(pool),
  providers: [],
});
```

### MySQL

```ts
import { mysql } from "@kulupay/adapter-sql";
import mysql2 from "mysql2/promise";

const connection = await mysql2.createConnection(process.env.DATABASE_URL);

export const pay = kuluPay({
  database: mysql(connection),
  providers: [],
});
```

### SQLite

```ts
import { sqlite } from "@kulupay/adapter-sql";
import Database from "better-sqlite3";

const db = new Database("kulupay.db");

export const pay = kuluPay({
  database: sqlite(db),
  providers: [],
});
```
