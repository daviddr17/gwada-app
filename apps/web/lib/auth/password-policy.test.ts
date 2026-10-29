import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getPasswordStrengthLevel,
  getPasswordStrengthScore,
  passwordMeetsPolicy,
  passwordStrengthBarWidth,
  passwordStrengthLabel,
} from "./password-policy.ts";

test("getPasswordStrengthScore grows with length and character classes", () => {
  assert.equal(getPasswordStrengthScore(""), 0);
  assert.equal(getPasswordStrengthScore("abc"), 1); // lower only
  assert.equal(getPasswordStrengthScore("abcdefgh"), 2); // length≥8 + lower
  assert.equal(getPasswordStrengthScore("Abcdefgh1!"), 5); // ≥8 + 4 classes
  assert.equal(getPasswordStrengthScore("Abcdefghij1!"), 6); // ≥12 + 4 classes
});

test("getPasswordStrengthLevel maps score to weak/medium/strong", () => {
  assert.equal(getPasswordStrengthLevel("a"), "weak");
  assert.equal(getPasswordStrengthLevel("abcdefgh"), "weak"); // score 2
  assert.equal(getPasswordStrengthLevel("Abcdefgh"), "medium"); // ≥8 + lower + upper
  assert.equal(getPasswordStrengthLevel("Abcdefgh1!"), "strong");
  assert.equal(passwordStrengthLabel("weak"), "Schwach");
  assert.equal(passwordStrengthLabel("medium"), "Mittel");
  assert.equal(passwordStrengthLabel("strong"), "Stark");
});

test("passwordStrengthBarWidth is smooth between partial and 100%", () => {
  assert.equal(passwordStrengthBarWidth(""), "0%");
  assert.equal(passwordStrengthBarWidth("a"), "17%"); // score 1 / 6
  assert.equal(passwordStrengthBarWidth("Abcdefgh1!"), "83%"); // score 5
  assert.equal(passwordStrengthBarWidth("Abcdefghij1!"), "100%"); // score 6
});

test("passwordMeetsPolicy still requires all four classes and length", () => {
  assert.equal(passwordMeetsPolicy("short1!"), false);
  assert.equal(passwordMeetsPolicy("abcdefgh1!"), false); // missing upper
  assert.equal(passwordMeetsPolicy("Abcdefgh1!"), true);
});
