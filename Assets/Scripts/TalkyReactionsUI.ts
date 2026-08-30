/**
 * TalkyReactionsUI — MSN-Wizz style reaction grid (spatial buttons).
 * Passive view — emits onReaction; Main broadcasts + plays local SFX.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {GridLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout"
import {GridItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridItem"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyReactionId, TalkyReactionList} from "./TalkyAssetManifest"
import {applyTalkyText, styleElementContentWhite, whitenTextsUnder} from "./TalkyTheme"

@component
export class TalkyReactionsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyReactionsUI – reaction board</span>')
  @ui.separator

  @ui.group_start("Settings")
  @input
  @hint("Panel width (cm)")
  @widget(new SliderWidget(10, 22, 1))
  panelWidth: number = 13

  @input
  @hint("Panel height (cm)")
  @widget(new SliderWidget(8, 18, 1))
  panelHeight: number = 10
  @ui.group_end

  readonly onReaction = new Event<TalkyReactionId>()

  private toastText: Text | null = null
  private built: boolean = false

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
    const content = global.scene.createSceneObject("Content")
    content.setParent(host)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.width = this.panelWidth
    col.height = -1
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.rowGap = 0.35
    col.paddingTop = 0.35
    col.paddingBottom = 0.35
    col.paddingLeft = 0.45
    col.paddingRight = 0.45

    const titleSO = global.scene.createSceneObject("Title")
    titleSO.setParent(content)
    const title = titleSO.createComponent("Component.Text") as Text
    title.text = "FUN"
    applyTalkyText(title, 20, true)
    title.horizontalAlignment = HorizontalAlignment.Center
    titleSO.createComponent(FlexItem.getTypeName())

    const gridHost = global.scene.createSceneObject("Grid")
    gridHost.setParent(content)
    const grid = gridHost.createComponent(GridLayout.getTypeName()) as GridLayout
    grid.width = this.panelWidth - 2.0
    grid.height = -1
    grid.autoColumns = "1fr 1fr 1fr 1fr"
    grid.columnGap = 0.35
    grid.rowGap = 0.35
    gridHost.createComponent(FlexItem.getTypeName())

    for (let i = 0; i < TalkyReactionList.length; i++) {
      const reaction = TalkyReactionList[i]
      this.addReactionButton(gridHost, reaction.id, reaction.label, reaction.icon)
    }

    const toastSO = global.scene.createSceneObject("Toast")
    toastSO.setParent(content)
    this.toastText = toastSO.createComponent("Component.Text") as Text
    this.toastText.text = "Tap a reaction"
    applyTalkyText(this.toastText, 15, false)
    this.toastText.horizontalAlignment = HorizontalAlignment.Center
    toastSO.createComponent(FlexItem.getTypeName())
    whitenTextsUnder(content)
  }

  private iconForReaction(id: TalkyReactionId): Texture | null {
    // requireAsset paths must be string literals (no template strings)
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

  private addReactionButton(parent: SceneObject, id: TalkyReactionId, label: string, _iconName: string): void {
    const so = global.scene.createSceneObject(label)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(2.8, 2.8, 0.8)
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    const icon = this.iconForReaction(id)
    if (icon) {
      ec.leadingIcon = icon
    }
    ec.text = label
    ec.iconLayout = "top"
    styleElementContentWhite(ec, 14)
    so.createComponent(GridItem.getTypeName())
    btn.onTriggerUp.add(() => {
      this.onReaction.invoke(id)
      this.showToast(label)
    })
  }

  showToast(msg: string): void {
    if (this.toastText) {
      this.toastText.text = msg
    }
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }
}
