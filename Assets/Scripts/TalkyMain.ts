/**
 * TalkyMain — Spoka messaging orchestrator (Snap Cloud + Connected Lens).
 */

import {TalkyMessagingUI} from "./TalkyMessagingUI"
import {TalkyChatController} from "./TalkyChatController"
import {TalkyAudioController} from "./TalkyAudioController"
import {TalkyCloudController} from "./TalkyCloudController"
import {TalkyConnectedLensBootstrap} from "./TalkyConnectedLensBootstrap"
import {TalkyPreviewBridge} from "./TalkyPreviewBridge"
import {TalkyChatMessage} from "./TalkyCloudController"
import {TalkyState} from "./TalkyState"

@component
export class TalkyMain extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">SpokaMain – messaging orchestrator</span>')
  @ui.separator

  @ui.group_start("References")
  @input messagingUI!: TalkyMessagingUI
  @input
  @allowUndefined
  chatController!: TalkyChatController
  @input
  @allowUndefined
  previewBridge!: TalkyPreviewBridge
  @input
  @allowUndefined
  audio!: TalkyAudioController
  @input cloud!: TalkyCloudController
  @input
  @allowUndefined
  connectedLens!: TalkyConnectedLensBootstrap
  @ui.group_end

  private state = new TalkyState()
  private joinTimeout: DelayedCallbackEvent | null = null
  private cloudReady = false
  private connecting = false
  private transportLabel = "none"
  private previewUserId = ""
  private previewDisplayName = ""

  onAwake(): void {
    const suffix = Math.floor(Math.random() * 900 + 100)
    this.previewUserId = "preview-" + suffix
    this.previewDisplayName = "Preview " + (suffix % 9 === 0 ? 2 : 1)
    this.createEvent("OnStartEvent").bind(() => this.boot())
  }

  private boot(): void {
    if (!this.messagingUI || !this.cloud) {
      print("[Spoka] FATAL: wire TalkyMessagingUI + TalkyCloudController")
      return
    }

    this.wireUi()
    this.wireCloud()
    this.wirePreview()
    this.messagingUI.setDigits(this.state.digits)
    this.messagingUI.setMode("lobby")
    this.messagingUI.ensureVisible()
    print("[Spoka] Boot OK · transport: " + (this.cloud.isConfigured() ? "cloud+preview" : "preview-only"))
  }

  private useCloudTransport(): boolean {
    return this.cloud.isConfigured() && this.cloudReady && this.cloud.isAuthReady()
  }

  private wireUi(): void {
    this.messagingUI.onDigitBump.add((p) => {
      this.state.bumpDigit(p.index, p.delta)
      if (this.audio) {
        this.audio.playDialTick()
      }
      this.messagingUI.setDigits(this.state.digits)
    })

    this.messagingUI.onOnboardingDismiss.add(() => {
      this.messagingUI.setMode("lobby")
    })
    this.messagingUI.onCreateRoom.add(() => this.enterRoom(true))
    this.messagingUI.onJoinRoom.add(() => this.enterRoom(false))
    this.messagingUI.onLeaveRoom.add(() => this.leaveRoom())

    this.messagingUI.onHide.add(() => {
      if (this.audio) {
        this.audio.playClick()
      }
    })
    this.messagingUI.onShow.add(() => {
      if (this.audio) {
        this.audio.playClick()
      }
    })

    this.messagingUI.onSendMessage.add((text) => this.sendChat(text))

    this.messagingUI.onSpeakToggle.add(() => {
      if (!this.chatController) {
        return
      }
      const on = this.chatController.toggleListening()
      this.messagingUI.setListening(on)
    })

    this.messagingUI.onKeyboard.add(() => {
      if (this.chatController) {
        this.chatController.showKeyboard((text) => {
          this.messagingUI.setDraft(text)
          this.sendChat(text)
        })
      }
    })

    if (this.chatController) {
      this.chatController.onTranscriptUpdate.add((p) => {
        if (p.isFinal) {
          this.messagingUI.setDraft(p.text)
        } else {
          this.messagingUI.appendDraft(p.text)
        }
      })
      this.chatController.onUtteranceFinal.add((text) => {
        this.sendChat(text)
        this.messagingUI.setDraft("")
      })
      this.chatController.onDictateError.add((msg) => {
        this.messagingUI.setStatus(msg)
      })
      this.chatController.onListeningChanged.add((on) => {
        this.messagingUI.setListening(on)
      })
    }
  }

  private sendChat(text: string): void {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      return
    }

    const inRoom =
      this.state.phase === "in_room" ||
      (this.previewBridge && this.previewBridge.isInRoom()) ||
      this.cloud.isInRoom()

    if (!inRoom) {
      this.messagingUI.setStatus("Join a room first — pick channel & tap GO")
      return
    }

    const localMsg: TalkyChatMessage = {
      id: "local-" + Date.now(),
      userId: this.getLocalUserId(),
      name: this.getLocalName(),
      text: trimmed,
      timestamp: Date.now(),
    }
    this.messagingUI.addMessage(localMsg)
    print(`[Spoka] send: "${trimmed.substring(0, 48)}"`)

    let sent = false
    if (this.previewBridge && this.previewBridge.isInRoom()) {
      this.previewBridge.sendChatMessage(trimmed, false)
      sent = true
      print("[Spoka] TX via Connected Lens preview")
    }
    if (this.cloud.isInRoom()) {
      this.cloud.sendChatMessage(trimmed, false)
      sent = true
      print("[Spoka] TX via Snap Cloud")
    }
    if (!sent) {
      this.messagingUI.setStatus("Not connected — rejoin the room")
      print("[Spoka] send failed — no active transport")
    } else {
      this.messagingUI.setStatus(`Sent · room ${this.state.roomCode || this.state.getCode()}`)
    }
    if (this.audio) {
      this.audio.playClick()
    }
  }

  private getLocalUserId(): string {
    if (this.cloud.isAuthReady()) {
      return this.cloud.getUserId()
    }
    return this.previewUserId
  }

  private getLocalName(): string {
    if (this.cloud.isAuthReady()) {
      return this.cloud.getDisplayName()
    }
    return this.previewDisplayName
  }

  private wireCloud(): void {
    this.cloud.onStatus.add((msg) => {
      this.state.statusMessage = msg
      this.messagingUI.setStatus(msg)
    })
    this.cloud.onAuthFailed.add((msg) => {
      print("[Spoka] cloud auth failed: " + msg)
      this.messagingUI.setStatus("Preview transport · pick room & GO")
    })
    this.cloud.onReady.add(() => {
      this.cloudReady = true
      this.messagingUI.setStatus("Ready — pick room & tap GO")
    })
    this.cloud.onJoined.add((payload) => {
      this.cancelJoinTimeout()
      this.connecting = false
      this.transportLabel = "cloud"
      this.onRoomJoined(payload.code, payload.participants)
    })
    this.cloud.onRoomFull.add((code) => {
      this.cancelJoinTimeout()
      this.connecting = false
      this.messagingUI.setMode("lobby")
      this.messagingUI.setStatus(`Room ${code} is full (8/8)`)
    })
    this.cloud.onParticipantsChanged.add((list) => {
      this.state.setParticipants(list)
      if (this.transportLabel === "cloud" || !this.previewBridge || !this.previewBridge.isInRoom()) {
        this.messagingUI.setConnectionState("connected", list)
      }
    })
    this.cloud.onChatMessage.add((msg) => {
      this.messagingUI.addMessage(msg, true)
      if (this.audio && this.messagingUI.isPanelHidden()) {
        this.audio.playClick()
      }
    })
    this.cloud.onLeft.add(() => {
      if (this.connecting) {
        return
      }
      if (this.previewBridge && this.previewBridge.isInRoom()) {
        return
      }
      this.connecting = false
      this.transportLabel = "none"
      this.messagingUI.clearMessages()
      this.messagingUI.setMode("lobby")
      this.messagingUI.setStatus("Left room")
    })
    this.cloud.onError.add((err) => {
      this.connecting = false
      this.messagingUI.setStatus(err)
    })
  }

  private wirePreview(): void {
    if (!this.previewBridge) {
      return
    }
    this.previewBridge.onJoined.add((payload) => {
      if (this.cloud.isInRoom()) {
        return
      }
      this.cancelJoinTimeout()
      this.connecting = false
      this.transportLabel = "preview"
      this.onRoomJoined(payload.code, payload.participants)
    })
    this.previewBridge.onParticipantsChanged.add((list) => {
      if (this.transportLabel === "preview" || !this.cloud.isInRoom()) {
        this.state.setParticipants(list)
        this.messagingUI.setConnectionState("connected", list)
      }
    })
    this.previewBridge.onChatMessage.add((msg) => {
      this.messagingUI.addMessage(msg, true)
      if (this.audio && this.messagingUI.isPanelHidden()) {
        this.audio.playClick()
      }
    })
    this.previewBridge.onStatus.add((msg) => {
      if (this.transportLabel === "preview" || !this.cloud.isInRoom()) {
        this.messagingUI.setStatus(msg)
      }
    })
    this.previewBridge.onLeft.add(() => {
      if (this.cloud.isInRoom()) {
        return
      }
      this.connecting = false
      this.transportLabel = "none"
      this.messagingUI.clearMessages()
      this.messagingUI.setMode("lobby")
    })
    this.previewBridge.onSessionAttached.add(() => {
      if (this.previewBridge && this.previewBridge.isInRoom()) {
        this.transportLabel = "preview"
        this.messagingUI.setLocalUserId(this.previewBridge.getLocalUserId())
        this.messagingUI.setStatus(`Connected Lens linked · room ${this.state.roomCode}`)
      }
    })
  }

  private onRoomJoined(code: string, participants: {id: string; name: string; speaking: boolean}[]): void {
    this.state.roomCode = code
    this.state.setParticipants(participants)
    this.state.setPhase("in_room", `Room ${code}`)
    if (this.audio) {
      this.audio.playJoin()
    }
    this.messagingUI.setMode("room")
    this.messagingUI.setDigits(this.state.digits)
    this.messagingUI.setConnectionState("connected", participants)
    this.messagingUI.setLocalUserId(this.getLocalUserId())

    if (this.chatController) {
      this.chatController.startListening()
      this.messagingUI.setListening(true)
    }

    let via = "Connected Lens"
    if (this.transportLabel === "cloud") {
      via = "Snap Cloud"
    } else if (!this.previewBridge || !this.previewBridge.hasSession()) {
      via = "Local (waiting for CL)"
    }
    this.messagingUI.setStatus(`Room ${code} · ${participants.length} here · ${via}`)
    print(`[Spoka] joined ${code} via ${via}`)
  }

  private cancelJoinTimeout(): void {
    if (this.joinTimeout) {
      this.joinTimeout.enabled = false
    }
  }

  private scheduleJoinTimeout(code: string): void {
    if (!this.joinTimeout) {
      this.joinTimeout = this.createEvent("DelayedCallbackEvent")
      this.joinTimeout.bind(() => {
        if (this.connecting && !this.cloud.isInRoom()) {
          this.connecting = false
          if (this.previewBridge && this.previewBridge.isInRoom()) {
            this.transportLabel = "preview"
            this.onRoomJoined(code, this.state.participants)
          }
        }
      })
    }
    this.joinTimeout.reset(4.0)
  }

  private enterRoom(_asCreator: boolean): void {
    const code = this.state.getCode()
    this.connecting = true
    this.transportLabel = "none"
    this.messagingUI.setMode("room")
    this.messagingUI.setConnectionState("connecting", [])
    this.messagingUI.setStatus(`Joining ${code}…`)
    this.messagingUI.clearMessages()
    this.messagingUI.setLocalUserId(this.getLocalUserId())
    if (this.audio) {
      this.audio.playClick()
    }
    print(`[Spoka] join room ${code}`)

    if (this.previewBridge) {
      this.previewBridge.setLocalIdentity(this.previewUserId, this.previewDisplayName)
      this.previewBridge.joinRoom(code)
    }

    if (this.useCloudTransport()) {
      this.cloud.joinOrCreate(code, _asCreator)
      this.scheduleJoinTimeout(code)
    } else if (this.previewBridge) {
      this.scheduleJoinTimeout(code)
    }
  }

  private leaveRoom(): void {
    print("[Spoka] leave room")
    this.connecting = false
    this.cancelJoinTimeout()
    if (this.chatController) {
      this.chatController.stopListening()
      this.messagingUI.setListening(false)
    }
    if (this.audio) {
      this.audio.playLeave()
    }
    this.transportLabel = "none"

    if (this.cloud.isInRoom()) {
      this.cloud.leaveRoom({silent: false})
    } else if (this.previewBridge && this.previewBridge.isInRoom()) {
      this.previewBridge.leaveRoom()
    } else {
      this.messagingUI.clearMessages()
      this.messagingUI.setMode("lobby")
      this.messagingUI.setStatus("Pick room & tap GO")
    }
  }
}
