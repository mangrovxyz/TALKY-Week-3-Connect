/**
 * TalkyTheme — bright yellow playful palette; all UI copy is pure white for Specs legibility.
 */

import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

/** Primary sunny yellow (RGBA 0–1). */
export const TALKY_YELLOW = new vec4(1.0, 0.92, 0.18, 1.0)
/** Deeper amber accent for pressed/hover states. */
export const TALKY_YELLOW_DEEP = new vec4(0.98, 0.78, 0.05, 1.0)
/** Soft cream panel fill. */
export const TALKY_CREAM = new vec4(1.0, 0.98, 0.88, 0.96)
/** @deprecated Use TALKY_WHITE for all on-panel labels. */
export const TALKY_INK = new vec4(1.0, 1.0, 1.0, 1.0)
/** Pure white — default for every UI string on yellow panels. */
export const TALKY_WHITE = new vec4(1.0, 1.0, 1.0, 1.0)
/** Accent colors kept for non-text visuals only (icons, fills). */
export const TALKY_CONNECTED = new vec4(0.15, 0.85, 0.35, 1.0)
/** @deprecated All caption text uses TALKY_WHITE. */
export const TALKY_INK_SOFT = TALKY_WHITE
/** @deprecated Status text uses TALKY_WHITE (bold when live). */
export const TALKY_LIVE = TALKY_WHITE

/** Compact Spectacles-friendly panel defaults (cm). */
export const TALKY_PANEL_LOBBY_W = 10
export const TALKY_PANEL_ROOM_W = 11
export const TALKY_PANEL_ROOM_H = 9
export const TALKY_PANEL_CHAT_W = 9
export const TALKY_PANEL_CHAT_H = 7
export const TALKY_PANEL_ONBOARD_W = 12
export const TALKY_PANEL_ONBOARD_H = 13

export function setTextColor(t: Text, color: vec4): void {
  t.textFill.mode = TextFillMode.Solid
  t.textFill.color = color
}

/** Apply white label styling — bold optional for emphasis (LIVE, titles). */
export function applyTalkyText(t: Text, roleSize: number, bold: boolean = false): void {
  t.size = roleSize
  t.weight = bold ? 700 : 500
  t.depthTest = false
  setTextColor(t, TALKY_WHITE)
}

/** Message / body copy — white, wrapped, readable on yellow panels. */
export function applySpokaBodyText(t: Text, roleSize: number, bold: boolean = false): void {
  applyTalkyText(t, roleSize, bold)
  t.horizontalOverflow = HorizontalOverflow.Wrap
  t.verticalOverflow = VerticalOverflow.Overflow
  t.lineSpacing = 1.05
  t.horizontalAlignment = HorizontalAlignment.Left
}

/** Set Text bounding rect so FlexLayout keeps copy inside the panel (cm). */
export function setMessageTextRect(t: Text, widthCm: number, heightCm: number): void {
  const rect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  const extended = t as Text & {layoutRect?: Rect}
  if (extended.layoutRect !== undefined) {
    extended.layoutRect = rect
  } else {
    t.worldSpaceRect = rect
  }
}

/** Word-wrap plain text for compact multi-line display inside the panel. */
export function wrapTextBlock(text: string, maxCharsPerLine: number, maxLines: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length === 0) {
    return ""
  }
  const words = cleaned.split(" ")
  const lines: string[] = []
  let current = ""
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const candidate = current.length === 0 ? word : current + " " + word
    if (candidate.length > maxCharsPerLine && current.length > 0) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
    if (lines.length >= maxLines) {
      break
    }
  }
  if (lines.length < maxLines && current.length > 0) {
    lines.push(current)
  }
  if (lines.length >= maxLines) {
    const last = lines[maxLines - 1]
    if (last.length > maxCharsPerLine - 1) {
      lines[maxLines - 1] = last.substring(0, Math.max(0, maxCharsPerLine - 1)) + "…"
    }
  }
  return lines.join("\n")
}

/** Force UIKit ElementContent button labels to pure white (default is ~85% gray). */
export function styleElementContentWhite(ec: ElementContent, textSize?: number): void {
  if (textSize !== undefined) {
    ec.textSize = textSize
  }
  const internal = ec as unknown as {
    _useTextColorOverride: boolean
    _textColorOverride: vec4
  }
  internal._useTextColorOverride = true
  internal._textColorOverride = TALKY_WHITE
}

/** Walk a subtree and force every Text component to white (post-layout safety net). */
export function whitenTextsUnder(root: SceneObject): void {
  const stack: SceneObject[] = [root]
  while (stack.length > 0) {
    const so = stack.pop()!
    const text = so.getComponent("Component.Text") as Text
    if (text) {
      setTextColor(text, TALKY_WHITE)
    }
    const n = so.getChildrenCount()
    for (let i = 0; i < n; i++) {
      stack.push(so.getChild(i))
    }
  }
}
