import assert from "node:assert/strict";
import test from "node:test";
import { userSearchTerm } from "./user-search";

test("searches names after three characters and escapes LIKE wildcards", () => {
  assert.deepEqual(userSearchTerm("Сем"), { kind: "name", pattern: "%Сем%" });
  assert.deepEqual(userSearchTerm("A_%"), { kind: "name", pattern: "%A\\_\\%%" });
  assert.equal(userSearchTerm("Се"), null);
});

test("accepts Russian phone prefixes and a bare local number", () => {
  assert.deepEqual(userSearchTerm("+7 (916)"), { kind: "phone", pattern: "%7916%" });
  assert.deepEqual(userSearchTerm("8 916"), { kind: "phone", pattern: "%7916%" });
  assert.deepEqual(userSearchTerm("890"), { kind: "phone", pattern: "%790%" });
  assert.deepEqual(userSearchTerm("916"), { kind: "phone", pattern: "%916%" });
  assert.equal(userSearchTerm("91"), null);
});
