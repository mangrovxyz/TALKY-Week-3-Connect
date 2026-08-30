import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {TalkyLeafInteractor} from "./TalkyLeafInteractor"

@component
export class TalkyIkCreateRoomScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    const helper = new TalkyLeafInteractor()
    await sleep(1500)
    await helper.ensureLobby()
    await sleep(400)

    const createBtn = findInteractableByName("Btn_GO")
    expect(!!createBtn).toBe(true)

    await this.ik.trigger(createBtn)
    await sleep(1000)

    expect(findSceneObjectByName("RoomSection").enabled).toBe(true)
    expect(findSceneObjectByName("JoinRow").enabled).toBe(false)

    await helper.tapButton("Leave")
    await sleep(600)
  }
}
