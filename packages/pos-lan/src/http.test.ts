import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jsonHttpResponse,
  serializeHttpResponse,
  tryParseHttpRequest,
} from "./http";

describe("tryParseHttpRequest", () => {
  it("parses a GET without body", () => {
    const raw = "GET /v1/health HTTP/1.1\r\nHost: 192.168.1.10\r\n\r\n";
    const parsed = tryParseHttpRequest(raw);
    assert.ok(parsed);
    assert.equal(parsed.request.method, "GET");
    assert.equal(parsed.request.path, "/v1/health");
    assert.equal(parsed.consumed, raw.length);
  });

  it("waits for full body", () => {
    const body = '{"a":1}';
    const partial =
      `POST /v1/x HTTP/1.1\r\nContent-Length: ${body.length}\r\n\r\n{`;
    assert.equal(tryParseHttpRequest(partial), null);
    const full = `POST /v1/x HTTP/1.1\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
    const parsed = tryParseHttpRequest(full);
    assert.ok(parsed);
    assert.equal(parsed!.request.body, body);
  });
});

describe("serializeHttpResponse", () => {
  it("sets content-length for utf-8 body", () => {
    const raw = serializeHttpResponse(jsonHttpResponse(200, { ok: true }));
    assert.match(raw, /^HTTP\/1\.1 200 OK\r\n/);
    assert.match(raw, /content-length: \d+/i);
    assert.match(raw, /\r\n\r\n\{"ok":true\}$/);
  });
});
