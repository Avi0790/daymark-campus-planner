import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAgenda, type Task } from "./src/agenda";

const green = "#174838",
  ink = "#172f28",
  muted = "#50655a",
  paper = "#f7f5eb",
  mint = "#d8e7be";
const tabs = ["Agenda", "Tasks", "Book"] as const;
type Tab = (typeof tabs)[number];
const when = (at: string) =>
  new Date(at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  web: "Georgia",
});

function Button({
  title,
  onPress,
  disabled = false,
  selected = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        selected && s.selected,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[s.buttonText, selected && { color: "white" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Head({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
function confirmRemoval(title: string, action: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm(title)) action();
  } else
    Alert.alert(title, undefined, [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: action },
    ]);
}
function Planner() {
  const [tab, setTab] = useState<Tab>("Agenda"),
    [title, setTitle] = useState("");
  const [room, setRoom] = useState("Studio A"),
    [at, setAt] = useState("");
  const { agenda, online, busy, message, stamp, run } = useAgenda();
  const disabled = busy || !online;
  const tasks = agenda?.tasks || [],
    bookings = agenda?.bookings || [],
    open = tasks.filter((t) => !t.done);
  const next = bookings[0];
  const slots = (agenda?.slots || []).filter(
    (time) =>
      Date.parse(time) > Date.now() &&
      !bookings.some((b) => b.room === room && b.at === time),
  );
  const taskRow = (t: Task) => (
    <View key={t.id} style={s.row}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={t.done}
        accessibilityLabel={t.title}
        accessibilityState={{ checked: t.done, disabled }}
        disabled={disabled}
        style={s.checkRow}
        onPress={() => void run("/tasks/" + t.id, "PATCH", { done: !t.done })}
      >
        <Text style={s.box}>{t.done ? "☑" : "□"}</Text>
        <Text
          style={[
            s.rowTitle,
            t.done && { textDecorationLine: "line-through", color: muted },
          ]}
        >
          {t.title}
        </Text>
      </Pressable>
      {tab === "Tasks" && (
        <Button
          title="Delete"
          disabled={disabled}
          onPress={() =>
            confirmRemoval(
              "Delete this task?",
              () => void run("/tasks/" + t.id, "DELETE"),
            )
          }
        />
      )}
    </View>
  );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.page}>
        <View style={s.top}>
          <Text style={s.brand}>◉ DAYMARK</Text>
          <Button
            title={busy ? "Syncing…" : "Refresh"}
            disabled={busy}
            onPress={() => void run()}
          />
        </View>
        <ScrollView
          key={tab}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.body}
        >
          <Head>
            {new Date()
              .toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
              .toUpperCase()}
          </Head>
          <Text accessibilityRole="header" style={s.title}>
            {tab === "Agenda"
              ? "Your day"
              : tab === "Tasks"
                ? "Your tasks"
                : "Book a room"}
          </Text>
          {!online && (
            <Text style={s.notice}>
              {stamp
                ? "Cached agenda · " + when(stamp)
                : busy
                  ? "Connecting to your planner…"
                  : "Connect to the API for your first sync."}
            </Text>
          )}
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={s.notice}>
              {message}
            </Text>
          )}
          {tab === "Agenda" && (
            <>
              <View style={s.hero}>
                <Text style={s.heroLabel}>NEXT RESERVATION</Text>
                <Text style={s.heroTitle}>
                  {next ? next.room : "Room to focus"}
                </Text>
                <Text style={s.heroDetail}>
                  {next
                    ? when(next.at)
                    : "Reserve an hour for your next study session."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={s.heroLink}
                  onPress={() => setTab("Book")}
                >
                  <Text style={s.heroAction}>Book a room ↗</Text>
                </Pressable>
              </View>
              <View style={s.heading}>
                <Head>OPEN TASKS · {open.length}</Head>
                <Button title="Manage tasks" onPress={() => setTab("Tasks")} />
              </View>
              {open.length ? (
                open.slice(0, 3).map(taskRow)
              ) : (
                <Text style={s.detail}>No open tasks.</Text>
              )}
              <Head>UPCOMING BOOKINGS · {bookings.length}</Head>
              {bookings.map((b) => (
                <View key={b.id} style={s.row}>
                  <View style={s.grow}>
                    <Text style={s.rowTitle}>{b.room}</Text>
                    <Text style={s.detail}>{when(b.at)}</Text>
                  </View>
                  <Button
                    title="Cancel"
                    disabled={disabled}
                    onPress={() =>
                      confirmRemoval(
                        "Cancel this reservation?",
                        () => void run("/bookings/" + b.id, "DELETE"),
                      )
                    }
                  />
                </View>
              ))}
              {!bookings.length && (
                <Text style={s.detail}>
                  Your reservations will appear here.
                </Text>
              )}
            </>
          )}
          {tab === "Tasks" && (
            <>
              <Head>NEW TASK</Head>
              <TextInput
                accessibilityLabel="Task title"
                placeholder="What needs to get done?"
                placeholderTextColor={muted}
                style={s.input}
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />
              <Button
                title="Add task"
                selected
                disabled={disabled || !title.trim()}
                onPress={async () => {
                  if (await run("/tasks", "POST", { title })) setTitle("");
                }}
              />
              {([false, true] as const).map((done) => (
                <View key={String(done)} style={s.group}>
                  <Head>
                    {done ? "COMPLETE" : "OPEN"} ·{" "}
                    {tasks.filter((t) => t.done === done).length}
                  </Head>
                  {tasks.filter((t) => t.done === done).map(taskRow)}
                </View>
              ))}
            </>
          )}
          {tab === "Book" && (
            <>
              <Head>STUDY ROOM</Head>
              <View style={s.wrap}>
                {agenda?.rooms.map((r) => (
                  <Button
                    key={r}
                    selected={r === room}
                    title={r}
                    onPress={() => {
                      setRoom(r);
                      setAt("");
                    }}
                  />
                ))}
              </View>
              <Head>AVAILABLE TIMES · 1 HOUR EACH</Head>
              <Text style={s.detail}>Shown in your local time.</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                contentContainerStyle={s.strip}
              >
                {slots.map((time) => (
                  <Button
                    key={time}
                    title={when(time)}
                    selected={at === time}
                    onPress={() => setAt(time)}
                  />
                ))}
              </ScrollView>
              {!slots.length && (
                <Text style={s.detail}>No available times to show.</Text>
              )}
              <View style={s.hero}>
                <Text style={s.heroLabel}>RESERVATION</Text>
                <Text style={s.heroTitle}>{room}</Text>
                <Text style={s.heroDetail}>
                  {at && slots.includes(at)
                    ? when(at)
                    : "Choose an available time above."}
                </Text>
              </View>
              <Button
                title="Confirm booking"
                selected
                disabled={disabled || !slots.includes(at)}
                onPress={async () => {
                  if (await run("/bookings", "POST", { room, at })) {
                    setAt("");
                    setTab("Agenda");
                  }
                }}
              />
            </>
          )}
        </ScrollView>
        <View style={s.nav}>
          {tabs.map((t, i) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: t === tab }}
              key={t}
              style={[s.navItem, t === tab && { backgroundColor: mint }]}
              onPress={() => setTab(t)}
            >
              <Text style={s.navIcon}>{["◷", "☷", "▦"][i]}</Text>
              <Text style={s.navText}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Planner />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: paper },
  page: { flex: 1, width: "100%", maxWidth: 640, alignSelf: "center" },
  top: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#d8dbcf",
  },
  brand: { fontSize: 17, fontWeight: "800", letterSpacing: 2, color: green },
  body: { padding: 22, gap: 14, paddingBottom: 42 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: muted },
  title: { fontSize: 46, fontFamily: serif, color: ink, marginBottom: 4 },
  hero: { backgroundColor: green, padding: 24, borderRadius: 18, gap: 10 },
  heroLabel: { color: mint, fontWeight: "700", fontSize: 11, letterSpacing: 2 },
  heroTitle: { color: paper, fontFamily: serif, fontSize: 34 },
  heroDetail: { color: "#e3ecdd", fontSize: 16 },
  heroLink: { alignSelf: "flex-start", paddingVertical: 11 },
  heroAction: { color: mint, fontWeight: "700" },
  button: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#e8eade",
  },
  selected: { backgroundColor: green },
  buttonText: { fontSize: 14, fontWeight: "600", color: green },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#d9dccf",
  },
  rowTitle: { color: ink, fontSize: 17, flexShrink: 1 },
  detail: { fontSize: 15, color: muted, lineHeight: 22 },
  grow: { flex: 1 },
  checkRow: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 44,
  },
  box: { color: green, fontSize: 27 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  group: { gap: 9, marginTop: 8 },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#bdc8b9",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: ink,
  },
  wrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  strip: { gap: 8, paddingBottom: 6 },
  notice: {
    color: "#694a17",
    backgroundColor: "#f4e7c6",
    padding: 10,
    borderRadius: 8,
  },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#d6dbcc",
    padding: 8,
    gap: 6,
  },
  navItem: { flex: 1, alignItems: "center", padding: 7, borderRadius: 12 },
  navIcon: { fontSize: 23, color: green },
  navText: { color: green, fontSize: 13, fontWeight: "600" },
});
