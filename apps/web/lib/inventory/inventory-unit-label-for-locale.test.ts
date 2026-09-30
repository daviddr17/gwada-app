import assert from "node:assert/strict";
import { test } from "node:test";

import {
  localizeInventoryUnitLabel,
  resolveInventoryNotificationLocale,
} from "./inventory-unit-label-for-locale.ts";

test("Deutsch ersetzt englische Lagereinheiten", () => {
  assert.equal(localizeInventoryUnitLabel("piece", "de"), "Stück");
  assert.equal(localizeInventoryUnitLabel("pieces", "de-DE"), "Stück");
  assert.equal(localizeInventoryUnitLabel("pcs", "de"), "Stück");
  assert.equal(localizeInventoryUnitLabel("kilogram", "de"), "Kilogramm");
  assert.equal(localizeInventoryUnitLabel("kg", "de"), "Kilogramm (kg)");
  assert.equal(localizeInventoryUnitLabel("liter", "de"), "Liter");
  assert.equal(localizeInventoryUnitLabel("litre", "de"), "Liter");
  assert.equal(localizeInventoryUnitLabel("l", "de"), "Liter (l)");
  assert.equal(localizeInventoryUnitLabel("gram", "de"), "Gramm");
  assert.equal(localizeInventoryUnitLabel("g", "de"), "Gramm (g)");
  assert.equal(localizeInventoryUnitLabel("bottle", "de"), "Flasche");
  assert.equal(localizeInventoryUnitLabel("box", "de"), "Karton");
});

test("schon deutsche Einheiten bleiben auf Deutsch", () => {
  assert.equal(localizeInventoryUnitLabel("Stück", "de"), "Stück");
  assert.equal(
    localizeInventoryUnitLabel("Kilogramm (kg)", "de"),
    "Kilogramm (kg)",
  );
  assert.equal(localizeInventoryUnitLabel("Schale", "de"), "Schale");
});

test("Englisch behält englische Wörter und übersetzt deutsche", () => {
  assert.equal(localizeInventoryUnitLabel("piece", "en"), "piece");
  assert.equal(localizeInventoryUnitLabel("kilogram", "en-US"), "kilogram");
  assert.equal(localizeInventoryUnitLabel("Stück", "en"), "piece");
  assert.equal(
    localizeInventoryUnitLabel("Kilogramm (kg)", "en"),
    "kilogram (kg)",
  );
  assert.equal(localizeInventoryUnitLabel("Liter (l)", "en"), "liter (l)");
  assert.equal(localizeInventoryUnitLabel("Schale", "en"), "Schale");
});

test("weitere App-Sprachen bekommen eigene Einheitswörter", () => {
  assert.equal(localizeInventoryUnitLabel("piece", "fr"), "pièce");
  assert.equal(localizeInventoryUnitLabel("kg", "es"), "kilogramo (kg)");
  assert.equal(localizeInventoryUnitLabel("liter", "it"), "litro");
  assert.equal(localizeInventoryUnitLabel("bottle", "tr"), "şişe");
  assert.equal(localizeInventoryUnitLabel("piece", "ar"), "قطعة");
  assert.equal(localizeInventoryUnitLabel("kg", "zh"), "千克 (kg)");
});

test("Sprache: Empfänger vor Restaurant, sonst Deutsch", () => {
  assert.equal(resolveInventoryNotificationLocale("en-US", "de"), "en");
  assert.equal(resolveInventoryNotificationLocale("  ", "fr"), "fr");
  assert.equal(resolveInventoryNotificationLocale(null, "de-DE"), "de");
  assert.equal(resolveInventoryNotificationLocale(null, null), "de");
});
