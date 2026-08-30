import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TalkyLeafInteractor} from "./TalkyLeafInteractor"

@component
export class TalkyCreateLeaveRoomScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new TalkyLeafInteractor()
    await sleep(1500)
    await interactor.ensureLobby()
    await sleep(400)

    expect(findSceneObjectByName("JoinRow").enabled).toBe(true)

    await interactor.tapButton("GO")
    await sleep(800)

    expect(findSceneObjectByName("JoinRow").enabled).toBe(false)

    await interactor.tapButton("Leave room")
    await sleep(800)

    expect(findSceneObjectByName("JoinRow").enabled).toBe(true)
  }
}
