import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {
  findSceneObject,
  findSceneObjectByName,
  matchSceneObjectName,
  matchSceneObjectParentName,
  sleep,
} from "Leaf.lspkg/Utils/common/Utils"

/** Shared Spoka preview helpers. */
export class TalkyLeafInteractor extends DefaultLeafInteractor {
  async tapButton(buttonName: string): Promise<void> {
    let button = findInteractablesByName("Btn_" + buttonName, undefined, true)[0]
    if (!button) {
      button = findInteractablesByName(buttonName, undefined, true)[0]
    }
    if (!button) {
      throw new Error(`Button "${buttonName}" not found or not enabled`)
    }
    await this.trigger(button)
    await sleep(300)
  }

  async tapDigitBump(digitIndex: number, direction: "up" | "down"): Promise<void> {
    const parentName = "D" + digitIndex
    const label = direction === "up" ? "▲" : "▼"
    const buttons = findInteractablesByName("Btn_" + label, undefined, true)
    const matches = buttons.filter((interactable) => {
      let so = interactable.getSceneObject()
      while (so) {
        if (so.name === parentName) {
          return true
        }
        so = so.getParent()
      }
      return false
    })
    if (matches.length < 1) {
      throw new Error(`Digit bump "${label}" under "${parentName}" not found`)
    }
    await this.trigger(matches[0])
    await sleep(300)
  }

  async ensureLobby(): Promise<void> {
    const headUi = findSceneObjectByName("TalkyHeadUI")
    if (!headUi || !headUi.enabled) {
      throw new Error("TalkyHeadUI not found or disabled")
    }

    const joinRow = findSceneObjectByName("JoinRow")
    if (joinRow && !joinRow.enabled) {
      await this.tapButton("Leave room")
      await sleep(600)
    }
  }
}

export function digitValueText(digitIndex: number): string {
  const digitSO = findSceneObject((sceneObject) => {
    const value = matchSceneObjectName("Digit")(sceneObject)
    const underWheel = matchSceneObjectParentName("D" + digitIndex)(sceneObject)
    return value && underWheel ? sceneObject : undefined
  })
  if (!digitSO) {
    throw new Error(`Digit under D${digitIndex} not found`)
  }
  const ec = digitSO.getComponent(ElementContent.getTypeName()) as ElementContent
  if (ec) {
    return ec.text
  }
  const text = digitSO.getComponent("Component.Text") as Text
  return text.text
}

export function findLabelWithText(expected: string): Text | null {
  for (const name of ["Label", "Line", "Title", "MsgLine"]) {
    const nodes = findSceneObjectsNamed(name)
    for (let i = 0; i < nodes.length; i++) {
      const t = nodes[i].getComponent("Component.Text") as Text
      if (t && t.text === expected) {
        return t
      }
    }
  }
  return null
}

function findSceneObjectsNamed(name: string): SceneObject[] {
  const results: SceneObject[] = []
  const rootCount = global.scene.getRootObjectsCount()
  for (let i = 0; i < rootCount; i++) {
    collectByName(global.scene.getRootObject(i), name, results)
  }
  return results
}

function collectByName(obj: SceneObject, name: string, out: SceneObject[]): void {
  if (obj.name === name) {
    out.push(obj)
  }
  const n = obj.getChildrenCount()
  for (let i = 0; i < n; i++) {
    collectByName(obj.getChild(i), name, out)
  }
}
