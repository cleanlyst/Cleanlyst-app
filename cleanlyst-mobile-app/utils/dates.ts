export function formatShortDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
