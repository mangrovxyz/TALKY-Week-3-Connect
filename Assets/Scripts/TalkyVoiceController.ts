/**
 * TalkyVoiceController — mic capture → short PCM/WAV chunks for Realtime broadcast.
 * Owns: MicrophoneAudioProvider sampling, chunk encode, local playback of remote chunks.
 * Does not: channel management (uses TalkyCloudController callbacks from Main).
 */

import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {TalkyCloudController, TalkyVoiceChunkPayload} from "./TalkyCloudController"
import {TalkyPreviewBridge} from "./TalkyPreviewBridge"

@component
export class TalkyVoiceController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TalkyVoiceController – PTT / Always-On mic</span>')
  @ui.separator

  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Optional Microphone Audio Track asset; if empty, mic init is skipped gracefully")
  microphoneAsset: AudioTrackAsset | undefined
  @ui.group_end

  @ui.group_start("Settings")
  @input
  @hint("Voice sample rate (Hz)")
  @widget(new SliderWidget(8000, 24000, 1000))
  sampleRate: number = 16000

  @input
  @hint("Chunk length in milliseconds")
  @widget(new SliderWidget(100, 800, 50))
  chunkSizeMs: number = 400

  @input
  @hint("Enable mic debug logs")
  enableDebugLogs: boolean = true
  @ui.group_end

  readonly onTransmitChanged = new Event<boolean>()
  readonly onMicUnavailable = new Event<string>()

  private cloud: TalkyCloudController | null = null
  private microphoneControl: MicrophoneAudioProvider | null = null
  private isTransmitting: boolean = false
  private alwaysOn: boolean = false
  private audioBuffer: Float32Array[] = []
  private numberOfSamples: number = 0
  private chunkCount: number = 0
  private audioUpdateEvent: UpdateEvent | null = null
  private streamTimer: DelayedCallbackEvent | null = null
  private playbackHost!: SceneObject
  private playbackAudio!: AudioComponent
  private remoteMediaModule: RemoteMediaModule | null = null
  private playbackBusy: boolean = false
  private playbackQueue: TalkyVoiceChunkPayload[] = []

  onAwake(): void {
    this.playbackHost = global.scene.createSceneObject("TalkyVoicePlayback")
    this.playbackHost.setParent(this.getSceneObject())
    this.playbackAudio = this.playbackHost.createComponent("Component.AudioComponent") as AudioComponent
    this.playbackAudio.playbackMode = Audio.PlaybackMode.LowLatency
    try {
      this.remoteMediaModule = require("LensStudio:RemoteMediaModule") as RemoteMediaModule
    } catch (_e) {
      this.remoteMediaModule = null
    }
  }

  bindCloud(cloud: TalkyCloudController, previewBridge: TalkyPreviewBridge | null = null): void {
    this.cloud = cloud
    this.previewBridge = previewBridge
    cloud.onVoiceChunk.add((payload) => this.playRemoteChunk(payload))
    if (previewBridge) {
      previewBridge.onVoiceChunk.add((payload) => this.playRemoteChunk(payload))
    }
  }

  private previewBridge: TalkyPreviewBridge | null = null

  setAlwaysOn(enabled: boolean): void {
    this.alwaysOn = enabled
    if (enabled) {
      this.startTransmit()
    } else if (this.isTransmitting) {
      this.stopTransmit()
    }
  }

  isAlwaysOn(): boolean {
    return this.alwaysOn
  }

  isTransmittingNow(): boolean {
    return this.isTransmitting
  }

  /** Push-to-talk press */
  beginPtt(): void {
    if (this.alwaysOn) {
      return
    }
    this.startTransmit()
  }

  /** Push-to-talk release */
  endPtt(): void {
    if (this.alwaysOn) {
      return
    }
    this.stopTransmit()
  }

  private resolveMicAsset(): AudioTrackAsset | null {
    if (this.microphoneAsset) {
      return this.microphoneAsset
    }
    // requireAsset path must be a string literal for the Lens Studio bundler
    try {
      return requireAsset("../Audio/TalkyMic.micaudio") as AudioTrackAsset
    } catch (_e) {
      return null
    }
  }

  private ensureMic(): boolean {
    if (this.microphoneControl) {
      return true
    }
    const micAsset = this.resolveMicAsset()
    if (!micAsset) {
      this.onMicUnavailable.invoke("Microphone Audio Track missing — add Assets/Audio/TalkyMic")
      return false
    }
    try {
      this.microphoneControl = micAsset.control as MicrophoneAudioProvider
      this.microphoneControl.sampleRate = this.sampleRate
      return true
    } catch (e) {
      this.onMicUnavailable.invoke(String(e))
      return false
    }
  }

  private startTransmit(): void {
    if (this.isTransmitting) {
      return
    }
    if (!this.ensureMic() || !this.microphoneControl) {
      return
    }
    this.isTransmitting = true
    this.chunkCount = 0
    this.audioBuffer = []
    this.numberOfSamples = 0
    this.microphoneControl.start()

    if (!this.audioUpdateEvent) {
      this.audioUpdateEvent = this.createEvent("UpdateEvent")
      this.audioUpdateEvent.bind(() => this.sampleMic())
    }
    this.audioUpdateEvent.enabled = true

    if (!this.streamTimer) {
      this.streamTimer = this.createEvent("DelayedCallbackEvent")
      this.streamTimer.bind(() => {
        this.flushChunk()
        if (this.isTransmitting && this.streamTimer) {
          this.streamTimer.reset(this.chunkSizeMs / 1000)
        }
      })
    }
    this.streamTimer.reset(this.chunkSizeMs / 1000)

    if (this.cloud) {
      this.cloud.sendSpeaking(true)
    }
    if (this.previewBridge && this.previewBridge.isInRoom()) {
      this.previewBridge.sendSpeaking(true)
    }
    this.onTransmitChanged.invoke(true)
  }

  private stopTransmit(): void {
    if (!this.isTransmitting) {
      return
    }
    this.isTransmitting = false
    if (this.audioUpdateEvent) {
      this.audioUpdateEvent.enabled = false
    }
    if (this.microphoneControl) {
      try {
        this.microphoneControl.stop()
      } catch (_e) {
        // ignore
      }
    }
    this.flushChunk()
    if (this.cloud) {
      this.cloud.sendSpeaking(false)
    }
    if (this.previewBridge && this.previewBridge.isInRoom()) {
      this.previewBridge.sendSpeaking(false)
    }
    this.onTransmitChanged.invoke(false)
  }

  private sampleMic(): void {
    if (!this.isTransmitting || !this.microphoneControl) {
      return
    }
    const frameSize = this.microphoneControl.maxFrameSize
    const audioFrame = new Float32Array(frameSize)
    const shape = this.microphoneControl.getAudioFrame(audioFrame)
    const sampleCount = shape.x
    if (sampleCount > 0) {
      this.audioBuffer.push(audioFrame.slice(0, sampleCount))
      this.numberOfSamples += sampleCount
    }
  }

  private canSendVoice(): boolean {
    return !!(this.cloud?.isInRoom() || this.previewBridge?.isInRoom())
  }

  private flushChunk(): void {
    if (!this.canSendVoice() || this.audioBuffer.length === 0 || this.numberOfSamples === 0) {
      return
    }
    const combined = this.combineFrames(this.audioBuffer)
    this.audioBuffer = []
    this.numberOfSamples = 0
    this.chunkCount += 1
    const payload = {
      chunkNumber: this.chunkCount,
      timestamp: Date.now(),
      data: this.floatToWavBase64(combined, this.sampleRate),
      sampleRate: this.sampleRate,
      samples: combined.length,
    }
    if (this.cloud && this.cloud.isInRoom()) {
      this.cloud.sendVoiceChunk(payload)
    }
    if (this.previewBridge && this.previewBridge.isInRoom()) {
      this.previewBridge.sendVoiceChunk(payload)
    }
    if (this.enableDebugLogs) {
      print(`[TalkyVoice] sent chunk ${this.chunkCount} samples=${combined.length}`)
    }
  }

  private combineFrames(frames: Float32Array[]): Float32Array {
    let total = 0
    for (let i = 0; i < frames.length; i++) {
      total += frames[i].length
    }
    const out = new Float32Array(total)
    let offset = 0
    for (let i = 0; i < frames.length; i++) {
      out.set(frames[i], offset)
      offset += frames[i].length
    }
    return out
  }

  private floatToWavBase64(samples: Float32Array, sampleRate: number): string {
    const numSamples = samples.length
    const bytesPerSample = 2
    const blockAlign = bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = numSamples * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)
    this.writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + dataSize, true)
    this.writeString(view, 8, "WAVE")
    this.writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)
    this.writeString(view, 36, "data")
    view.setUint32(40, dataSize, true)
    let offset = 44
    for (let i = 0; i < numSamples; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
    const bytes = new Uint8Array(buffer)
    return this.bytesToBase64(bytes)
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  private bytesToBase64(bytes: Uint8Array): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    let result = ""
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i]
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0
      const triplet = (a << 16) | (b << 8) | c
      result += chars[(triplet >> 18) & 63]
      result += chars[(triplet >> 12) & 63]
      result += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : "="
      result += i + 2 < bytes.length ? chars[triplet & 63] : "="
    }
    return result
  }

  /** Decode and play a remote WAV chunk received via Snap Cloud Realtime. */
  playRemoteChunk(payload: TalkyVoiceChunkPayload): void {
    if (!payload || !payload.data) {
      return
    }
    const myId = this.cloud ? this.cloud.getUserId() : ""
    if (payload.userId && myId && payload.userId === myId) {
      return
    }
    if (!this.remoteMediaModule) {
      if (this.enableDebugLogs) {
        print("[TalkyVoice] RemoteMediaModule unavailable — cannot play remote voice")
      }
      return
    }
    this.playbackQueue.push(payload)
    this.drainPlaybackQueue()
  }

  private drainPlaybackQueue(): void {
    if (this.playbackBusy || this.playbackQueue.length === 0 || !this.remoteMediaModule) {
      return
    }
    const payload = this.playbackQueue.shift()
    if (!payload) {
      return
    }
    this.playbackBusy = true
    try {
      const bytes = Base64.decode(payload.data)
      const resource = DynamicResource.createWithBuffer(bytes)
      this.remoteMediaModule.loadResourceAsAudioTrackAsset(
        resource,
        (track) => {
          this.playbackAudio.audioTrack = track
          this.playbackAudio.volume = 1.0
          this.playbackAudio.play(1)
          const durationSec = Math.max(0.05, payload.samples / Math.max(8000, payload.sampleRate))
          const done = this.createEvent("DelayedCallbackEvent")
          done.bind(() => {
            this.playbackBusy = false
            this.drainPlaybackQueue()
          })
          done.reset(durationSec + 0.02)
          if (this.enableDebugLogs) {
            print(`[TalkyVoice] playing remote chunk #${payload.chunkNumber} from ${payload.name}`)
          }
        },
        (err) => {
          this.playbackBusy = false
          if (this.enableDebugLogs) {
            print(`[TalkyVoice] remote playback failed: ${err}`)
          }
          this.drainPlaybackQueue()
        }
      )
    } catch (e) {
      this.playbackBusy = false
      if (this.enableDebugLogs) {
        print(`[TalkyVoice] decode error: ${String(e)}`)
      }
      this.drainPlaybackQueue()
    }
  }
}
