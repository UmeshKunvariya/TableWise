import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

/**
 * Schema tests against an in-process Postgres (PGlite).
 *
 * `supabase db reset` against the real local stack is still the authoritative
 * check — it exercises the genuine auth, realtime and storage schemas. These
 * tests exist because they need no Docker, run in about a second, and cover the
 * properties that would be expensive to discover in staging: gap-free ticket
 * allocation, the exact shape of the customer's view, and the rule that
 * anonymous clients cannot reach queue_entries.
 *
 * Supabase-provided objects are stubbed below. Anything stubbed is NOT being
 * tested — only our own migrations are.
 */

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

const OWNER_UID = "11111111-1111-1111-1111-111111111111";

let db;
let restaurantId;

async function applyStubs() {
  await db.exec(`
    create schema if not exists auth;
    create schema if not exists realtime;
    create table auth.users (id uuid primary key);
    create role anon;
    create role authenticated;
    create role service_role;
    create table realtime._sent (payload jsonb, event text, topic text, priv boolean);
    create function realtime.send(jsonb, text, text, boolean) returns void
      language sql as $$ insert into realtime._sent values ($1,$2,$3,$4); $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid $$;
    create publication supabase_realtime;
  `);

  // PGlite ships no pgcrypto; the schema only uses it for random defaults.
  await db.exec(`
    create or replace function public.gen_random_bytes(int) returns bytea
      language sql as $$
        select decode(md5(random()::text || clock_timestamp()::text), 'hex') $$;
  `);

  // Supabase grants anon/authenticated privileges on public by default. This
  // must be replicated, or anonymous reads would fail with "permission denied"
  // and the tests below would pass for the wrong reason.
  await db.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public
      grant all on sequences to anon, authenticated, service_role;
  `);
}

async function asRole(role, fn) {
  await db.exec(`set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await applyStubs();

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8").replace(
      "create extension if not exists pgcrypto;",
      "",
    );
    await db.exec(sql);
  }

  await db.exec(`insert into auth.users (id) values ('${OWNER_UID}');`);
  await db.exec(`set test.uid = '${OWNER_UID}';`);

  const { rows } = await db.query(
    `select public.register_restaurant(
       'Owner','555','Curry House','curry-house','1 Main St',
       19.0760, 72.8777, 'Asia/Kolkata') as id`,
  );
  restaurantId = rows[0].id;

  await db.exec(
    `update public.restaurants set status='approved' where id='${restaurantId}';`,
  );

  for (let i = 0; i < 20; i++) {
    await db.query(
      `select public.join_queue($1,$2,'555',2,19.0760,72.8777,5,'qr')`,
      [restaurantId, `Party ${i + 1}`],
    );
  }
});

afterAll(async () => {
  await db?.close();
});

async function tokens() {
  const { rows } = await db.query(
    `select customer_token, ticket_number from public.queue_entries
     where restaurant_id=$1 order by ticket_number`,
    [restaurantId],
  );
  return rows;
}

describe("ticket allocation", () => {
  it("assigns unique, gap-free numbers under repeated joins", async () => {
    const { rows } = await db.query(
      `select ticket_number from public.queue_entries
       where restaurant_id=$1 order by ticket_number`,
      [restaurantId],
    );
    expect(rows.map((r) => r.ticket_number)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it("resolves the service date in the restaurant's own timezone", async () => {
    const { rows } = await db.query(
      `select public.restaurant_service_date($1) as d`,
      [restaurantId],
    );
    expect(rows[0].d).toBeInstanceOf(Date);
  });
});

describe("realtime broadcast", () => {
  it("fires once per queue change on the restaurant's topic", async () => {
    const { rows } = await db.query(`select topic from realtime._sent`);
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.topic === `queue:${restaurantId}`)).toBe(true);
  });

  it("carries only a version counter, never PII", async () => {
    const { rows } = await db.query(`select payload from realtime._sent limit 1`);
    expect(Object.keys(rows[0].payload)).toEqual(["v"]);
  });
});

describe("get_my_position", () => {
  it("reports the number of groups ahead", async () => {
    const all = await tokens();
    const { rows } = await db.query(
      `select * from public.get_my_position($1)`,
      [all[4].customer_token],
    );
    expect(rows[0]).toMatchObject({ ticket_number: 5, people_ahead: 4 });
  });

  it("returns only ticket_number, people_ahead and status", async () => {
    const all = await tokens();
    const { rows } = await db.query(
      `select * from public.get_my_position($1)`,
      [all[4].customer_token],
    );
    expect(Object.keys(rows[0]).sort()).toEqual([
      "people_ahead",
      "status",
      "ticket_number",
    ]);
  });

  it("reveals nothing for an unknown token", async () => {
    const { rows } = await db.query(
      `select * from public.get_my_position('not-a-real-token')`,
    );
    expect(rows).toHaveLength(0);
  });

  it("decrements everyone behind a party that gets seated", async () => {
    const all = await tokens();
    await db.exec(
      `update public.queue_entries set status='seated'
       where customer_token='${all[0].customer_token}';`,
    );
    const { rows } = await db.query(
      `select * from public.get_my_position($1)`,
      [all[4].customer_token],
    );
    expect(rows[0].people_ahead).toBe(3);
  });
});

describe("tenant isolation", () => {
  it("returns zero rows — not an error — for an anonymous read of queue_entries", async () => {
    const rows = await asRole("anon", async () => {
      const result = await db.query(`select * from public.queue_entries`);
      return result.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("returns zero rows for an anonymous read of restaurants", async () => {
    const rows = await asRole("anon", async () => {
      const result = await db.query(`select * from public.restaurants`);
      return result.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("refuses an anonymous call to join_queue, so the geofence cannot be bypassed", async () => {
    await expect(
      asRole("anon", () =>
        db.query(`select public.join_queue($1,'Sneaky','555',2,0,0,0,'qr')`, [
          restaurantId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("refuses an anonymous call to leave_queue", async () => {
    await expect(
      asRole("anon", () =>
        db.query(`select public.leave_queue('any-token')`),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
