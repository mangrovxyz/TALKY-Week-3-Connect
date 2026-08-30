import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {TalkyLeafInteractor, findLabelWithText} from "./TalkyLeafInteractor"

@component
export class TalkyLobbyLoadsScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new TalkyLeafInteractor()
    await sleep(1500)
    await interactor.ensureLobby()
    await sleep(400)

    expect(findSceneObjectByName("TalkyHeadUI")).not.toBeNull()
    expect(findSceneObjectByName("SpokaPanel").enabled).toBe(true)
    expect(findSceneObjectByName("ChannelSection").enabled).toBe(true)

    expect(findLabelWithText("SPOKA")).not.toBeNull()
    expect(findSceneObjectByName("D0").enabled).toBe(true)
    expect(!!findInteractablesByName("Btn_GO", undefined, true)[0]).toBe(true)
    expect(!!findInteractablesByName("Btn_JOIN", undefined, true)[0]).toBe(true)
  }
}
