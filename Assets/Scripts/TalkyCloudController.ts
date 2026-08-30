/**
 * TalkyCloudController — Snap Cloud Realtime room presence + event bus.
 * Owns: auth, channel join/leave, presence sync, broadcast send/receive.
 * Does not: mic capture UI, SFX playback (emits callbacks instead).
 *
 * Configure Assets/SupabaseProject_talky.supabaseProject via Window → Supabase → Import Credentials
 * (or replace ProjectId / ProjectUrl / PublicToken in that YAML).
 */

import {createClient, RealtimeChannel, SupabaseClient} from "SupabaseClient.lspkg/supabase-snapcloud"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TALKY_MAX_PARTICIPANTS, TalkyReactionId, talkyChannelName} from "./TalkyAssetManifest"
import {TalkyParticipant} from "./TalkyState"

export type TalkyPresencePayload = {
  user_id: string
  name: string
  transmitting?: boolean
}

export type TalkyVoiceChunkPayload = {
  userId: string
  name: string
  chunkNumber: number
  timestamp: number
  data: string
  sampleRate: number
  samples: number
}

export type TalkyChatMessage = {
  id: string
  userId: string
  name: string
  text: string
  timestamp: number
}

@component
export class TalkyCloudController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TalkyCloudController – Snap Cloud Realtime</span>')
  @ui.separator

  @ui.group_start("Settings")
  @input
  @hint("Display name shown to other participants (auto-suffixed in Preview)")
  displayName: string = "Talky Friend"

  @input
  @hint("Log realtime connection details")
  enableDebugLogs: boolean = true
  @ui.group_end

  readonly onReady = new Event<void>()
  readonly onAuthFailed = new Event<string>()
  readonly onJoined = new Event<{code: string; participants: TalkyParticipant[]}>()
  readonly onLeft = new Event<void>()
  readonly onRoomFull = new Event<string>()
  readonly onParticipantsChanged = new Event<TalkyParticipant[]>()
  readonly onSpeakingChanged = new Event<string>()
  readonly onReaction = new Event<{id: TalkyReactionId; from: string; name: string}>()
  readonly onVoiceChunk = new Event<TalkyVoiceChunkPayload>()
  readonly onChatMessage = new Event<TalkyChatMessage>()
  readonly onStatus = new Event<string>()
  readonly onError = new Event<string>()

  private client: SupabaseClient | null = null
  private channel: RealtimeChannel | null = null
  private uid: string = ""
  private currentCode: string = ""
  private configured: boolean = false
  private authReady: boolean = false
  private channelSubscribed: boolean = false
  private joining: boolean = false
  private leaving: boolean = false
  private resolvedName: string = ""
  private syncTimer: DelayedCallbackEvent | null = null

  onAwake(): void {
    this.resolvedName = this.makeDisplayName()
    this.createEvent("OnStartEvent").bind(() => {
      this.initClient()
    })
    this.createEvent("OnDestroyEvent").bind(() => {
      this.leaveRoom({silent: false})
      if (this.client) {
        this.client.removeAllChannels()
      }
    })
  }

  private log(msg: string): void {
    if (this.enableDebugLogs) {
      print(`[TalkyCloud] ${msg}`)
    }
  }

  private initClient(): void {
    try {
      const project = requireAsset("../SupabaseProject_talky.supabaseProject") as SupabaseProject
      if (!project || !project.url || !project.publicToken) {
        this.configured = false
        this.onAuthFailed.invoke("Snap Cloud project asset missing credentials")
        this.onStatus.invoke("Add Snap Cloud credentials to continue")
        return
      }
      const url = project.url
      const token = project.publicToken
      if (url.indexOf("REPLACE_WITH") >= 0 || token.indexOf("REPLACE_WITH") >= 0) {
        this.configured = false
        this.onAuthFailed.invoke("Snap Cloud credentials not configured")
        this.onStatus.invoke("Import Snap Cloud credentials (Window → Supabase)")
        this.log("Placeholder credentials detected — realtime disabled until configured")
        return
      }

      this.client = createClient(url, token, {realtime: {heartbeatIntervalMs: 2500}})
      this.configured = true
      this.signInWithRetry()
    } catch (e) {
      this.configured = false
      this.onAuthFailed.invoke(String(e))
      this.onStatus.invoke("Snap Cloud package / project asset unavailable")
    }
  }

  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => resolve())
      ev.reset(seconds)
    })
  }

  private async signInWithRetry(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        this.log(`Auth retry ${attempt + 1}/3`)
        await this.delay(1.0)
      }
      const ok = await this.trySignIn()
      if (ok) {
        return
      }
    }
    this.onAuthFailed.invoke("Auth failed — enable Anonymous in Snap Cloud Dashboard")
    this.onStatus.invoke("Auth failed — check Snap Cloud Dashboard")
  }

  private async trySignIn(): Promise<boolean> {
    if (!this.client) {
      return false
    }
    try {
      const {data, error} = await this.client.auth.signInWithIdToken({
        provider: "snapchat",
        token: "",
      })
      if (!error && data && data.user) {
        this.uid = JSON.stringify(data.user.id).replace(/^"(.*)"$/, "$1")
        this.authReady = true
        this.log("Signed in: " + this.uid)
        this.onReady.invoke()
        this.onStatus.invoke("Signed in — ready to create or join")
        return true
      }
    } catch (_e) {
      // fall through to anonymous
    }

    try {
      const {data: anonData, error: anonError} = await this.client.auth.signInAnonymously()
      if (anonError || !anonData || !anonData.user) {
        this.log("Anonymous auth failed: " + JSON.stringify(anonError))
        return false
      }
      this.uid = JSON.stringify(anonData.user.id).replace(/^"(.*)"$/, "$1")
      this.authReady = true
      this.log("Signed in anonymously: " + this.uid)
      this.onReady.invoke()
      this.onStatus.invoke("Preview auth OK — ready")
      return true
    } catch (e) {
      this.log("Auth exception: " + String(e))
      return false
    }
  }

  isConfigured(): boolean {
    return this.configured && !!this.client
  }

  isAuthReady(): boolean {
    return this.authReady && !!this.uid
  }

  isInRoom(): boolean {
    return this.channelSubscribed && !!this.channel && this.currentCode.length > 0
  }

  getRoomCode(): string {
    return this.currentCode
  }

  getUserId(): string {
    return this.uid
  }

  getDisplayName(): string {
    if (this.resolvedName && this.resolvedName.length > 0) {
      return this.resolvedName
    }
    return this.displayName && this.displayName.length > 0 ? this.displayName : "Talky Friend"
  }

  private makeDisplayName(): string {
    const base = this.displayName && this.displayName.length > 0 ? this.displayName : "Talky"
    const suffix = Math.floor(Math.random() * 900 + 100)
    return `${base}-${suffix}`
  }

  async joinOrCreate(code: string, _asCreator: boolean): Promise<void> {
    if (!this.isConfigured() || !this.client) {
      this.onError.invoke("Snap Cloud not configured")
      this.onStatus.invoke("Configure Snap Cloud credentials first")
      return
    }
    if (!this.isAuthReady()) {
      this.onStatus.invoke("Signing in to Snap Cloud… try again in a moment")
      return
    }
    if (this.joining) {
      this.log("Join already in progress")
      return
    }

    if (this.channel) {
      await this.leaveRoom({silent: true})
    }

    this.joining = true
    this.channelSubscribed = false
    const channelName = talkyChannelName(code)
    this.onStatus.invoke(`Joining room ${code}…`)
    this.log(`join channel ${channelName} uid=${this.uid}`)

    this.channel = this.client.channel(channelName, {
      config: {
        broadcast: {self: false},
        presence: {key: this.uid},
      },
    })

    this.channel
      .on("presence", {event: "sync"}, () => {
        this.emitParticipants()
      })
      .on("presence", {event: "join"}, (msg) => {
        const presences = msg.newPresences
        if (presences && presences.length > 0) {
          const p = presences[0] as unknown as TalkyPresencePayload
          this.log(`presence join: ${p.name || "friend"}`)
        }
        this.emitParticipants()
      })
      .on("presence", {event: "leave"}, (msg) => {
        const presences = msg.leftPresences
        if (presences && presences.length > 0) {
          const p = presences[0] as unknown as TalkyPresencePayload
          this.log(`presence leave: ${p.name || "friend"}`)
        }
        this.emitParticipants()
      })
      .on("broadcast", {event: "reaction"}, (msg) => {
        if (!this.isInRoom()) {
          return
        }
        const p = msg.payload as {id: TalkyReactionId; from: string; name: string}
        if (p && p.id) {
          this.log(`RX reaction ${p.id} from ${p.name || "friend"}`)
          this.onReaction.invoke(p)
        }
      })
      .on("broadcast", {event: "voice-chunk"}, (msg) => {
        if (!this.isInRoom()) {
          return
        }
        const p = msg.payload as TalkyVoiceChunkPayload
        if (p && p.data && p.userId !== this.uid) {
          this.log(`RX voice chunk #${p.chunkNumber} from ${p.name || p.userId}`)
          this.onVoiceChunk.invoke(p)
          if (p.userId) {
            this.onSpeakingChanged.invoke(p.userId)
          }
        }
      })
      .on("broadcast", {event: "speaking"}, (msg) => {
        if (!this.isInRoom()) {
          return
        }
        const p = msg.payload as {userId: string; speaking: boolean}
        if (p && p.userId && p.userId !== this.uid) {
          this.onSpeakingChanged.invoke(p.speaking ? p.userId : "")
        }
      })
      .on("broadcast", {event: "chat-msg"}, (msg) => {
        if (!this.isInRoom()) {
          return
        }
        const p = msg.payload as TalkyChatMessage
        if (p && p.text && p.userId !== this.uid) {
          this.log(`RX chat from ${p.name}: ${p.text.substring(0, 32)}`)
          this.onChatMessage.invoke(p)
        }
      })

    this.channel.subscribe(async (status) => {
      this.log("channel status: " + status)
      if (status === "SUBSCRIBED") {
        await this.onChannelSubscribed(code)
      } else if (status === "CLOSED") {
        this.joining = false
        this.channelSubscribed = false
        if (!this.leaving) {
          this.onStatus.invoke("Disconnected from room")
          await this.cleanupChannel()
          this.onLeft.invoke()
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.joining = false
        this.channelSubscribed = false
        this.onError.invoke("Channel error: " + status)
        this.onStatus.invoke("Connection issue — try again")
        await this.leaveRoom({silent: true})
        this.onLeft.invoke()
      }
    })
  }

  private async onChannelSubscribed(code: string): Promise<void> {
    if (!this.channel) {
      this.joining = false
      return
    }

    const existing = this.readParticipants()
    if (existing.length >= TALKY_MAX_PARTICIPANTS) {
      this.joining = false
      this.onRoomFull.invoke(code)
      this.onStatus.invoke(`Room ${code} is full (${TALKY_MAX_PARTICIPANTS}/${TALKY_MAX_PARTICIPANTS})`)
      await this.leaveRoom({silent: true})
      return
    }

    try {
      const trackStatus = await this.channel.track({
        user_id: this.uid,
        name: this.getDisplayName(),
        transmitting: false,
      } as TalkyPresencePayload)
      this.log("presence track status: " + trackStatus)
    } catch (e) {
      this.joining = false
      this.onError.invoke("Failed to join presence: " + String(e))
      await this.leaveRoom({silent: true})
      return
    }

    this.currentCode = code
    this.channelSubscribed = true
    this.joining = false

    const list = this.readParticipants()
    if (list.length === 0) {
      list.push({
        id: this.uid,
        name: this.getDisplayName(),
        speaking: false,
      })
    }
    this.onJoined.invoke({code, participants: list})
    this.onParticipantsChanged.invoke(list)
    this.onStatus.invoke(`Connected · room ${code} · ${list.length}/${TALKY_MAX_PARTICIPANTS}`)
    this.schedulePresenceResync()
  }

  private schedulePresenceResync(): void {
    if (!this.syncTimer) {
      this.syncTimer = this.createEvent("DelayedCallbackEvent")
      this.syncTimer.bind(() => {
        if (this.isInRoom()) {
          this.emitParticipants()
        }
      })
    }
    this.syncTimer.reset(0.35)
    const resync2 = this.createEvent("DelayedCallbackEvent")
    resync2.bind(() => {
      if (this.isInRoom()) {
        this.emitParticipants()
      }
    })
    resync2.reset(1.0)
  }

  private readParticipants(): TalkyParticipant[] {
    if (!this.channel) {
      return []
    }
    const state = this.channel.presenceState() as {[key: string]: TalkyPresencePayload[] | {metas: TalkyPresencePayload[]}}
    const list: TalkyParticipant[] = []
    const seen = new Set<string>()
    const keys = Object.keys(state)
    for (let i = 0; i < keys.length; i++) {
      const raw = state[keys[i]] as unknown
      let entries: TalkyPresencePayload[] = []
      if (Array.isArray(raw)) {
        entries = raw as TalkyPresencePayload[]
      } else if (raw && typeof raw === "object" && "metas" in (raw as object)) {
        entries = (raw as {metas: TalkyPresencePayload[]}).metas
      }
      for (let j = 0; j < entries.length; j++) {
        const p = entries[j]
        const id = p.user_id || keys[i]
        if (seen.has(id)) {
          continue
        }
        seen.add(id)
        list.push({
          id,
          name: p.name || "Friend",
          speaking: !!p.transmitting,
        })
      }
    }
    if (this.channelSubscribed && this.uid && !seen.has(this.uid)) {
      list.push({
        id: this.uid,
        name: this.getDisplayName(),
        speaking: false,
      })
    }
    return list
  }

  private emitParticipants(): void {
    if (!this.isInRoom()) {
      return
    }
    const list = this.readParticipants()
    this.onParticipantsChanged.invoke(list)
    const others = list.length - 1
    const connectedMsg =
      others > 0
        ? `Connected · ${others} friend${others === 1 ? "" : "s"} in room ${this.currentCode}`
        : `Connected · waiting for friends in room ${this.currentCode}`
    this.onStatus.invoke(connectedMsg)
  }

  async leaveRoom(options?: {silent?: boolean}): Promise<void> {
    if (this.leaving) {
      return
    }
    this.leaving = true
    this.joining = false
    this.channelSubscribed = false
    await this.cleanupChannel()
    this.leaving = false
    if (!options?.silent) {
      this.onLeft.invoke()
    }
  }

  private async cleanupChannel(): Promise<void> {
    if (this.client && this.channel) {
      try {
        await this.channel.untrack()
      } catch (_e) {
        // ignore
      }
      try {
        await this.client.removeChannel(this.channel)
      } catch (_e) {
        // ignore
      }
    }
    this.channel = null
    this.currentCode = ""
  }

  sendReaction(id: TalkyReactionId): void {
    if (!this.isInRoom() || !this.channel) {
      this.log("TX reaction blocked — not in room")
      return
    }
    this.log(`TX reaction ${id}`)
    this.channel.send({
      type: "broadcast",
      event: "reaction",
      payload: {id, from: this.uid, name: this.getDisplayName()},
    })
  }

  sendSpeaking(speaking: boolean): void {
    if (!this.isInRoom() || !this.channel) {
      return
    }
    this.channel.send({
      type: "broadcast",
      event: "speaking",
      payload: {userId: this.uid, speaking},
    })
    this.channel.track({
      user_id: this.uid,
      name: this.getDisplayName(),
      transmitting: speaking,
    } as TalkyPresencePayload)
  }

  sendVoiceChunk(payload: Omit<TalkyVoiceChunkPayload, "userId" | "name">): void {
    if (!this.isInRoom() || !this.channel) {
      return
    }
    this.log(`TX voice chunk #${payload.chunkNumber}`)
    this.channel.send({
      type: "broadcast",
      event: "voice-chunk",
      payload: {
        ...payload,
        userId: this.uid,
        name: this.getDisplayName(),
      },
    })
  }

  sendChatMessage(text: string, echoLocal: boolean = true): void {
    if (!this.isInRoom() || !this.channel) {
      this.log("TX chat blocked — not in room")
      return
    }
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      return
    }
    const msg: TalkyChatMessage = {
      id: `${this.uid}-${Date.now()}`,
      userId: this.uid,
      name: this.getDisplayName(),
      text: trimmed,
      timestamp: Date.now(),
    }
    this.log(`TX chat "${trimmed.substring(0, 32)}"`)
    this.channel.send({
      type: "broadcast",
      event: "chat-msg",
      payload: msg,
    })
    if (echoLocal) {
      this.onChatMessage.invoke(msg)
    }
  }
}
