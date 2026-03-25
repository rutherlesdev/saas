import { describe, expect, it } from "vitest"

import { matchesThemeHotkey, type ThemeHotkeyEvent } from "@/lib/theme/hotkeys"

function createEvent(overrides: Partial<ThemeHotkeyEvent> = {}): ThemeHotkeyEvent {
  return {
    defaultPrevented: false,
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    key: "",
    code: "",
    ...overrides,
  }
}

describe("matchesThemeHotkey", () => {
  it("matches the D key without modifiers", () => {
    expect(matchesThemeHotkey(createEvent({ key: "d" }))).toBe(true)
    expect(matchesThemeHotkey(createEvent({ key: "D" }))).toBe(true)
  })

  it("falls back to code when key is unavailable", () => {
    expect(
      matchesThemeHotkey(
        createEvent({
          key: undefined,
          code: "KeyD",
        }),
      ),
    ).toBe(true)
  })

  it("ignores unrelated keys and modifier shortcuts", () => {
    expect(matchesThemeHotkey(createEvent({ key: "x" }))).toBe(false)
    expect(matchesThemeHotkey(createEvent({ key: "d", ctrlKey: true }))).toBe(false)
  })
})
