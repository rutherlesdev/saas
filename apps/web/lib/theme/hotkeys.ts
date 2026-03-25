export type ThemeHotkeyEvent = Pick<
  KeyboardEvent,
  "defaultPrevented" | "repeat" | "metaKey" | "ctrlKey" | "altKey" | "key" | "code"
>

export function matchesThemeHotkey(event: ThemeHotkeyEvent) {
  if (event.defaultPrevented || event.repeat) {
    return false
  }

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }

  const key = typeof event.key === "string" ? event.key.toLowerCase() : ""
  const code = typeof event.code === "string" ? event.code : ""

  return key === "d" || code === "KeyD"
}
