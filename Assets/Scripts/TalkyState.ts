/**
 * TalkyState — pure lobby/room domain state for Talky.
 * Owns: 3-digit code, phase, voice mode, participants list, speaking flags.
 * Does not: scene objects, networking, audio playback.
 */

import {TALKY_DIGIT_COUNT, TALKY_MAX_PARTICIPANTS} from "./TalkyAssetManifest"

export type TalkyPhase = "lobby" | "connecting" | "in_room" | "room_full" | "error"

export type TalkyParticipant = {
  id: string
  name: string
  speaking: boolean
}

export class TalkyState {
  /** Fixed 3-digit room codes only. */
  readonly digitCount: number = TALKY_DIGIT_COUNT
  digits: number[] = [0, 4, 2]
  phase: TalkyPhase = "lobby"
  statusMessage: string = "Pick a room & tap GO"
  roomCode: string = ""
  localUserId: string = ""
  localDisplayName: string = "You"
  participants: TalkyParticipant[] = []
  lastError: string = ""

  bumpDigit(index: number, delta: number): void {
    if (index < 0 || index >= TALKY_DIGIT_COUNT) {
      return
    }
    const cur = this.digits[index]
    this.digits[index] = (cur + delta + 10) % 10
  }

  getCode(): string {
    return this.digits.map((d) => String(d)).join("")
  }

  setPhase(phase: TalkyPhase, status?: string): void {
    this.phase = phase
    if (status !== undefined) {
      this.statusMessage = status
    }
  }

  setParticipants(list: TalkyParticipant[]): void {
    this.participants = list.slice(0, TALKY_MAX_PARTICIPANTS)
  }

  participantCount(): number {
    return this.participants.length
  }

  isRoomFull(): boolean {
    return this.participants.length >= TALKY_MAX_PARTICIPANTS
  }
}
