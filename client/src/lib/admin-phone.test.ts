import assert from "node:assert/strict";
import test from "node:test";
import { formatCustomerSearchInput, formatRussianPhoneInput } from "./admin-phone";

test("formats local, 8-prefix and 7-prefix Russian phone numbers", () => {
  for (const input of ["9168257455", "89168257455", "+79168257455"])
    assert.equal(formatRussianPhoneInput(input), "+7 (916) 825-74-55");
  assert.equal(formatRussianPhoneInput("9"), "+7 (9");
  assert.equal(formatRussianPhoneInput("8"), "+7");
});

test("keeps partial search and names intact, formats complete phone", () => {
  assert.equal(formatCustomerSearchInput("74-55"), "74-55");
  assert.equal(formatCustomerSearchInput("Семён"), "Семён");
  assert.equal(formatCustomerSearchInput("89168257455"), "+7 (916) 825-74-55");
});
