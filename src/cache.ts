import { File, Paths } from "expo-file-system";
const file = new File(Paths.document, "daymark-agenda-v1.json");
export async function readCache() {
  return file.exists ? file.text() : null;
}
export function writeCache(value: string) {
  file.write(value);
}
