/**
 * TalkyRadioController — tactile 3D toy radio with SIK poke buttons for dial + actions.
 * Owns: radio mesh prop, digit wheels, create/join/PTT/reaction targets on the radio body.
 * Does not: cloud protocol (emits events for TalkyMain).
 */

import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyReactionId, TalkyReactionList, TALKY_DIGIT_COUNT} from "./TalkyAssetManifest"
import {applyTalkyText, setTextColor, styleElementContentWhite, TALKY_WHITE} from "./TalkyTheme"
import {TalkyParticipant} from "./TalkyState"
import {formatParticipantEmojiRow} from "./TalkyParticipantEmojis"

type RadioMode = "lobby" | "in_room"

const REACTION_COLS = 4
const REACTION_BTN = 2.2
const REACTION_GAP = 0.55
const DIGIT_SPACING = 2.2
const RADIO_BODY_SCALE = 0.085

@component
export class TalkyRadioController extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyRadioController – 3D toy radio</span>')
  @ui.separator

  @input
  @hint("Parent anchor for the radio prop (world-space)")
  radioAnchor!: SceneObject

  readonly onDigitBump = new Event<{index: number; delta: number}>()
  readonly onCreate = new Event<void>()
  readonly onJoin = new Event<void>()
  readonly onLeave = new Event<void>()
  readonly onPttDown = new Event<void>()
  readonly onPttUp = new Event<void>()
  readonly onReaction = new Event<TalkyReactionId>()
  readonly onRestoreUi = new Event<void>()

  private radioBody: SceneObject | null = null
  private lobbyButtons: SceneObject | null = null
  private inRoomControls: SceneObject | null = null
  private digitTexts: Text[] = []
  private statusText: Text | null = null
  private transmitText: Text | null = null
  private reactionToastText: Text | null = null
  private emojiRowText: Text | null = null
  private restoreUiButton: SceneObject | null = null
  private toastTimer: DelayedCallbackEvent | null = null
  private localUserId: string = ""
  private uiMinimized: boolean = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.buildRadio())
  }

  private buildRadio(): void {
    if (!this.radioAnchor) {
      print("TalkyRadioController: radioAnchor not wired")
      return
    }

    this.spawnBodyMesh()
    this.buildDigitWheels()
    this.buildLobbyButtons()
    this.buildInRoomControls()
    this.buildHudLabels()
    this.buildRestoreUiButton()
    this.setMode("lobby")
    this.setDigits([0, 4, 2])
  }

  private spawnBodyMesh(): void {
    let body: SceneObject | null = null
    try {
      const prefab = requireAsset("../GeneratedMeshes/WalkieDevice.glb") as ObjectPrefab
      body = prefab.instantiate(this.radioAnchor)
    } catch (_e) {
      body = null
    }
    if (body) {
      body.name = "ToyRadioBody"
      body.getTransform().setLocalPosition(vec3.zero())
      body.getTransform().setLocalScale(new vec3(RADIO_BODY_SCALE, RADIO_BODY_SCALE, RADIO_BODY_SCALE))
      this.radioBody = body
    }
  }

  private buildDigitWheels(): void {
    const row = global.scene.createSceneObject("DigitWheels")
    row.setParent(this.radioAnchor)
    row.getTransform().setLocalPosition(new vec3(0, 1.8, 1.0))

    const spacing = DIGIT_SPACING
    const startX = -((TALKY_DIGIT_COUNT - 1) * spacing) / 2
    for (let i = 0; i < TALKY_DIGIT_COUNT; i++) {
      const col = global.scene.createSceneObject("Wheel" + i)
      col.setParent(row)
      col.getTransform().setLocalPosition(new vec3(startX + i * spacing, 0, 0))

      this.addSpatialButton(col, "▲", new vec3(1.5, 0.95, 0.25), new vec3(0, 1.05, 0), () => {
        this.onDigitBump.invoke({index: i, delta: 1})
      })

      const digitSO = global.scene.createSceneObject("Digit")
      digitSO.setParent(col)
      digitSO.getTransform().setLocalPosition(new vec3(0, 0, 0.15))
      const t = digitSO.createComponent("Component.Text") as Text
      t.text = "0"
      applyTalkyText(t, 42, true)
      setTextColor(t, TALKY_WHITE)
      t.horizontalAlignment = HorizontalAlignment.Center
      this.digitTexts[i] = t

      this.addSpatialButton(col, "▼", new vec3(1.5, 0.95, 0.25), new vec3(0, -1.05, 0), () => {
        this.onDigitBump.invoke({index: i, delta: -1})
      })
    }
  }

  private buildLobbyButtons(): void {
    this.lobbyButtons = global.scene.createSceneObject("LobbyButtons")
    this.lobbyButtons.setParent(this.radioAnchor)
    this.lobbyButtons.getTransform().setLocalPosition(new vec3(0, 0.15, 1.2))

    this.addSpatialButton(this.lobbyButtons, "GO", new vec3(2.6, 1.2, 0.28), new vec3(-1.7, 0, 0), () => {
      this.onCreate.invoke()
    })
    this.addSpatialButton(this.lobbyButtons, "JOIN", new vec3(2.6, 1.2, 0.28), new vec3(1.7, 0, 0), () => {
      this.onJoin.invoke()
    })
  }

  private buildInRoomControls(): void {
    this.inRoomControls = global.scene.createSceneObject("InRoomControls")
    this.inRoomControls.setParent(this.radioAnchor)
    this.inRoomControls.enabled = false
    this.inRoomControls.getTransform().setLocalPosition(new vec3(0, 0.15, 1.2))

    const pttHost = global.scene.createSceneObject("PTT")
    pttHost.setParent(this.inRoomControls)
    pttHost.getTransform().setLocalPosition(vec3.zero())
    const pttBtn = this.addSpatialButton(pttHost, "TALK", new vec3(3.5, 1.6, 0.28), vec3.zero(), () => {}, true)
    pttBtn.onTriggerDown.add(() => this.onPttDown.invoke())
    pttBtn.onTriggerUp.add(() => this.onPttUp.invoke())

    this.addSpatialButton(this.inRoomControls, "LEAVE", new vec3(2.4, 1.2, 0.28), new vec3(-3.8, 0, 0), () => {
      this.onLeave.invoke()
    })

    this.buildReactionPad()
  }

  /** 2-row reaction grid below the PTT button — spaced for hand tracking. */
  private buildReactionPad(): void {
    if (!this.inRoomControls) {
      return
    }

    const pad = global.scene.createSceneObject("ReactionPad")
    pad.setParent(this.inRoomControls)
    pad.getTransform().setLocalPosition(new vec3(0, -3.0, 0.05))

    const cell = REACTION_BTN + REACTION_GAP
    const row0Y = cell * 0.5
    const row1Y = -cell * 0.5

    for (let i = 0; i < TalkyReactionList.length; i++) {
      const r = TalkyReactionList[i]
      const row = i < REACTION_COLS ? 0 : 1
      const colInRow = row === 0 ? i : i - REACTION_COLS
      const colsThisRow = row === 0 ? REACTION_COLS : TalkyReactionList.length - REACTION_COLS
      const rowW = colsThisRow * cell - REACTION_GAP
      const startX = -rowW / 2 + REACTION_BTN / 2
      const x = startX + colInRow * cell
      const y = row === 0 ? row0Y : row1Y

      this.addReactionButton(pad, r.id, r.emoji, r.label, new vec3(x, y, 0))
    }

    const toastSO = global.scene.createSceneObject("ReactionToast")
    toastSO.setParent(pad)
    toastSO.getTransform().setLocalPosition(new vec3(0, -row1Y - 1.4, 0.1))
    this.reactionToastText = toastSO.createComponent("Component.Text") as Text
    this.reactionToastText.text = ""
    applyTalkyText(this.reactionToastText, 16, false)
    this.reactionToastText.horizontalAlignment = HorizontalAlignment.Center
  }

  private iconForReaction(id: TalkyReactionId): Texture | null {
    switch (id) {
      case "wizz":
        return requireAsset("../Icons/phone_in_talk.png") as Texture
      case "applause":
        return requireAsset("../Icons/celebration.png") as Texture
      case "doorbell":
        return requireAsset("../Icons/door_front.png") as Texture
      case "laugh":
        return requireAsset("../Icons/theater_comedy.png") as Texture
      case "boo":
        return requireAsset("../Icons/sentiment_very_dissatisfied.png") as Texture
      case "airhorn":
        return requireAsset("../Icons/campaign.png") as Texture
      case "heart":
        return requireAsset("../Icons/favorite.png") as Texture
      default:
        return null
    }
  }

  private addReactionButton(
    parent: SceneObject,
    id: TalkyReactionId,
    emoji: string,
    label: string,
    localPos: vec3
  ): void {
    const so = global.scene.createSceneObject("React_" + id)
    so.setParent(parent)
    so.getTransform().setLocalPosition(localPos)

    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(REACTION_BTN, REACTION_BTN, 0.35)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const icon = this.iconForReaction(id)
    if (icon) {
      ec.leadingIcon = icon
    }
    ec.text = emoji
    ec.iconLayout = "top"
    ec.textSize = 16

    const baseScale = so.getTransform().getLocalScale()
    btn.onTriggerDown.add(() => {
      so.getTransform().setLocalScale(baseScale.uniformScale(0.88))
    })
    btn.onTriggerUp.add(() => {
      so.getTransform().setLocalScale(baseScale)
      this.onReaction.invoke(id)
      this.showReactionToast(label)
    })
  }

  private buildHudLabels(): void {
    const emojiSO = global.scene.createSceneObject("ConnectedEmojis")
    emojiSO.setParent(this.radioAnchor)
    emojiSO.getTransform().setLocalPosition(new vec3(0, 2.4, 0.95))
    this.emojiRowText = emojiSO.createComponent("Component.Text") as Text
    this.emojiRowText.text = ""
    applyTalkyText(this.emojiRowText, 22, false)
    this.emojiRowText.horizontalAlignment = HorizontalAlignment.Center

    const statusSO = global.scene.createSceneObject("RadioStatus")
    statusSO.setParent(this.radioAnchor)
    statusSO.getTransform().setLocalPosition(new vec3(0, 3.0, 0.9))
    this.statusText = statusSO.createComponent("Component.Text") as Text
    this.statusText.text = "Spin the dial"
    applyTalkyText(this.statusText, 18, false)
    this.statusText.horizontalAlignment = HorizontalAlignment.Center

    const txSO = global.scene.createSceneObject("TransmitBadge")
    txSO.setParent(this.radioAnchor)
    txSO.getTransform().setLocalPosition(new vec3(0, 3.6, 0.9))
    this.transmitText = txSO.createComponent("Component.Text") as Text
    this.transmitText.text = ""
    applyTalkyText(this.transmitText, 16, true)
    this.transmitText.horizontalAlignment = HorizontalAlignment.Center
  }

  private buildRestoreUiButton(): void {
    this.restoreUiButton = global.scene.createSceneObject("RestoreUi")
    this.restoreUiButton.setParent(this.radioAnchor)
    this.restoreUiButton.getTransform().setLocalPosition(new vec3(4.8, 1.5, 1.0))
    this.restoreUiButton.enabled = false
    this.addSpatialButton(this.restoreUiButton, "UI", new vec3(2.0, 2.0, 0.28), vec3.zero(), () => {
      this.onRestoreUi.invoke()
    })
  }

  private addSpatialButton(
    parent: SceneObject,
    label: string,
    size: vec3,
    localPos: vec3,
    onTap: () => void,
    isHold: boolean = false
  ): Button {
    const so = global.scene.createSceneObject("Btn_" + label)
    so.setParent(parent)
    so.getTransform().setLocalPosition(localPos)

    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = size
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = label
    styleElementContentWhite(ec, 18)

    const baseScale = so.getTransform().getLocalScale()
    btn.onTriggerDown.add(() => {
      so.getTransform().setLocalScale(baseScale.uniformScale(0.92))
    })
    btn.onTriggerUp.add(() => {
      so.getTransform().setLocalScale(baseScale)
      if (!isHold) {
        onTap()
      }
    })
    return btn
  }

  setDigits(digits: number[]): void {
    for (let i = 0; i < TALKY_DIGIT_COUNT; i++) {
      const t = this.digitTexts[i]
      if (t) {
        t.text = String(digits[i] ?? 0)
        setTextColor(t, TALKY_WHITE)
      }
    }
  }

  setLocalUserId(id: string): void {
    this.localUserId = id
  }

  setParticipants(list: TalkyParticipant[]): void {
    if (this.emojiRowText) {
      const row = formatParticipantEmojiRow(list, this.localUserId)
      this.emojiRowText.text = list.length > 0 ? row : ""
      setTextColor(this.emojiRowText, TALKY_WHITE)
    }
  }

  setUiMinimized(minimized: boolean): void {
    this.uiMinimized = minimized
    if (this.restoreUiButton) {
      this.restoreUiButton.enabled = false
    }
  }

  /** Hide the entire 3D radio + all controls (full minimize). */
  setFullyHidden(hidden: boolean): void {
    if (this.radioAnchor) {
      this.radioAnchor.enabled = !hidden
    }
  }

  setConnectionState(state: "connecting" | "connected", list: TalkyParticipant[]): void {
    if (this.emojiRowText) {
      const row = formatParticipantEmojiRow(list, this.localUserId)
      this.emojiRowText.text = row.length > 0 ? row : state === "connected" ? "👻●" : ""
      setTextColor(this.emojiRowText, TALKY_WHITE)
    }
    if (this.statusText && state === "connected") {
      const count = list.length
      this.statusText.text = count > 1 ? `${count} friends here` : "Room live · waiting"
      setTextColor(this.statusText, TALKY_WHITE)
    }
  }

  setStatus(msg: string): void {
    if (this.statusText) {
      this.statusText.text = msg
      setTextColor(this.statusText, TALKY_WHITE)
    }
  }

  setTransmitting(active: boolean): void {
    if (this.transmitText) {
      this.transmitText.text = active ? "● ON AIR" : ""
      applyTalkyText(this.transmitText, 16, active)
    }
  }

  showReactionToast(msg: string): void {
    if (!this.reactionToastText) {
      return
    }
    this.reactionToastText.text = msg
    if (!this.toastTimer) {
      this.toastTimer = this.createEvent("DelayedCallbackEvent")
      this.toastTimer.bind(() => {
        if (this.reactionToastText) {
          this.reactionToastText.text = ""
        }
      })
    }
    this.toastTimer.reset(2.0)
  }

  setMode(mode: RadioMode): void {
    if (this.lobbyButtons) {
      this.lobbyButtons.enabled = mode === "lobby"
    }
    if (this.inRoomControls) {
      this.inRoomControls.enabled = mode === "in_room"
    }
  }

  setVisible(visible: boolean): void {
    if (this.radioAnchor) {
      this.radioAnchor.enabled = visible
    }
  }
}
