import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStaffProfileChangeDiff,
  emptyStaffProfileChangeFields,
  parseStaffProfileChangeFields,
  staffProfileFieldsEqual,
} from "./staff-profile-change-request-types";

describe("staff profile change fields", () => {
  it("builds a diff for changed fields only", () => {
    const previous = emptyStaffProfileChangeFields();
    previous.given_name = "Anna";
    previous.family_name = "Müller";
    previous.city = "Berlin";

    const proposed = { ...previous, city: "Hamburg", phone: "+49123" };
    const diff = buildStaffProfileChangeDiff(previous, proposed);

    assert.deepEqual(
      diff.map((d) => d.key),
      ["city", "phone"],
    );
    assert.equal(diff[0]?.fromLabel, "Berlin");
    assert.equal(diff[0]?.toLabel, "Hamburg");
  });

  it("detects equal snapshots", () => {
    const a = emptyStaffProfileChangeFields();
    a.given_name = "Max";
    a.family_name = "Mustermann";
    const b = { ...a };
    assert.equal(staffProfileFieldsEqual(a, b), true);
    b.email = "a@b.de";
    assert.equal(staffProfileFieldsEqual(a, b), false);
  });

  it("parses proposed payload fields", () => {
    const parsed = parseStaffProfileChangeFields({
      given_name: " A ",
      family_name: " B ",
      email: "Test@Example.com",
      city: "Köln",
    });
    assert.equal(parsed?.given_name, "A");
    assert.equal(parsed?.family_name, "B");
    assert.equal(parsed?.email, "test@example.com");
    assert.equal(parsed?.city, "Köln");
  });
});
