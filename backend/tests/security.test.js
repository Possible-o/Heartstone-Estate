const { test } = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:3000";

test("Unauthenticated visitors cannot access the admin dashboard", async () => {
  const response = await fetch(`${BASE_URL}/admin`, {
    redirect: "manual",
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") || "", /admin-login/);
});

test("Admin HTML route requires authentication", async () => {
  const response = await fetch(`${BASE_URL}/admin.html`, {
    redirect: "manual",
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") || "", /admin-login/);
});

test("Protected admin API rejects unauthenticated requests", async () => {
  const response = await fetch(`${BASE_URL}/api/admin/inspections`);

  assert.equal(response.status, 401);
});

test("Session API rejects unauthenticated visitors", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/session`);

  assert.equal(response.status, 401);
});

test("Login API rejects requests from an untrusted origin", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({
      email: "test@example.com",
      password: "InvalidPassword123!",
    }),
  });

  assert.equal(response.status, 403);
});
test("Login API rejects requests without an Origin header", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "test@example.com",
      password: "InvalidPassword123!",
    }),
  });

  assert.equal(response.status, 403);
});

test("Unauthenticated visitors cannot refresh session activity", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/activity`, {
    method: "POST",
    headers: {
      Origin: BASE_URL,
    },
  });

  assert.equal(response.status, 401);
});
