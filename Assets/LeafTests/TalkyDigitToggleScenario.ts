import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TalkyLeafInteractor, digitValueText} from "./TalkyLeafInteractor"

/** 3-digit dial bump on the 3D radio wheels. */
@component
export class TalkyDigitToggleScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new TalkyLeafInteractor()
    await sleep(1500)
    await interactor.ensureLobby()
    await sleep(400)

    const before = digitValueText(0)
    const beforeNum = parseInt(before, 10)
    expect(Number.isNaN(beforeNum)).toBe(false)

    await interactor.tapDigitBump(0, "up")
    const afterBump = digitValueText(0)
    const afterNum = parseInt(afterBump, 10)
    expect(afterNum).toBe((beforeNum + 1) % 10)
  }
}
