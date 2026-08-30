/**
 * TalkyOnboardingUI — first-run explainer panel with logo + dismiss button.
 */

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {
  applyTalkyText,
  styleElementContentWhite,
  TALKY_PANEL_ONBOARD_H,
  TALKY_PANEL_ONBOARD_W,
  whitenTextsUnder,
} from "./TalkyTheme"

@component
export class TalkyOnboardingUI extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyOnboardingUI – welcome panel</span>')
  @ui.separator

  @input
  @widget(new SliderWidget(9, 18, 1))
  panelWidth: number = TALKY_PANEL_ONBOARD_W

  @input
  @widget(new SliderWidget(10, 20, 1))
  panelHeight: number = TALKY_PANEL_ONBOARD_H

  readonly onDismiss = new Event<void>()

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
    const frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false

    frame.onInitialized.add(() => {
      frame.innerSize = new vec2(this.panelWidth, this.panelHeight)
      frame.padding = new vec2(0.5, 0.5)
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
    col.alignItems = FlexAlign.Center
    col.rowGap = 0.38
    col.paddingTop = 0.45
    col.paddingBottom = 0.45
    col.paddingLeft = 0.5
    col.paddingRight = 0.5

    const logoSO = global.scene.createSceneObject("Logo")
    logoSO.setParent(content)
    const logoEc = logoSO.createComponent(ElementContent.getTypeName()) as ElementContent
    try {
      logoEc.leadingIcon = requireAsset("../Textures/TalkyLogo.png") as Texture
    } catch (_e) {
      logoEc.text = "👻📻"
      styleElementContentWhite(logoEc, 18)
    }
    logoEc.leadingIconSize = 2.4
    logoEc.textSize = 22
    logoSO.createComponent(FlexItem.getTypeName())

    this.addText(content, "TALKY", 26, true)
    this.addText(content, "Walkie-talkie for Specs", 16, false)
    this.addText(content, "1. Spin the 3-digit dial", 14, false)
    this.addText(content, "2. Tap GO or JOIN same code", 14, false)
    this.addText(content, "3. Hold TALK · tap reactions", 14, false)
    this.addText(content, "4. Hide UI for clear view", 14, false)

    const btnSO = global.scene.createSceneObject("GotIt")
    btnSO.setParent(content)
    const btn = btnSO.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(this.panelWidth - 1.0, 2.1, 1)
    const ec = btnSO.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = "Got it!"
    styleElementContentWhite(ec, 16)
    btnSO.createComponent(FlexItem.getTypeName())
    btn.onTriggerUp.add(() => {
      this.setVisible(false)
      this.onDismiss.invoke()
    })

    whitenTextsUnder(content)
  }

  private addText(parent: SceneObject, text: string, size: number, bold: boolean): void {
    const so = global.scene.createSceneObject("Line")
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    applyTalkyText(t, size, bold)
    t.horizontalAlignment = HorizontalAlignment.Center
    so.createComponent(FlexItem.getTypeName())
  }

  setVisible(visible: boolean): void {
    this.getSceneObject().enabled = visible
  }
}
