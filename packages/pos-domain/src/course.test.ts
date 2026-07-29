import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePosOrderCourse,
  isPosOrderCourse,
  posOrderCourseLabelDe,
  POS_UI_COURSES,
} from "./course.ts";

describe("normalizePosOrderCourse", () => {
  it("maps legacy enum strings", () => {
    assert.equal(normalizePosOrderCourse("starter"), 1);
    assert.equal(normalizePosOrderCourse("main"), 2);
    assert.equal(normalizePosOrderCourse("dessert"), 3);
    assert.equal(normalizePosOrderCourse("side"), 2);
    assert.equal(normalizePosOrderCourse("drink"), 2);
    assert.equal(normalizePosOrderCourse("other"), 2);
  });

  it("accepts numeric strings and numbers", () => {
    assert.equal(normalizePosOrderCourse("1"), 1);
    assert.equal(normalizePosOrderCourse(3), 3);
    assert.equal(normalizePosOrderCourse(4), 4);
  });

  it("falls back to 2", () => {
    assert.equal(normalizePosOrderCourse(null), 2);
    assert.equal(normalizePosOrderCourse("nope"), 2);
    assert.equal(normalizePosOrderCourse(0), 2);
    assert.equal(normalizePosOrderCourse(-1), 2);
  });
});

describe("isPosOrderCourse", () => {
  it("accepts integers >= 1", () => {
    assert.equal(isPosOrderCourse(1), true);
    assert.equal(isPosOrderCourse(2), true);
    assert.equal(isPosOrderCourse(9), true);
    assert.equal(isPosOrderCourse(0), false);
    assert.equal(isPosOrderCourse("main"), false);
  });
});

describe("labels", () => {
  it("labels 1–3 and Gang N", () => {
    assert.equal(posOrderCourseLabelDe(1), "Vorspeise");
    assert.equal(posOrderCourseLabelDe(2), "Hauptgang");
    assert.equal(posOrderCourseLabelDe(3), "Dessert");
    assert.equal(posOrderCourseLabelDe(4), "Gang 4");
  });

  it("UI courses are 1–3", () => {
    assert.deepEqual([...POS_UI_COURSES], [1, 2, 3]);
  });
});
