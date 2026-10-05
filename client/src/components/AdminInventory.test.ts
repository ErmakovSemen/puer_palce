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
  saleFormat: "loose" as const,
  servicePrice: "",
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

test("different formats and the same tea can share one sale", () => {
  const lines = [
    { ...blank(), productId: "1", quantity: "5", saleFormat: "teapot" as const, servicePrice: "700" },
    { ...blank(), productId: "1", quantity: "3", saleFormat: "cup" as const, servicePrice: "300" },
  ];
  assert.equal(saleLineError(filledSaleLines(lines), [{ ...tea, quantity: 8 }]), null);
  assert.match(saleLineError(filledSaleLines(lines), [{ ...tea, quantity: 7 }]) || "", /доступно 7/);
});

test("a format selected on an extra row requires a product", () => {
  const lines = [{ ...blank(), productId: "1", quantity: "5" }, { ...blank(), saleFormat: "cup" as const, servicePrice: "300" }];
  assert.match(saleLineError(filledSaleLines(lines), [tea]) || "", /Выберите товар/);
});

test("a free service accepts explicit zero, but still requires a price", () => {
  const line = { ...blank(), productId: "1", quantity: "3", saleFormat: "cup" as const, servicePrice: "0" };
  assert.equal(saleLineError([line], [tea]), null);
  assert.match(saleLineError([{ ...line, servicePrice: "" }], [tea]) || "", /Цзин Фа.*справа/);
  assert.notEqual(saleLineError([{ ...line, servicePrice: "-1" }], [tea]), null);
});
