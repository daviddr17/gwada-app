import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brandAtelierBarMotifAt,
  brandMotifPreviewSvg,
  brandMotifSvg,
  brandSoireeFrameSvg,
  defaultDisplayFontForStyle,
  parseSocialDisplayFont,
  SOCIAL_DISPLAY_FONTS,
} from "./social-brand-visual-system";

describe("social-brand-visual-system", () => {
  it("parses display fonts and falls back from style", () => {
    assert.equal(parseSocialDisplayFont("tinos"), "tinos");
    assert.equal(parseSocialDisplayFont("nope", "fancy"), "tinos");
    assert.equal(parseSocialDisplayFont(null, "modern"), "public_sans");
    assert.equal(defaultDisplayFontForStyle("schlicht"), "inter");
    assert.ok(SOCIAL_DISPLAY_FONTS.includes("noto_serif"));
  });

  it("emits distinct motifs per stylePreset", () => {
    const styles = ["schlicht", "modern", "warm", "fancy", "fein"] as const;
    const editorial = styles.map((stylePreset) =>
      brandMotifSvg({
        stylePreset,
        accent: "#c4a574",
        secondary: "#8b7355",
        placement: "editorial_rule",
      }),
    );
    assert.equal(new Set(editorial).size, styles.length);
    assert.ok(editorial[1].includes("rect"));
    assert.ok(editorial[2].includes("path"));
    assert.ok(editorial[3].includes("L120"));

    const atelier = brandAtelierBarMotifAt("warm", "#c4a574", "#8b7355", 600);
    assert.ok(atelier.includes("600") || atelier.includes("602"));
    assert.ok(!atelier.includes("__Y"));

    const frame = brandSoireeFrameSvg({
      stylePreset: "fancy",
      accent: "#c4a574",
      secondary: "#8b7355",
    });
    assert.ok(frame.includes("path"));

    const preview = brandMotifPreviewSvg({
      stylePreset: "modern",
      accent: "#111",
      secondary: "#222",
    });
    assert.ok(preview.startsWith("<svg"));
  });
});
