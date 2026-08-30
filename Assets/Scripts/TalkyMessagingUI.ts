/**
 * TalkyMessagingUI — Spoka: single 3D panel (chat above, channel below).
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyChatMessage} from "./TalkyCloudController"
import {TALKY_DIGIT_COUNT, TALKY_MAX_PARTICIPANTS} from "./TalkyAssetManifest"
import {formatParticipantEmojiRow, formatParticipantSummary} from "./TalkyParticipantEmojis"
import {TalkyHeadLock} from "./TalkyHeadLock"
import {TalkyParticipant} from "./TalkyState"
import {
  applySpokaBodyText,
  applyTalkyText,
  setMessageTextRect,
  setTextColor,
  styleElementContentWhite,
  TALKY_WHITE,
  whitenTextsUnder,
  wrapTextBlock,
} from "./TalkyTheme"

const W = 14
const CONTROL_W = 11.2
const GAP = 0.1
const PAD = 0.24
const BTN_H = 1.25
const DIGIT_ARROW_H = 1.05
const DIGIT_SIZE = 1.55
const MSG_CHARS = 20
const MSG_LINES = 5
const MSG_BOX_W = W - PAD * 2
const MSG_BOX_H = 5.6
const DRAFT_BOX_H = 2.2
const CHAT_PLATE_H = 8.2
const CONTROL_PLATE_H = 8.0
const PLATE_GAP = 0.28
/** Shift the stacked pair down so the chat header stays in FOV. */
const STACK_Y = -3.6
/** Chat plate sits above control plate — no shared z-plane overlap. */
const CHAT_PLATE_Y = (CONTROL_PLATE_H + CHAT_PLATE_H) / 2 + PLATE_GAP + STACK_Y
const CONTROL_PLATE_Y = -(CHAT_PLATE_H / 2) + PLATE_GAP * 0.5 + STACK_Y
const CHAT_LAYER_Z = 1.45
const BODY_LAYER_Z = 0.65
const TOAST_W = 11.5
const TOAST_H = 7.4
const TOAST_CHARS = 28
const TOAST_LINES = 4
const TOAST_MIN_SEC = 8
const TOAST_MAX_SEC = 16

type UiMode = "lobby" | "room"

@component
export class TalkyMessagingUI extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">Spoka Messaging UI</span>')
  @ui.separator

  readonly onDigitBump = new Event<{index: number; delta: number}>()
  readonly onJoinRoom = new Event<void>()
  readonly onCreateRoom = new Event<void>()
  readonly onLeaveRoom = new Event<void>()
  readonly onSendMessage = new Event<string>()
  readonly onSpeakToggle = new Event<void>()
  readonly onKeyboard = new Event<void>()
  readonly onHide = new Event<void>()
  readonly onShow = new Event<void>()
  readonly onOnboardingDismiss = new Event<void>()

  private mode: UiMode = "lobby"
  private listening = false
  private panelHidden = false
  private localUserId = ""
  private messages: TalkyChatMessage[] = []
  private messageIds = new Set<string>()
  private built = false

  private hostRoot: SceneObject | null = null
  private mainPanel: SceneObject | null = null
  private controlPanel: SceneObject | null = null
  private channelSection: SceneObject | null = null
  private showPuck: SceneObject | null = null
  private toastRoot: SceneObject | null = null
  private toastBubbleEc: ElementContent | null = null
  private toastHideEvent: DelayedCallbackEvent | null = null
  private floater: TalkyHeadLock | null = null
  private mainPlate: BackPlate | null = null
  private controlPlate: BackPlate | null = null
  private controlFlex: FlexLayout | null = null

  private digitLabels: ElementContent[] = []
  private joinRow: SceneObject | null = null
  private leaveBtn: SceneObject | null = null
  private statusText: Text | null = null
  private liveText: Text | null = null
  private liveRow: SceneObject | null = null
  private messagesText: Text | null = null
  private draftText: Text | null = null
  private speakBtn: Button | null = null

  onAwake(): void {
    this.build()
    this.ensureVisible()
    this.createEvent("OnStartEvent").bind(() => {
      this.ensureVisible()
      this.setDigits([0, 4, 2])
    })
  }

  ensureVisible(): void {
    if (this.hostRoot) {
      this.hostRoot.enabled = true
    }
    if (this.mainPanel) {
      this.mainPanel.enabled = true
    }
    if (this.controlPanel) {
      this.controlPanel.enabled = true
    }
    if (this.showPuck) {
      this.showPuck.enabled = false
    }
    this.setPanelHidden(false)
  }

  private build(): void {
    if (this.built) {
      return
    }
    this.built = true

    this.hostRoot = this.getSceneObject()
    this.hostRoot.enabled = true
    this.floater = this.hostRoot.getComponent(TalkyHeadLock.getTypeName()) as TalkyHeadLock

    this.showPuck = global.scene.createSceneObject("ShowUI")
    this.showPuck.setParent(this.hostRoot)
    this.showPuck.getTransform().setLocalPosition(new vec3(8.2, -2.2, 0))
    this.showPuck.enabled = false
    this.buildPuck(this.showPuck, "Show UI", () => {
      this.onShow.invoke()
      this.setPanelHidden(false)
    })

    this.mainPanel = this.createPanel("SpokaPanel", new vec3(0, CHAT_PLATE_Y, 0), W, CHAT_PLATE_H, (plate) => {
      this.mainPlate = plate
      this.buildChatContent(plate)
    })
    this.controlPanel = this.createPanel(
      "SpokaControlPanel",
      new vec3(0, CONTROL_PLATE_Y, 0),
      CONTROL_W,
      CONTROL_PLATE_H,
      (plate) => {
        this.controlPlate = plate
        this.buildControlContent(plate)
      }
    )
    this.buildIncomingToast()
  }

  private buildPuck(parent: SceneObject, label: string, onTap: () => void): void {
    parent.createComponent("Component.Canvas")
    const btnSO = global.scene.createSceneObject("Btn_ShowUI")
    btnSO.setParent(parent)
    const puckPlate = btnSO.createComponent(BackPlate.getTypeName()) as BackPlate
    puckPlate.size = new vec2(3.2, 1.6)
    const btn = btnSO.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(3.0, 1.4, 0.35)
    const ec = btnSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = label
    styleElementContentWhite(ec, 16)
    btn.onTriggerUp.add(onTap)
  }

  private createPanel(
    name: string,
    localPos: vec3,
    width: number,
    initialHeight: number,
    onReady: (plate: BackPlate) => void
  ): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.hostRoot)
    so.enabled = true
    so.getTransform().setLocalPosition(localPos)
    so.createComponent("Component.Canvas")
    const plate = so.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(width, initialHeight)
    plate.renderOrder = name === "SpokaPanel" ? 55 : 50
    const buildContent = () => onReady(plate)
    plate.onInitialized.add(buildContent)
    if (plate.initialized) {
      buildContent()
    }
    return so
  }

  /** Top plate — header + conversation thread (always in front). */
  private buildChatContent(plate: BackPlate): void {
    const content = global.scene.createSceneObject("SpokaChatContent")
    content.setParent(plate.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CHAT_LAYER_Z))

    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.width = W - PAD * 2
    col.height = -1
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.rowGap = GAP
    col.paddingTop = PAD
    col.paddingBottom = PAD
    col.paddingLeft = PAD
    col.paddingRight = PAD

    this.buildHeader(content)

    this.liveRow = global.scene.createSceneObject("LiveRow")
    this.liveRow.setParent(content)
    this.liveText = this.liveRow.createComponent("Component.Text") as Text
    this.liveText.text = "● LIVE  👻  1/8"
    applyTalkyText(this.liveText, 15, true)
    this.liveText.horizontalAlignment = HorizontalAlignment.Center
    this.liveText.renderOrder = 60
    this.liveRow.createComponent(FlexItem.getTypeName())
    this.liveRow.enabled = false

    this.messagesText = this.addMessageBox(content, "Tap Speak or type with Keys", MSG_BOX_H)
    this.draftText = this.addMessageBox(content, "—", DRAFT_BOX_H)

    whitenTextsUnder(content)

    col.onLayoutComplete.add((r) => {
      if (this.mainPlate) {
        const h = Math.min(r.containerHeight + PAD * 2, CHAT_PLATE_H + 1)
        this.mainPlate.size = new vec2(W, h)
      }
    })
    col.markDirty()
  }

  /** Bottom plate — actions, channel dial, status. */
  private buildControlContent(plate: BackPlate): void {
    const content = global.scene.createSceneObject("SpokaControlContent")
    content.setParent(plate.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, BODY_LAYER_Z))

    const innerW = CONTROL_W - PAD * 2
    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    this.controlFlex = col
    col.width = innerW
    col.height = -1
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.rowGap = GAP
    col.paddingTop = PAD
    col.paddingBottom = PAD
    col.paddingLeft = PAD
    col.paddingRight = PAD

    const actions = global.scene.createSceneObject("ChatActions")
    actions.setParent(content)
    const af = actions.createComponent(FlexLayout.getTypeName()) as FlexLayout
    af.width = innerW
    af.height = -1
    af.direction = FlexDirection.Row
    af.columnGap = 0.12
    af.justifyContent = FlexJustify.Center
    actions.createComponent(FlexItem.getTypeName())

    this.speakBtn = this.addBtn(actions, "Speak", () => this.onSpeakToggle.invoke(), 3.1)
    this.addBtn(actions, "Send", () => this.trySendDraft(), 2.8)
    this.addBtn(actions, "Keys", () => this.onKeyboard.invoke(), 2.0)

    this.channelSection = global.scene.createSceneObject("ChannelSection")
    this.channelSection.setParent(content)
    this.channelSection.createComponent(FlexItem.getTypeName())
    this.buildChannelBlock(this.channelSection)

    this.leaveBtn = this.addBtn(content, "Leave room", () => this.onLeaveRoom.invoke(), innerW).getSceneObject()
    this.leaveBtn.enabled = false

    this.statusText = this.addLine(content, "Join a room with GO · same code on both Specs", 13)

    whitenTextsUnder(content)

    col.onLayoutComplete.add((r) => {
      if (this.controlPlate) {
        const h = Math.min(r.containerHeight + PAD * 2, CONTROL_PLATE_H + 0.4)
        this.controlPlate.size = new vec2(CONTROL_W, h)
      }
    })
    col.markDirty()
  }

  /** Compact toast — stays visible while the full panel is hidden. */
  private buildIncomingToast(): void {
    this.toastRoot = this.createPanel(
      "SpokaIncomingToast",
      new vec3(0, 1.6, 0),
      TOAST_W,
      TOAST_H,
      (plate) => {
        const content = global.scene.createSceneObject("ToastContent")
        content.setParent(plate.sceneObject)
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.7))

        const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
        col.width = TOAST_W - PAD * 2
        col.height = -1
        col.direction = FlexDirection.Column
        col.alignItems = FlexAlign.Stretch
        col.rowGap = 0.12
        col.paddingTop = PAD
        col.paddingBottom = PAD
        col.paddingLeft = PAD
        col.paddingRight = PAD

        this.toastBubbleEc = this.addReadout(
          content,
          "New message",
          TOAST_W - PAD * 2,
          4.8,
          17
        )

        this.addBtn(content, "Open", () => {
          this.hideIncomingToast()
          this.onShow.invoke()
          this.setPanelHidden(false)
        }, TOAST_W - PAD * 2, false, 1.15)

        whitenTextsUnder(content)
        col.markDirty()
      }
    )
    if (this.toastRoot) {
      this.toastRoot.enabled = false
    }
  }

  private buildHeader(parent: SceneObject): void {
    const header = global.scene.createSceneObject("Header")
    header.setParent(parent)
    const hf = header.createComponent(FlexLayout.getTypeName()) as FlexLayout
    hf.width = W - PAD * 2
    hf.height = -1
    hf.direction = FlexDirection.Row
    hf.alignItems = FlexAlign.Center
    hf.justifyContent = FlexJustify.SpaceBetween
    header.createComponent(FlexItem.getTypeName())

    const titleSO = global.scene.createSceneObject("Title")
    titleSO.setParent(header)
    const title = titleSO.createComponent("Component.Text") as Text
    title.text = "SPOKA"
    applyTalkyText(title, 24, true)
    titleSO.createComponent(FlexItem.getTypeName())

    const hideSO = global.scene.createSceneObject("Btn_Hide")
    hideSO.setParent(header)
    const hideBtn = hideSO.createComponent(Button.getTypeName()) as Button
    hideBtn.size = new vec3(2.8, 1.1, 0.8)
    const hideEc = hideSO.createComponent(ElementContent.getTypeName()) as ElementContent
    hideEc.text = "Hide"
    styleElementContentWhite(hideEc, 14)
    hideSO.createComponent(FlexItem.getTypeName())
    hideBtn.onTriggerUp.add(() => {
      this.onHide.invoke()
      this.setPanelHidden(true)
    })
  }

  private buildChannelBlock(parent: SceneObject): void {
    const innerW = CONTROL_W - PAD * 2
    const col = parent.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.width = innerW
    col.height = -1
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.rowGap = 0.08

    const hdr = global.scene.createSceneObject("ChHeader")
    hdr.setParent(parent)
    const hf = hdr.createComponent(FlexLayout.getTypeName()) as FlexLayout
    hf.width = innerW
    hf.height = -1
    hf.direction = FlexDirection.Row
    hf.justifyContent = FlexJustify.Center
    hf.alignItems = FlexAlign.Center
    hdr.createComponent(FlexItem.getTypeName())

    this.addLine(hdr, "Channel", 14, true)

    this.buildDigitRow(parent)

    this.joinRow = global.scene.createSceneObject("JoinRow")
    this.joinRow.setParent(parent)
    const jf = this.joinRow.createComponent(FlexLayout.getTypeName()) as FlexLayout
    jf.width = innerW
    jf.height = -1
    jf.direction = FlexDirection.Row
    jf.columnGap = 0.2
    jf.justifyContent = FlexJustify.Center
    this.joinRow.createComponent(FlexItem.getTypeName())
    this.addBtn(this.joinRow, "GO", () => this.onCreateRoom.invoke(), 2.8)
    this.addBtn(this.joinRow, "JOIN", () => this.onJoinRoom.invoke(), 3.0)
  }

  private buildDigitRow(parent: SceneObject): void {
    const row = global.scene.createSceneObject("Digits")
    row.setParent(parent)
    const rf = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rf.width = CONTROL_W - PAD * 2
    rf.height = -1
    rf.direction = FlexDirection.Row
    rf.columnGap = 0.22
    rf.justifyContent = FlexJustify.Center
    row.createComponent(FlexItem.getTypeName())

    for (let i = 0; i < TALKY_DIGIT_COUNT; i++) {
      const col = global.scene.createSceneObject("D" + i)
      col.setParent(row)
      const cf = col.createComponent(FlexLayout.getTypeName()) as FlexLayout
      cf.width = 2.2
      cf.height = -1
      cf.direction = FlexDirection.Column
      cf.alignItems = FlexAlign.Center
      cf.rowGap = 0.04
      col.createComponent(FlexItem.getTypeName())

      const idx = i
      this.addBtn(col, "▲", () => this.onDigitBump.invoke({index: idx, delta: 1}), 1.8, false, DIGIT_ARROW_H)
      this.digitLabels[i] = this.addDigitDisplay(col, "0")
      this.addBtn(col, "▼", () => this.onDigitBump.invoke({index: idx, delta: -1}), 1.8, false, DIGIT_ARROW_H)
    }
  }

  /** Visible label via Button+ElementContent — raw Text does not render in this Flex stack. */
  private addReadout(
    parent: SceneObject,
    text: string,
    width: number,
    height: number,
    textSize: number
  ): ElementContent {
    const so = global.scene.createSceneObject("Readout")
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(width, height, 0.7)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = text
    styleElementContentWhite(ec, textSize)
    const fi = so.createComponent(FlexItem.getTypeName()) as FlexItem
    fi.minHeight = height
    return ec
  }

  private addDigitDisplay(parent: SceneObject, text: string): ElementContent {
    const so = global.scene.createSceneObject("Digit")
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(DIGIT_SIZE, DIGIT_SIZE, 0.7)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = text
    styleElementContentWhite(ec, 28)
    const fi = so.createComponent(FlexItem.getTypeName()) as FlexItem
    fi.minWidth = DIGIT_SIZE
    fi.minHeight = DIGIT_SIZE
    return ec
  }

  private addLine(parent: SceneObject, text: string, size: number, bold: boolean = false): Text {
    const so = global.scene.createSceneObject("Line")
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    applyTalkyText(t, size, bold)
    t.horizontalAlignment = HorizontalAlignment.Center
    so.createComponent(FlexItem.getTypeName())
    return t
  }

  private addMessageBox(parent: SceneObject, text: string, boxHeight: number): Text {
    const so = global.scene.createSceneObject("MsgLine")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.25))
    const fi = so.createComponent(FlexItem.getTypeName()) as FlexItem
    fi.minWidth = MSG_BOX_W
    fi.minHeight = boxHeight
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    applySpokaBodyText(t, 14, false)
    t.verticalAlignment = VerticalAlignment.Top
    t.renderOrder = 65
    setMessageTextRect(t, MSG_BOX_W, boxHeight)
    return t
  }

  private addBtn(
    parent: SceneObject,
    label: string,
    onTap: () => void,
    width: number,
    holdOnly: boolean = false,
    height: number = BTN_H
  ): Button {
    const so = global.scene.createSceneObject("Btn_" + label)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(width, height, 0.8)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = label
    styleElementContentWhite(ec, 15)
    so.createComponent(FlexItem.getTypeName())
    if (!holdOnly) {
      btn.onTriggerUp.add(onTap)
    }
    return btn
  }

  setDigits(digits: number[]): void {
    for (let i = 0; i < TALKY_DIGIT_COUNT; i++) {
      const ec = this.digitLabels[i]
      if (ec) {
        ec.text = String(digits[i] ?? 0)
        styleElementContentWhite(ec, 28)
      }
    }
  }

  setListening(active: boolean): void {
    this.listening = active
    if (this.speakBtn) {
      const ec = this.speakBtn.getSceneObject().getComponent(ElementContent.getTypeName()) as ElementContent
      if (ec) {
        ec.text = active ? "Listening…" : "Speak"
        styleElementContentWhite(ec, 15)
      }
    }
    this.refreshMessages()
  }

  private trySendDraft(): void {
    if (!this.draftText) {
      return
    }
    const trimmed = this.draftText.text.replace(/^"|"$/g, "").replace(/^—$/g, "").trim()
    if (trimmed.length > 0) {
      this.onSendMessage.invoke(trimmed)
      this.setDraft("")
    }
  }

  setMode(mode: UiMode | "onboarding"): void {
    const m: UiMode = mode === "onboarding" ? "lobby" : mode
    this.mode = m
    const inRoom = m === "room"
    if (this.joinRow) {
      this.joinRow.enabled = !inRoom
    }
    if (this.channelSection) {
      this.channelSection.enabled = !inRoom
    }
    if (this.leaveBtn) {
      this.leaveBtn.enabled = inRoom
    }
    if (this.liveRow) {
      this.liveRow.enabled = inRoom
    }
    if (this.controlFlex) {
      this.controlFlex.markDirty()
    }
  }

  setPanelHidden(hidden: boolean): void {
    this.panelHidden = hidden
    if (this.hostRoot) {
      this.hostRoot.enabled = true
    }
    if (this.mainPanel) {
      this.mainPanel.enabled = !hidden
    }
    if (this.controlPanel) {
      this.controlPanel.enabled = !hidden
    }
    if (this.showPuck) {
      this.showPuck.enabled = hidden
    }
    if (!hidden) {
      this.hideIncomingToast()
    }
  }

  isPanelHidden(): boolean {
    return this.panelHidden
  }

  setRoomCode(_code: string): void {}

  setLocalUserId(id: string): void {
    this.localUserId = id
  }

  setStatus(msg: string): void {
    if (this.statusText) {
      this.statusText.text = msg
      setTextColor(this.statusText, TALKY_WHITE)
    }
  }

  setConnectionState(state: "connecting" | "connected", list: TalkyParticipant[]): void {
    if (!this.liveText) {
      return
    }
    const live = state === "connecting" ? "…" : "● LIVE"
    const emojis = formatParticipantEmojiRow(list, this.localUserId) || "👻"
    const count = formatParticipantSummary(list, TALKY_MAX_PARTICIPANTS)
    this.liveText.text = `${live}  ${emojis}  ${count}`
    applyTalkyText(this.liveText, 15, state === "connected")
  }

  setDraft(text: string): void {
    if (this.draftText) {
      const wrapped = wrapTextBlock(text, MSG_CHARS, 2)
      this.draftText.text = wrapped.length > 0 ? `"${wrapped}"` : "—"
      setTextColor(this.draftText, TALKY_WHITE)
    }
  }

  appendDraft(text: string): void {
    this.setDraft(text)
  }

  sendDraftIfAny(): void {
    this.trySendDraft()
  }

  addMessage(msg: TalkyChatMessage, fromRemote: boolean = false): void {
    const dedupeKey = `${msg.userId}|${msg.text}|${Math.floor(msg.timestamp / 2000)}`
    if (this.messageIds.has(msg.id) || this.messageIds.has(dedupeKey)) {
      return
    }
    this.messageIds.add(msg.id)
    this.messageIds.add(dedupeKey)
    this.messages.push(msg)
    if (this.messages.length > 40) {
      const removed = this.messages.shift()
      if (removed) {
        this.messageIds.delete(removed.id)
      }
    }
    this.refreshMessages()
    if (fromRemote && this.panelHidden) {
      this.showIncomingToast(msg)
    }
  }

  private showIncomingToast(msg: TalkyChatMessage): void {
    if (!this.toastRoot) {
      return
    }
    const name = (msg.name && msg.name.length > 0 ? msg.name : "Friend").trim()
    const body = wrapTextBlock(msg.text, TOAST_CHARS, TOAST_LINES).replace(/\n/g, " ")
    if (this.toastBubbleEc) {
      this.toastBubbleEc.text = `${name}  ·  ${body}`
      styleElementContentWhite(this.toastBubbleEc, 17)
    }
    this.toastRoot.enabled = true
    const holdSec = Math.min(
      TOAST_MAX_SEC,
      Math.max(TOAST_MIN_SEC, 5 + msg.text.trim().length * 0.08)
    )
    if (!this.toastHideEvent) {
      this.toastHideEvent = this.createEvent("DelayedCallbackEvent")
      this.toastHideEvent.bind(() => {
        this.hideIncomingToast()
      })
    }
    this.toastHideEvent.enabled = true
    this.toastHideEvent.reset(holdSec)
    print(`[Spoka] incoming toast ${holdSec.toFixed(1)}s from ${name}`)
  }

  private hideIncomingToast(): void {
    if (this.toastHideEvent) {
      this.toastHideEvent.enabled = false
    }
    if (this.toastRoot) {
      this.toastRoot.enabled = false
    }
  }

  clearMessages(): void {
    this.messages = []
    this.messageIds.clear()
    this.setDraft("")
    this.refreshMessages()
  }

  private refreshMessages(): void {
    if (!this.messagesText) {
      return
    }
    if (this.messages.length === 0) {
      this.messagesText.text = this.listening
        ? "Listening — speak your message"
        : "Tap Speak · Keys · then Send"
      setTextColor(this.messagesText, TALKY_WHITE)
      return
    }
    const start = Math.max(0, this.messages.length - 2)
    let block = ""
    for (let i = start; i < this.messages.length; i++) {
      const m = this.messages[i]
      block += wrapTextBlock(`${m.name}: ${m.text}`, MSG_CHARS, MSG_LINES)
      if (i < this.messages.length - 1) {
        block += "\n—\n"
      }
    }
    this.messagesText.text = block
    setTextColor(this.messagesText, TALKY_WHITE)
  }
}
