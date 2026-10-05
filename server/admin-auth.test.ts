import assert from "node:assert/strict";
import test from "node:test";
import { isAdminRequest } from "./admin-auth";

test("development loopback admin does not need a password", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    assert.equal(isAdminRequest({ hostname: "127.0.0.1", socket: { remoteAddress: "::ffff:127.0.0.1" }, headers: {} }), true);
    assert.equal(isAdminRequest({ hostname: "localhost", socket: { remoteAddress: "::1" }, headers: {} }), true);
    assert.equal(isAdminRequest({ hostname: "puerpub.replit.app", socket: { remoteAddress: "127.0.0.1" }, headers: {} }), false);
    assert.equal(isAdminRequest({ hostname: "localhost", socket: { remoteAddress: "192.0.2.10" }, headers: {} }), false);
    assert.equal(isAdminRequest({ hostname: "localhost", socket: { remoteAddress: "127.0.0.1" }, headers: { origin: "https://other.example" } }), false);
    assert.equal(isAdminRequest({ hostname: "localhost", socket: { remoteAddress: "127.0.0.1" }, headers: { origin: "http://localhost:5173" } }), true);
    assert.equal(isAdminRequest({ hostname: "localhost", socket: { remoteAddress: "127.0.0.1" }, headers: { "sec-fetch-site": "cross-site" } }), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("production loopback admin still needs a password", () => {
  const previousMode = process.env.NODE_ENV;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.NODE_ENV = "production";
  process.env.ADMIN_PASSWORD = "test-secret";
  try {
    const request = { hostname: "localhost", socket: { remoteAddress: "127.0.0.1" }, headers: {} as Record<string, unknown> };
    assert.equal(isAdminRequest(request), false);
    request.headers["x-admin-password"] = "test-secret";
    assert.equal(isAdminRequest(request), true);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});
