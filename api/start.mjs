import { makeApi } from "./server.mjs";
import { mkdirSync } from "node:fs";
mkdirSync("data", { recursive: true });
const port = Number(process.env.PORT || 4000);
makeApi("data/daymark.sqlite").listen(port, "0.0.0.0", () =>
  console.log("Daymark API listening on port", port),
);
