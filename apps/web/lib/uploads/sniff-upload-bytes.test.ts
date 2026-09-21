import assert from "node:assert/strict";
import { test } from "node:test";

import { sanitizeSvgMarkup } from "@/lib/uploads/sanitize-svg";
import {
  prepareDeclaredUploadBytes,
  sniffUploadBytes,
} from "@/lib/uploads/sniff-upload-bytes";

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function ftyp(brand: string): Uint8Array {
  const out = new Uint8Array(16);
  out[3] = 16;
  out.set(bytesOf("ftyp"), 4);
  out.set(bytesOf(brand), 8);
  return out;
}

test("rejects HTML disguised as PDF or JPEG", () => {
  const html = bytesOf("<html><script>alert(1)</script></html>");
  assert.equal(prepareDeclaredUploadBytes(html, "application/pdf"), null);
  assert.equal(prepareDeclaredUploadBytes(html, "image/jpeg"), null);
  assert.equal(sniffUploadBytes(html), "html");
});

test("accepts real image, pdf, zip and text signatures", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const pdf = bytesOf("%PDF-1.7\n");
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
  assert.ok(prepareDeclaredUploadBytes(jpeg, "image/jpeg"));
  assert.equal(prepareDeclaredUploadBytes(png, "image/jpeg"), null);
  assert.ok(prepareDeclaredUploadBytes(pdf, "application/pdf"));
  assert.ok(
    prepareDeclaredUploadBytes(
      zip,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
  );
  assert.ok(prepareDeclaredUploadBytes(bytesOf("a,b\n1,2\n"), "text/csv"));
  assert.equal(
    prepareDeclaredUploadBytes(bytesOf("<table></table>"), "text/csv"),
    null,
  );
});

test("detects heif and does not treat ftyp as ico", () => {
  assert.equal(sniffUploadBytes(ftyp("heic")), "heif");
  assert.equal(sniffUploadBytes(ftyp("isom")), "mp4");
  assert.equal(sniffUploadBytes(ftyp("qt  ")), "quicktime");
  const sized = new Uint8Array(16);
  sized[2] = 1;
  sized.set(bytesOf("ftypisom"), 4);
  assert.equal(sniffUploadBytes(sized), "mp4");
});

test("sanitizes script and event handlers out of svg logos", () => {
  const raw =
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0h1v1z"/><script>alert(1)</script></svg>';
  const clean = sanitizeSvgMarkup(raw);
  assert.ok(clean);
  assert.equal(clean!.includes("<script"), false);
  assert.equal(clean!.includes("onload"), false);
  assert.equal(clean!.includes("<path"), true);
  const prepared = prepareDeclaredUploadBytes(bytesOf(raw), "image/svg+xml");
  assert.ok(prepared);
  assert.equal(new TextDecoder().decode(prepared!).includes("alert"), false);
});
