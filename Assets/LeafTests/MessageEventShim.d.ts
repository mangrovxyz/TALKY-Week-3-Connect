/**
 * Ambient shim for LEAF DeviceMessageReceiver on Lens Studio builds
 * that do not yet ship MessageEvent in StudioLib EventNameMap.
 * Does not modify Leaf.lspkg — preview LEAF runs do not require the device path.
 */
declare class MessageEvent extends SceneEvent {
  topic: string
  replyToken: string
  data: unknown
  reply(response: unknown, token: string): void
}

interface EventNameMap {
  MessageEvent: MessageEvent
}
