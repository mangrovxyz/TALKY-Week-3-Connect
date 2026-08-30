/**
 * TalkyParticipantEmojis — stable emoji avatars for connected users.
 */

import {TalkyParticipant} from "./TalkyState"

export const PARTICIPANT_EMOJIS = ["👻", "🦊", "🐸", "🦄", "🐼", "🦁", "🐙", "🐤"] as const

export function emojiForParticipant(id: string, index: number = 0): string {
  let hash = index
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * 17) % PARTICIPANT_EMOJIS.length
  }
  return PARTICIPANT_EMOJIS[hash]
}

export function formatParticipantEmojiRow(list: TalkyParticipant[], localUserId: string = ""): string {
  if (!list || list.length === 0) {
    return "—"
  }
  let row = ""
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    const mark = p.id === localUserId ? "●" : ""
    row += emojiForParticipant(p.id, i) + mark
    if (i < list.length - 1) {
      row += "  "
    }
  }
  return row
}

export function formatParticipantSummary(list: TalkyParticipant[], max: number): string {
  const names = list.map((p) => p.name).join(", ")
  return `${list.length}/${max}` + (names ? ` · ${names}` : "")
}
