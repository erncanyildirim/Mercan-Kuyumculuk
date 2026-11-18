import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeConfig, ValidationError } from "../functions/_lib/config.js";

const site = (item) => ({
  site: { categories: [{ id: "ajda", title: "Ajda" }], items: [{ id: "u1", categoryId: "ajda", name: "Ajda", ...item }] },
});

test("product gram options are cleaned and sorted", () => {
  const doc = sanitizeConfig(site({ grams: ["20", 10, "12,5", 10], priceCode: "AYAR22" }));
  assert.deepEqual(doc.site.items[0].grams, [10, 12.5, 20]);
  assert.equal(doc.site.items[0].priceCode, "AYAR22");
});

test("products without grams keep an empty list", () => {
  const doc = sanitizeConfig(site({}));
  assert.deepEqual(doc.site.items[0].grams, []);
  assert.equal(doc.site.items[0].priceCode, "");
});

test("bad gram values are rejected", () => {
  assert.throws(() => sanitizeConfig(site({ grams: [-1] })), ValidationError);
  assert.throws(() => sanitizeConfig(site({ priceCode: "bad code" })), ValidationError);
});
