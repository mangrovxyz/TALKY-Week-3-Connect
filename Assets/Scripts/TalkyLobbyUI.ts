/**
 * TalkyLobbyUI — compact yellow status strip with logo.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TALKY_DIGIT_COUNT} from "./TalkyAssetManifest"
import {
  applyTalkyText,
  setTextColor,
  styleElementContentWhite,
  TALKY_PANEL_LOBBY_W,
  TALKY_WHITE,
  whitenTextsUnder,
} from "./TalkyTheme"

@component
export class TalkyLobbyUI extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyLobbyUI – status strip</span>')
  @ui.separator

  @input
  @widget(new SliderWidget(8, 16, 1))
  panelWidth: number = TALKY_PANEL_LOBBY_W

  readonly onCreate = new Event<void>()
  readonly onJoin = new Event<void>()
  readonly onDigitBump = new Event<{index: number; delta: number}>()
  readonly onToggleDigitCount = new Event<void>()
  readonly onMinimize = new Event<void>()

  private statusText: Text | null = null
  private contentRoot: SceneObject | null = null
  private built = false

  onAwake(): void {
    this.build()
  }

  private build(): void {
    if (this.built) {
      return
    }
    this.built = true
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    plate.onInitialized.add(() => {
      this.contentRoot = global.scene.createSceneObject("Content")
      this.contentRoot.setParent(plate.sceneObject)
      this.contentRoot.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

      const col = this.contentRoot.createComponent(FlexLayout.getTypeName()) as FlexLayout
      col.width = this.panelWidth
      col.height = -1
      col.direction = FlexDirection.Column
      col.alignItems = FlexAlign.Center
      col.rowGap = 0.28
      col.paddingTop = 0.35
      col.paddingBottom = 0.35

      const header = global.scene.createSceneObject("Header")
      header.setParent(this.contentRoot)
      const headerFlex = header.createComponent(FlexLayout.getTypeName()) as FlexLayout
      headerFlex.width = this.panelWidth
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
        styleElementContentWhite(logoEc, 14)
      }
      logoEc.leadingIconSize = 1.4
      logoSO.createComponent(FlexItem.getTypeName())

      const hideSO = global.scene.createSceneObject("HideUi")
      hideSO.setParent(header)
      const hideBtn = hideSO.createComponent(Button.getTypeName()) as Button
      hideBtn.size = new vec3(2.0, 1.3, 1)
      const hideEc = hideSO.createComponent(ElementContent.getTypeName()) as ElementContent
      hideEc.text = "Hide"
      styleElementContentWhite(hideEc, 13)
      hideSO.createComponent(FlexItem.getTypeName())
      hideBtn.onTriggerUp.add(() => this.onMinimize.invoke())

      const titleSO = global.scene.createSceneObject("Title")
      titleSO.setParent(this.contentRoot)
      const title = titleSO.createComponent("Component.Text") as Text
      title.text = "TALKY"
      applyTalkyText(title, 24, true)
      title.horizontalAlignment = HorizontalAlignment.Center
      titleSO.createComponent(FlexItem.getTypeName())

      const hintSO = global.scene.createSceneObject("Hint")
      hintSO.setParent(this.contentRoot)
      const hint = hintSO.createComponent("Component.Text") as Text
      hint.text = "Spin the radio dial"
      applyTalkyText(hint, 15, false)
      hint.horizontalAlignment = HorizontalAlignment.Center
      hintSO.createComponent(FlexItem.getTypeName())

      const statusSO = global.scene.createSceneObject("Status")
      statusSO.setParent(this.contentRoot)
      this.statusText = statusSO.createComponent("Component.Text") as Text
      this.statusText.text = "Spin the dial"
      applyTalkyText(this.statusText, 15, false)
      this.statusText.horizontalAlignment = HorizontalAlignment.Center
      statusSO.createComponent(FlexItem.getTypeName())

      whitenTextsUnder(this.contentRoot)

      col.onLayoutComplete.add((r) => {
        plate.size = new vec2(r.containerWidth + 0.7, r.containerHeight + 0.5)
      })
      col.markDirty()
    })
  }

  setDigits(_digits: number[], _digitCount: number = TALKY_DIGIT_COUNT): void {}

  setStatus(msg: string): void {
    if (this.statusText) {
      this.statusText.text = msg
      setTextColor(this.statusText, TALKY_WHITE)
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
}
