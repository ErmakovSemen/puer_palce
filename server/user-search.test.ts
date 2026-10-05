import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { userSearchTerm } from "./user-search";

test("searches names after three characters and escapes LIKE wildcards", () => {
  assert.deepEqual(userSearchTerm("Сем"), { kind: "name", pattern: "%Сем%" });
  assert.deepEqual(userSearchTerm("A_%"), { kind: "name", pattern: "%A\\_\\%%" });
  assert.equal(userSearchTerm("Се"), null);
});

test("accepts Russian phone prefixes and a bare local number", () => {
  assert.deepEqual(userSearchTerm("+7 (916)"), { kind: "phone", pattern: "%916%" });
  assert.deepEqual(userSearchTerm("8 916"), { kind: "phone", pattern: "%916%" });
  assert.deepEqual(userSearchTerm("890"), { kind: "phone", pattern: "%90%" });
  assert.deepEqual(userSearchTerm("916"), { kind: "phone", pattern: "%916%" });
  assert.deepEqual(userSearchTerm("74-55"), { kind: "phone", pattern: "%7455%" });
  assert.deepEqual(userSearchTerm("8 (916) 825-74-55"), { kind: "phone", pattern: "%9168257455%" });
  assert.equal(userSearchTerm("91"), null);
});

test("digit-only phone search matches the last digits across stored formats", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE test_phones(phone text); INSERT INTO test_phones VALUES('+7 (916) 825-74-55'),('8 916 123 45 67');");
    for (const query of ["74-55", "8 916 825-74-55", "+7 (916) 825-74-55"]) {
      const term = userSearchTerm(query)!;
      const { rows } = await db.query(
        "SELECT phone FROM test_phones WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE $1",
        [term.pattern],
      );
      assert.deepEqual(rows.map((row: any) => row.phone), ["+7 (916) 825-74-55"]);
    }
  } finally {
    await db.close();
  }
});
