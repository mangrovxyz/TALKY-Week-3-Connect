/**
 * TalkyRoomUI — compact in-room HUD: connection, emoji roster, PTT, leave.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {Switch} from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyParticipant} from "./TalkyState"
import {formatParticipantEmojiRow, formatParticipantSummary} from "./TalkyParticipantEmojis"
import {
  applyTalkyText,
  setTextColor,
  styleElementContentWhite,
  TALKY_PANEL_ROOM_H,
  TALKY_PANEL_ROOM_W,
  TALKY_WHITE,
  whitenTextsUnder,
} from "./TalkyTheme"

@component
export class TalkyRoomUI extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyRoomUI – live room HUD</span>')
  @ui.separator

  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(8, 18, 1))
  panelWidth: number = TALKY_PANEL_ROOM_W

  @input
  @widget(new SliderWidget(7, 16, 1))
  panelHeight: number = TALKY_PANEL_ROOM_H
  @ui.group_end

  readonly onLeave = new Event<void>()
  readonly onPttDown = new Event<void>()
  readonly onPttUp = new Event<void>()
  readonly onAlwaysOnChanged = new Event<boolean>()
  readonly onMinimize = new Event<void>()

  private codeText: Text | null = null
  private statusText: Text | null = null
  private connectedText: Text | null = null
  private emojiRowText: Text | null = null
  private participantsText: Text | null = null
  private speakingText: Text | null = null
  private transmitText: Text | null = null
  private contentRoot: SceneObject | null = null
  private built: boolean = false
  private localUserId: string = ""

  onAwake(): void {
    this.getSceneObject().enabled = false
    this.build()
  }

  private build(): void {
    if (this.built) {
      return
    }
    this.built = true
    this.sceneObject.createComponent("Component.Canvas")
    const frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false

    frame.onInitialized.add(() => {
      frame.innerSize = new vec2(this.panelWidth, this.panelHeight)
      frame.padding = new vec2(0.45, 0.45)
      this.buildContent(frame.contentTransform.getSceneObject())
    })
  }

  private buildContent(host: SceneObject): void {
    this.contentRoot = global.scene.createSceneObject("Content")
    this.contentRoot.setParent(host)
    this.contentRoot.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

    const col = this.contentRoot.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.width = this.panelWidth
    col.height = -1
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.rowGap = 0.32
    col.paddingTop = 0.35
    col.paddingBottom = 0.35
    col.paddingLeft = 0.45
    col.paddingRight = 0.45

    const header = global.scene.createSceneObject("Header")
    header.setParent(this.contentRoot)
    const headerFlex = header.createComponent(FlexLayout.getTypeName()) as FlexLayout
    headerFlex.width = this.panelWidth - 0.9
    headerFlex.height = -1
    headerFlex.direction = FlexDirection.Row
    headerFlex.alignItems = FlexAlign.Center
    headerFlex.justifyContent = FlexJustify.SpaceBetween
    header.createComponent(FlexItem.getTypeName())

    const logoSO = global.scene.createSceneObject("Logo")
    logoSO.setParent(header)
    const logoEc = logoSO.createComponent(ElementContent.getTypeName()) as ElementContent
    try {
      logoEc.leadingIcon = requireAsset("../Textures/TalkyLogo.png") as Texture
    } catch (_e) {
      logoEc.text = "👻"
      styleElementContentWhite(logoEc, 16)
    }
    logoEc.leadingIconSize = 1.3
    logoSO.createComponent(FlexItem.getTypeName())

    const hideSO = global.scene.createSceneObject("HideUi")
    hideSO.setParent(header)
    const hideBtn = hideSO.createComponent(Button.getTypeName()) as Button
    hideBtn.size = new vec3(2.2, 1.4, 1)
    const hideEc = hideSO.createComponent(ElementContent.getTypeName()) as ElementContent
    hideEc.text = "Hide"
    styleElementContentWhite(hideEc, 14)
    hideSO.createComponent(FlexItem.getTypeName())
    hideBtn.onTriggerUp.add(() => this.onMinimize.invoke())

    this.codeText = this.addLabel(this.contentRoot, "042", 28, true)
    this.connectedText = this.addLabel(this.contentRoot, "Connecting…", 17, true)
    this.emojiRowText = this.addLabel(this.contentRoot, "—", 22, false)
    this.statusText = this.addLabel(this.contentRoot, "", 15, false)
    this.speakingText = this.addLabel(this.contentRoot, "Nobody speaking", 15)
    this.transmitText = this.addLabel(this.contentRoot, "Mic idle", 14, false)
    this.participantsText = this.addLabel(this.contentRoot, "1/8", 14, false)

    const ptt = global.scene.createSceneObject("PTT")
    ptt.setParent(this.contentRoot)
    const pttBtn = ptt.createComponent(Button.getTypeName()) as Button
    pttBtn.size = new vec3(this.panelWidth - 0.9, 2.2, 1)
    const pttEc = ptt.createComponent(ElementContent.getTypeName()) as ElementContent
    pttEc.text = "Hold to Talk"
    pttEc.leadingIcon = requireAsset("../Icons/mic.png") as Texture
    pttEc.iconLayout = "left"
    styleElementContentWhite(pttEc, 15)
    ptt.createComponent(FlexItem.getTypeName())
    pttBtn.onTriggerDown.add(() => this.onPttDown.invoke())
    pttBtn.onTriggerUp.add(() => this.onPttUp.invoke())

    const alwaysRow = global.scene.createSceneObject("AlwaysOnRow")
    alwaysRow.setParent(this.contentRoot)
    const alwaysFlex = alwaysRow.createComponent(FlexLayout.getTypeName()) as FlexLayout
    alwaysFlex.width = this.panelWidth - 0.9
    alwaysFlex.height = -1
    alwaysFlex.direction = FlexDirection.Row
    alwaysFlex.alignItems = FlexAlign.Center
    alwaysFlex.justifyContent = FlexJustify.SpaceBetween
    alwaysRow.createComponent(FlexItem.getTypeName())
    this.addLabel(alwaysRow, "Always-On", 14)
    const swSO = global.scene.createSceneObject("AlwaysSwitch")
    swSO.setParent(alwaysRow)
    const sw = swSO.createComponent(Switch.getTypeName()) as Switch
    sw.size = new vec3(3.8, 1.5, 1)
    swSO.createComponent(FlexItem.getTypeName())
    sw.onFinished.add((on: boolean) => {
      this.onAlwaysOnChanged.invoke(on)
    })

    const leave = global.scene.createSceneObject("Leave")
    leave.setParent(this.contentRoot)
    const leaveBtn = leave.createComponent(Button.getTypeName()) as Button
    leaveBtn.size = new vec3(this.panelWidth - 0.9, 1.9, 1)
    const leaveEc = leave.createComponent(ElementContent.getTypeName()) as ElementContent
    leaveEc.text = "Leave"
    leaveEc.leadingIcon = requireAsset("../Icons/logout.png") as Texture
    leaveEc.iconLayout = "left"
    styleElementContentWhite(leaveEc, 14)
    leave.createComponent(FlexItem.getTypeName())
    leaveBtn.onTriggerUp.add(() => this.onLeave.invoke())

    whitenTextsUnder(this.contentRoot)
  }

  private addLabel(parent: SceneObject, text: string, size: number, bold: boolean = false): Text {
    const so = global.scene.createSceneObject("Label")
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    applyTalkyText(t, size, bold)
    setTextColor(t, TALKY_WHITE)
    t.horizontalAlignment = HorizontalAlignment.Center
    so.createComponent(FlexItem.getTypeName())
    return t
  }

  setLocalUserId(id: string): void {
    this.localUserId = id
  }

  setRoomCode(code: string): void {
    if (this.codeText) {
      this.codeText.text = code
      setTextColor(this.codeText, TALKY_WHITE)
    }
  }

  setConnectionState(
    state: "connecting" | "connected" | "waiting",
    list: TalkyParticipant[],
    max: number
  ): void {
    this.setParticipants(list, max)
    if (!this.connectedText) {
      return
    }
    if (state === "connecting") {
      this.connectedText.text = "… connecting"
      applyTalkyText(this.connectedText, 17, false)
      if (this.statusText) {
        this.statusText.text = "Joining room…"
      }
    } else {
      this.connectedText.text = "● LIVE"
      applyTalkyText(this.connectedText, 17, true)
      const count = list.length
      if (this.statusText) {
        if (count <= 1) {
          this.statusText.text = "In room · waiting for friends"
        } else {
          this.statusText.text = `${count} connected in room`
        }
      }
    }
  }

  setStatus(msg: string): void {
    if (this.statusText) {
      this.statusText.text = msg
      setTextColor(this.statusText, TALKY_WHITE)
    }
  }

  setParticipants(list: TalkyParticipant[], max: number): void {
    if (this.participantsText) {
      this.participantsText.text = formatParticipantSummary(list, max)
      setTextColor(this.participantsText, TALKY_WHITE)
    }
    if (this.emojiRowText) {
      const row = formatParticipantEmojiRow(list, this.localUserId)
      this.emojiRowText.text = row.length > 0 ? row : "👻●"
      setTextColor(this.emojiRowText, TALKY_WHITE)
    }
  }

  setSpeaking(name: string): void {
    if (this.speakingText) {
      this.speakingText.text = name && name.length > 0 ? `Speaking: ${name}` : "Nobody speaking"
      setTextColor(this.speakingText, TALKY_WHITE)
    }
  }

  setTransmitting(active: boolean): void {
    if (this.transmitText) {
      this.transmitText.text = active ? "● ON AIR" : "Mic idle"
      applyTalkyText(this.transmitText, 14, active)
    }
  }

  setCollapsed(collapsed: boolean): void {
    if (this.contentRoot) {
      this.contentRoot.enabled = !collapsed
    }
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }

  showRoomFull(code: string): void {
    this.setVisible(true)
    this.setRoomCode(code)
    this.setStatus(`Room ${code} is full (8/8). Try another code.`)
  }
}
