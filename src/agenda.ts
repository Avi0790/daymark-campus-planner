import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { readCache, writeCache } from "./cache";

export type Task = { id: number; title: string; done: boolean };
export type Booking = { id: number; room: string; at: string };
type Agenda = {
  tasks: Task[];
  bookings: Booking[];
  rooms: string[];
  slots: string[];
};
const base = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");
class ApiError extends Error {}
async function request(path: string, method = "GET", body?: object) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(base + "/api" + path, {
      method,
      signal: controller.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error || "Request failed.");
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export function useAgenda() {
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [stamp, setStamp] = useState("");
  const locked = useRef(false);
  async function sync() {
    const data: Agenda = await request("/agenda");
    const time = new Date().toISOString();
    setAgenda(data);
    setOnline(true);
    setStamp(time);
    try {
      writeCache(JSON.stringify({ base, data, time }));
    } catch {
      setMessage("Device storage unavailable. This view is online only.");
    }
  }
  async function run(path?: string, method?: string, body?: object) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setMessage("");
    let saved = false;
    try {
      if (path) {
        await request(path, method, body);
        saved = true;
      }
      await sync();
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage(err.message);
        try {
          await sync();
        } catch {
          setOnline(false);
        }
      } else {
        setOnline(false);
        setMessage(
          saved
            ? "Saved. Refresh to see the updated agenda."
            : path
              ? "Connection lost. Refresh to check whether the change was saved."
              : "API unavailable. Reconnect and tap Refresh.",
        );
      }
      return saved;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await readCache();
        const cached = raw ? JSON.parse(raw) : null;
        if (
          active &&
          cached?.base === base &&
          Array.isArray(cached.data?.slots)
        ) {
          setAgenda(cached.data);
          setStamp(cached.time);
        }
      } catch {}
      if (active) void run();
    })();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return { agenda, online, busy, message, stamp, run };
}
