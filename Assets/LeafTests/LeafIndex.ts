import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {TalkyLobbyLoadsScenario} from "./TalkyLobbyLoadsScenario"
import {TalkyDigitToggleScenario} from "./TalkyDigitToggleScenario"
import {TalkyCreateLeaveRoomScenario} from "./TalkyCreateLeaveRoomScenario"
import {TalkyHideShowScenario} from "./TalkyHideShowScenario"
import {TalkyIkCreateRoomScenario} from "./TalkyIkCreateRoomScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {
      id: "talky-lobby-loads",
      typename: TalkyLobbyLoadsScenario.getTypeName(),
    },
    {
      id: "talky-digit-bump-toggle",
      typename: TalkyDigitToggleScenario.getTypeName(),
    },
    {
      id: "talky-create-leave-room",
      typename: TalkyCreateLeaveRoomScenario.getTypeName(),
    },
    {
      id: "talky-hide-show-ui",
      typename: TalkyHideShowScenario.getTypeName(),
    },
    {
      id: "talky-ik-create-room",
      typename: TalkyIkCreateRoomScenario.getTypeName(),
    },
  ]
}
