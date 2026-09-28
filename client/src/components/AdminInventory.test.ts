import assert from "node:assert/strict";
import test from "node:test";
import { filledSaleLines, saleLineError } from "./AdminInventory";

const tea = {
  id: 1,
  name: "Цзин Фа",
  category: "tea",
  unit: "gram",
  price_cents: 1700,
  quantity: null,
  revision: 1,
};

const blank = () => ({
  productId: "",
  quantity: "",
  newTeaName: "",
  pricePerGram: "",
});

test("an untouched extra row does not block a sale", () => {
  const lines = [{ ...blank(), productId: "1", quantity: "1" }, blank()];
  const active = filledSaleLines(lines);
  assert.equal(active.length, 1);
  assert.equal(saleLineError(active, [tea]), null);
});

test("a partially filled extra row is still validated", () => {
  const lines = [{ ...blank(), productId: "1", quantity: "1" }, { ...blank(), quantity: "2" }];
  assert.match(saleLineError(filledSaleLines(lines), [tea]) || "", /Выберите товар/);
});

test("a sale without products is rejected", () => {
  assert.match(saleLineError(filledSaleLines([blank()]), [tea]) || "", /Добавьте чай/);
});

test("new tea can be sold without a known balance", () => {
  const lines = [{ ...blank(), productId: "new-tea", newTeaName: "Габа", pricePerGram: "40", quantity: "5" }];
  assert.equal(saleLineError(filledSaleLines(lines), [tea]), null);
});
