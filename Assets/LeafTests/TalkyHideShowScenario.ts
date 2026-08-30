import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TalkyLeafInteractor} from "./TalkyLeafInteractor"

@component
export class TalkyHideShowScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new TalkyLeafInteractor()
    await sleep(1500)
    await interactor.ensureLobby()
    await sleep(400)

    expect(findSceneObjectByName("SpokaPanel").enabled).toBe(true)
    expect(findSceneObjectByName("ShowUI").enabled).toBe(false)

    await interactor.tapButton("Hide")
    await sleep(400)

    expect(findSceneObjectByName("SpokaPanel").enabled).toBe(false)
    expect(findSceneObjectByName("ShowUI").enabled).toBe(true)

    await interactor.tapButton("ShowUI")
    await sleep(400)

    expect(findSceneObjectByName("SpokaPanel").enabled).toBe(true)
    expect(findSceneObjectByName("ShowUI").enabled).toBe(false)
  }
}
