import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeApi } from "./server.mjs";

async function launch(file = ":memory:") {
  const server = makeApi(file, () => Date.parse("2026-11-19T12:15:00Z"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const call = (path, method = "GET", data) =>
    fetch("http://127.0.0.1:" + server.address().port + "/api/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const close = () => new Promise((resolve) => server.close(resolve));
  return { call, close };
}
test("tasks can be created, completed, reopened and removed", async (t) => {
  const { call, close } = await launch();
  t.after(close);
  const { id } = await (
    await call("tasks", "POST", { title: "  Review notes  " })
  ).json();
  for (const done of [true, false]) {
    assert.equal((await call("tasks/" + id, "PATCH", { done })).status, 200);
    assert.deepEqual((await (await call("agenda")).json()).tasks, [
      { id, title: "Review notes", done },
    ]);
  }
  assert.equal((await call("tasks/" + id, "DELETE")).status, 200);
  assert.equal((await call("tasks/" + id, "DELETE")).status, 404);
});
test("concurrent bookings reserve once, then cancellation releases the slot", async (t) => {
  const { call, close } = await launch();
  t.after(close);
  const agenda = await (await call("agenda")).json();
  const data = { room: agenda.rooms[0], at: agenda.slots[0] };
  const responses = await Promise.all([
    call("bookings", "POST", data),
    call("bookings", "POST", data),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const { bookings } = await (await call("agenda")).json();
  assert.equal(bookings.length, 1);
  assert.equal(
    (await call("bookings/" + bookings[0].id, "DELETE")).status,
    200,
  );
  assert.equal((await call("bookings", "POST", data)).status, 201);
});
test("invalid inputs cannot create tasks or bookings", async (t) => {
  const { call, close } = await launch();
  t.after(close);
  for (const title of ["", null, 123, "a".repeat(121)])
    assert.equal((await call("tasks", "POST", { title })).status, 400);
  assert.equal((await call("tasks/1", "PATCH", { done: "yes" })).status, 400);
  assert.equal(
    (await call("bookings", "POST", { room: "Studio A", at: "2020-01-01" }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("bookings", "POST", {
        room: "Unknown",
        at: "2026-11-19T14:00:00.000Z",
      })
    ).status,
    400,
  );
});
test("agenda survives a server restart", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "daymark-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "test.sqlite"),
    first = await launch(file);
  try {
    await first.call("tasks", "POST", { title: "Persistent task" });
  } finally {
    await first.close();
  }
  const second = await launch(file);
  t.after(second.close);
  assert.equal(
    (await (await second.call("agenda")).json()).tasks[0].title,
    "Persistent task",
  );
});
