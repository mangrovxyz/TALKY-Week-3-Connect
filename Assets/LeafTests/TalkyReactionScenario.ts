import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TalkyLeafInteractor} from "./TalkyLeafInteractor"

@component
export class TalkyReactionScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new TalkyLeafInteractor()
    await sleep(1500)
    await interactor.ensureLobby()
    await sleep(400)

    await interactor.tapButton("Create Room")
    await sleep(800)
    expect(findSceneObjectByName("TalkyReactions").enabled).toBe(true)

    await interactor.tapButton("Wizz")
    await sleep(500)

    const toast = findSceneObjectByName("Toast")
    expect(toast).not.toBeNull()
    const toastText = toast.getComponent("Component.Text") as Text
    // Local demo ends on reaction id ("wizz"); cloud path may prefix a name
    expect(toastText.text.toLowerCase().includes("wizz")).toBe(true)

    await interactor.tapButton("Leave")
    await sleep(600)
  }
}
