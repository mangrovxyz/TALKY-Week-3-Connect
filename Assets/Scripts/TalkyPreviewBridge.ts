/**
 * TalkyPreviewBridge — Connected Lens session messaging for dual-preview / offline fallback.
 * Used when Snap Cloud is unavailable or slow; syncs reactions, voice chunks, chat via sendMessage.
 */

import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyReactionId} from "./TalkyAssetManifest"
import {TalkyChatMessage, TalkyVoiceChunkPayload} from "./TalkyCloudController"
import {TalkyParticipant} from "./TalkyState"

type PreviewEnvelope = {
  t: string
  r: string
  p: unknown
}

const MAX_PENDING = 48
const HEARTBEAT_SEC = 2.5

@component
export class TalkyPreviewBridge extends BaseScriptComponent {
  @ui.label('<span style="color: #A78BFA;">TalkyPreviewBridge – Connected Lens transport</span>')
  @ui.separator

  @input
  enableDebugLogs: boolean = true

  readonly onJoined = new Event<{code: string; participants: TalkyParticipant[]}>()
  readonly onLeft = new Event<void>()
  readonly onParticipantsChanged = new Event<TalkyParticipant[]>()
  readonly onReaction = new Event<{id: TalkyReactionId; from: string; name: string}>()
  readonly onVoiceChunk = new Event<TalkyVoiceChunkPayload>()
  readonly onChatMessage = new Event<TalkyChatMessage>()
  readonly onSpeakingChanged = new Event<string>()
  readonly onStatus = new Event<string>()
  readonly onSessionAttached = new Event<void>()

  private session: MultiplayerSession | null = null
  private currentCode: string = ""
  private inRoom: boolean = false
  /** Unique per preview panel — CL userId is shared in dual-preview on one machine. */
  private instanceId: string = ""
  private localUserId: string = "preview-local"
  private localName: string = "Preview User"
  private pendingOutbox: string[] = []
  private heartbeat: DelayedCallbackEvent | null = null

  onAwake(): void {
    this.instanceId = "pv-" + Date.now() + "-" + Math.floor(Math.random() * 99999)
    this.createEvent("OnDestroyEvent").bind(() => {
      this.stopHeartbeat()
    })
  }

  private log(msg: string): void {
    if (this.enableDebugLogs) {
      print(`[TalkyPreview] ${msg}`)
    }
  }

  setSession(session: MultiplayerSession | null): void {
    this.session = session
    if (session) {
      this.log("Connected Lens session attached")
      session.getLocalUserInfo((local) => {
        if (local.displayName && local.displayName.length > 0) {
          this.localName = local.displayName
        }
        this.log(`local CL user ${this.localName} (${local.userId}) inst=${this.instanceId}`)
        this.onSessionAttached.invoke()
        if (this.inRoom) {
          this.announcePresence()
          this.flushPending()
        }
        this.refreshParticipants()
      })
      if (this.inRoom) {
        this.announcePresence()
        this.flushPending()
      }
      this.refreshParticipants()
      this.startHeartbeat()
    } else if (this.inRoom) {
      this.stopHeartbeat()
      this.onStatus.invoke("Preview room active · waiting for Connected Lens session")
    }
  }

  setLocalIdentity(userId: string, name: string): void {
    this.localUserId = userId
    this.localName = name
  }

  isInRoom(): boolean {
    return this.inRoom && this.currentCode.length > 0
  }

  hasSession(): boolean {
    return !!this.session
  }

  getRoomCode(): string {
    return this.currentCode
  }

  getLocalUserId(): string {
    return this.localUserId
  }

  getLocalName(): string {
    return this.localName
  }

  joinRoom(code: string): void {
    this.currentCode = code
    this.inRoom = true
    this.log(`joined room ${code} via preview transport`)
    this.onStatus.invoke(`Preview connected · room ${code}`)
    const list = this.buildParticipantsSync()
    this.onJoined.invoke({code, participants: list})
    this.onParticipantsChanged.invoke(list)
    this.announcePresence()
    this.flushPending()
    this.startHeartbeat()
  }

  leaveRoom(): void {
    if (!this.inRoom) {
      return
    }
    this.log(`left room ${this.currentCode}`)
    this.inRoom = false
    this.currentCode = ""
    this.pendingOutbox = []
    this.stopHeartbeat()
    this.onLeft.invoke()
    this.onStatus.invoke("Left preview room")
  }

  private startHeartbeat(): void {
    if (!this.inRoom) {
      return
    }
    if (!this.heartbeat) {
      this.heartbeat = this.createEvent("DelayedCallbackEvent")
      this.heartbeat.bind(() => {
        if (this.inRoom) {
          this.announcePresence()
          this.refreshParticipants()
          if (this.heartbeat) {
            this.heartbeat.reset(HEARTBEAT_SEC)
          }
        }
      })
    }
    this.heartbeat.reset(HEARTBEAT_SEC)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      this.heartbeat.enabled = false
    }
  }

  private announcePresence(): void {
    this.sendEnvelope("presence", {
      userId: this.localUserId,
      name: this.localName,
    })
  }

  handleSessionMessage(userId: string, message: string, senderName: string): void {
    if (!this.inRoom) {
      return
    }
    let parsed: PreviewEnvelope
    try {
      parsed = JSON.parse(message) as PreviewEnvelope
    } catch (_e) {
      return
    }
    if (!parsed || parsed.r !== this.currentCode) {
      if (parsed && parsed.t === "chat-msg") {
        this.log(`RX chat dropped — room mismatch want=${this.currentCode} got=${parsed.r}`)
      }
      return
    }
    this.log(`RX ${parsed.t} from ${senderName || userId}`)

    switch (parsed.t) {
      case "presence":
        this.refreshParticipants()
        break
      case "reaction": {
        const p = parsed.p as {id: TalkyReactionId; from: string; name: string}
        if (p && p.id && p.from !== this.localUserId) {
          this.onReaction.invoke(p)
        }
        break
      }
      case "voice-chunk": {
        const p = parsed.p as TalkyVoiceChunkPayload
        if (p && p.data && p.userId !== this.localUserId) {
          this.onVoiceChunk.invoke(p)
          this.onSpeakingChanged.invoke(p.userId)
        }
        break
      }
      case "speaking": {
        const p = parsed.p as {userId: string; speaking: boolean}
        if (p && p.userId && p.userId !== this.localUserId) {
          this.onSpeakingChanged.invoke(p.speaking ? p.userId : "")
        }
        break
      }
      case "chat-msg": {
        const p = parsed.p as TalkyChatMessage & {instanceId?: string}
        const fromOther =
          p &&
          p.text &&
          (p.instanceId ? p.instanceId !== this.instanceId : p.userId !== this.localUserId)
        if (fromOther) {
          this.onChatMessage.invoke(p)
        }
        break
      }
    }
  }

  onUserJoinedSession(): void {
    if (this.inRoom) {
      this.refreshParticipants()
      this.announcePresence()
    }
  }

  onUserLeftSession(): void {
    if (this.inRoom) {
      this.refreshParticipants()
    }
  }

  private buildParticipantsSync(): TalkyParticipant[] {
    const list: TalkyParticipant[] = []
    const seen = new Set<string>()

    if (this.session) {
      const externals = this.session.activeUsersInfo
      for (let i = 0; i < externals.length; i++) {
        const u = externals[i]
        if (!seen.has(u.userId)) {
          seen.add(u.userId)
          list.push({id: u.userId, name: u.displayName || "Friend", speaking: false})
        }
      }
    }

    if (!seen.has(this.localUserId)) {
      list.unshift({id: this.localUserId, name: this.localName, speaking: false})
    }
    return list
  }

  private refreshParticipants(): void {
    if (!this.inRoom) {
      return
    }
    if (this.session) {
      this.session.getLocalUserInfo((local) => {
        if (local.displayName && local.displayName.length > 0) {
          this.localName = local.displayName
        }
        const list = this.buildParticipantsSync()
        this.onParticipantsChanged.invoke(list)
        this.onStatus.invoke(`Preview · ${list.length} in room ${this.currentCode}`)
      })
    } else {
      const list = this.buildParticipantsSync()
      this.onParticipantsChanged.invoke(list)
    }
  }

  private flushPending(): void {
    if (!this.session || this.pendingOutbox.length === 0) {
      return
    }
    const batch = this.pendingOutbox.slice()
    this.pendingOutbox = []
    this.log(`flushing ${batch.length} queued messages`)
    for (let i = 0; i < batch.length; i++) {
      this.session.sendMessage(batch[i])
    }
  }

  private sendEnvelope(type: string, payload: unknown): void {
    if (!this.inRoom) {
      return
    }
    const msg = JSON.stringify({t: type, r: this.currentCode, p: payload})
    if (!this.session) {
      if (this.pendingOutbox.length < MAX_PENDING) {
        this.pendingOutbox.push(msg)
        this.log(`queued ${type} (${this.pendingOutbox.length} pending)`)
      } else {
        this.log(`TX dropped (queue full): ${type}`)
      }
      return
    }
    this.session.sendMessage(msg)
    this.log(`TX ${type} room=${this.currentCode}`)
  }

  sendReaction(id: TalkyReactionId): void {
    this.sendEnvelope("reaction", {id, from: this.localUserId, name: this.localName})
  }

  sendSpeaking(speaking: boolean): void {
    this.sendEnvelope("speaking", {userId: this.localUserId, speaking})
  }

  sendVoiceChunk(payload: Omit<TalkyVoiceChunkPayload, "userId" | "name">): void {
    this.sendEnvelope("voice-chunk", {
      ...payload,
      userId: this.localUserId,
      name: this.localName,
    })
  }

  sendChatMessage(text: string, echoLocal: boolean = true): void {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      return
    }
    const msg: TalkyChatMessage & {instanceId: string} = {
      id: `${this.localUserId}-${Date.now()}`,
      userId: this.localUserId,
      name: this.localName,
      text: trimmed,
      timestamp: Date.now(),
      instanceId: this.instanceId,
    }
    this.sendEnvelope("chat-msg", msg)
    if (echoLocal) {
      this.onChatMessage.invoke(msg)
    }
  }
}
