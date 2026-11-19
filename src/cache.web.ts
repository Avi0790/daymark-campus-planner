const key = "daymark-agenda-v1";
export async function readCache() {
  return localStorage.getItem(key);
}
export function writeCache(value: string) {
  localStorage.setItem(key, value);
}
