/**
 * TalkyChatUI — compact room chat: scrollable messages, voice dictation, keyboard fallback.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyChatMessage} from "./TalkyCloudController"
import {
  applyTalkyText,
  setTextColor,
  styleElementContentWhite,
  TALKY_PANEL_CHAT_H,
  TALKY_PANEL_CHAT_W,
  TALKY_WHITE,
  whitenTextsUnder,
} from "./TalkyTheme"

const MAX_VISIBLE_MESSAGES = 5

@component
export class TalkyChatUI extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyChatUI – room text chat</span>')
  @ui.separator

  @input
  @widget(new SliderWidget(7, 16, 1))
  panelWidth: number = TALKY_PANEL_CHAT_W

  @input
  @widget(new SliderWidget(6, 14, 1))
  panelHeight: number = TALKY_PANEL_CHAT_H

  readonly onSendMessage = new Event<string>()
  readonly onDictateDown = new Event<void>()
  readonly onDictateUp = new Event<void>()
  readonly onKeyboard = new Event<void>()
  readonly onMinimize = new Event<void>()

  private messagesText: Text | null = null
  private draftText: Text | null = null
  private contentRoot: SceneObject | null = null
  private messages: TalkyChatMessage[] = []
  private draft: string = ""
  private built = false

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
      frame.padding = new vec2(0.35, 0.35)
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
    col.rowGap = 0.28
    col.paddingTop = 0.3
    col.paddingBottom = 0.3
    col.paddingLeft = 0.35
    col.paddingRight = 0.35

    const header = global.scene.createSceneObject("Header")
    header.setParent(this.contentRoot)
    const headerFlex = header.createComponent(FlexLayout.getTypeName()) as FlexLayout
    headerFlex.width = this.panelWidth - 0.7
    headerFlex.height = -1
    headerFlex.direction = FlexDirection.Row
    headerFlex.alignItems = FlexAlign.Center
    headerFlex.justifyContent = FlexJustify.SpaceBetween
    header.createComponent(FlexItem.getTypeName())

    const titleSO = global.scene.createSceneObject("Title")
    titleSO.setParent(header)
    const title = titleSO.createComponent("Component.Text") as Text
    title.text = "CHAT"
    applyTalkyText(title, 17, true)
    titleSO.createComponent(FlexItem.getTypeName())

    const hideSO = global.scene.createSceneObject("HideChat")
    hideSO.setParent(header)
    const hideBtn = hideSO.createComponent(Button.getTypeName()) as Button
    hideBtn.size = new vec3(1.9, 1.2, 1)
    const hideEc = hideSO.createComponent(ElementContent.getTypeName()) as ElementContent
    hideEc.text = "Hide"
    styleElementContentWhite(hideEc, 12)
    hideSO.createComponent(FlexItem.getTypeName())
    hideBtn.onTriggerUp.add(() => this.onMinimize.invoke())

    const msgSO = global.scene.createSceneObject("Messages")
    msgSO.setParent(this.contentRoot)
    this.messagesText = msgSO.createComponent("Component.Text") as Text
    this.messagesText.text = "Say something…"
    applyTalkyText(this.messagesText, 14, false)
    this.messagesText.horizontalAlignment = HorizontalAlignment.Left
    this.messagesText.verticalAlignment = VerticalAlignment.Top
    msgSO.createComponent(FlexItem.getTypeName())

    const draftSO = global.scene.createSceneObject("Draft")
    draftSO.setParent(this.contentRoot)
    this.draftText = draftSO.createComponent("Component.Text") as Text
    this.draftText.text = ""
    applyTalkyText(this.draftText, 14, false)
    this.draftText.horizontalAlignment = HorizontalAlignment.Left
    draftSO.createComponent(FlexItem.getTypeName())

    const row = global.scene.createSceneObject("Actions")
    row.setParent(this.contentRoot)
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.width = this.panelWidth - 0.7
    rowFlex.height = -1
    rowFlex.direction = FlexDirection.Row
    rowFlex.columnGap = 0.28
    rowFlex.alignItems = FlexAlign.Center
    row.createComponent(FlexItem.getTypeName())

    this.addActionButton(row, "🎤", "Dictate", true)
    this.addActionButton(row, "⌨", "Keys", false, () => this.onKeyboard.invoke())
    this.addActionButton(row, "Send", "Send", false, () => this.trySend())

    whitenTextsUnder(this.contentRoot)
  }

  private addActionButton(
    parent: SceneObject,
    label: string,
    name: string,
    isHold: boolean,
    onTap?: () => void
  ): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(2.5, 1.7, 1)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = label
    styleElementContentWhite(ec, 14)
    so.createComponent(FlexItem.getTypeName())
    if (isHold) {
      btn.onTriggerDown.add(() => this.onDictateDown.invoke())
      btn.onTriggerUp.add(() => this.onDictateUp.invoke())
    } else if (onTap) {
      btn.onTriggerUp.add(onTap)
    }
  }

  setDraft(text: string): void {
    this.draft = text
    if (this.draftText) {
      this.draftText.text = text.length > 0 ? `"${text}"` : ""
      setTextColor(this.draftText, TALKY_WHITE)
    }
  }

  appendDraft(text: string): void {
    if (!text || text.length === 0) {
      return
    }
    this.setDraft(text)
  }

  private trySend(): void {
    const trimmed = this.draft.trim()
    if (trimmed.length === 0) {
      return
    }
    this.onSendMessage.invoke(trimmed)
    this.setDraft("")
  }

  sendDraftIfAny(): void {
    this.trySend()
  }

  addMessage(msg: TalkyChatMessage): void {
    this.messages.push(msg)
    if (this.messages.length > 20) {
      this.messages.shift()
    }
    this.refreshMessages()
  }

  clearMessages(): void {
    this.messages = []
    this.setDraft("")
    this.refreshMessages()
  }

  private refreshMessages(): void {
    if (!this.messagesText) {
      return
    }
    if (this.messages.length === 0) {
      this.messagesText.text = "Hold 🎤 to dictate · or ⌨ to type"
      setTextColor(this.messagesText, TALKY_WHITE)
      return
    }
    const start = Math.max(0, this.messages.length - MAX_VISIBLE_MESSAGES)
    let block = ""
    for (let i = start; i < this.messages.length; i++) {
      const m = this.messages[i]
      const line = `${m.name}: ${m.text}`
      block += line + (i < this.messages.length - 1 ? "\n" : "")
    }
    this.messagesText.text = block
    setTextColor(this.messagesText, TALKY_WHITE)
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }
}
