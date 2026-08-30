/**
 * TalkyAssetManifest — stable paths and room constants for the Talky walkie experience.
 * Owns: asset path contracts, max room size, channel naming.
 * Does not: runtime networking or UI.
 */

export const TALKY_MAX_PARTICIPANTS = 8
/** Room codes are always exactly 3 digits. */
export const TALKY_DIGIT_COUNT = 3
export const TALKY_CHANNEL_PREFIX = "walkie-"

export function talkyChannelName(code: string): string {
  return `${TALKY_CHANNEL_PREFIX}${code}`
}

export const TalkyMeshes = {
  WalkieDevice: "../GeneratedMeshes/WalkieDevice.glb",
  TransmitBeacon: "../GeneratedMeshes/TransmitBeacon.glb",
} as const

export const TalkyMic = "../Audio/TalkyMic.micaudio" as const

export const TalkySfx = {
  ButtonClick: "../GeneratedSFX/ButtonClick.wav",
  DialTick: "../GeneratedSFX/DialTick.wav",
  RoomJoin: "../GeneratedSFX/RoomJoin.wav",
  RoomLeave: "../GeneratedSFX/RoomLeave.wav",
  TransmitStart: "../GeneratedSFX/TransmitStart.wav",
  Wizz: "../GeneratedSFX/Wizz.wav",
  Applause: "../GeneratedSFX/Applause.wav",
  Doorbell: "../GeneratedSFX/Doorbell.wav",
  Laugh: "../GeneratedSFX/Laugh.wav",
  Boo: "../GeneratedSFX/Boo.wav",
  Airhorn: "../GeneratedSFX/Airhorn.wav",
  Heart: "../GeneratedSFX/Heart.wav",
} as const

export type TalkyReactionId =
  | "wizz"
  | "applause"
  | "doorbell"
  | "laugh"
  | "boo"
  | "airhorn"
  | "heart"

export const TalkyReactionList: {
  id: TalkyReactionId
  label: string
  emoji: string
  sfxKey: keyof typeof TalkySfx
  icon: string
}[] = [
  {id: "wizz", label: "Wizz", emoji: "⚡", sfxKey: "Wizz", icon: "phone_in_talk"},
  {id: "applause", label: "Clap", emoji: "👏", sfxKey: "Applause", icon: "celebration"},
  {id: "doorbell", label: "Ding", emoji: "🔔", sfxKey: "Doorbell", icon: "door_front"},
  {id: "laugh", label: "Ha!", emoji: "😂", sfxKey: "Laugh", icon: "theater_comedy"},
  {id: "boo", label: "Boo", emoji: "👎", sfxKey: "Boo", icon: "sentiment_very_dissatisfied"},
  {id: "airhorn", label: "Horn", emoji: "📣", sfxKey: "Airhorn", icon: "campaign"},
  {id: "heart", label: "Love", emoji: "❤", sfxKey: "Heart", icon: "favorite"},
]

/** WalkieDevice / toy radio body AABB (cm @ 100x import). */
export const ToyRadioAabbCm = {x: 11.1, y: 18.0, z: 6.8, cx: 0, cy: 9.0, cz: 0}
/** TransmitBeacon AABB after normalize (cm @ 100x import). */
export const TransmitBeaconAabbCm = {x: 3.5, y: 8.0, z: 3.2, cx: 0, cy: 4.0, cz: 0}
