/**
 * TalkyAudioController — local one-shot SFX for Talky (no background music).
 * Owns: AudioComponent pool, reaction one-shots.
 * Does not: networking or UI.
 *
 * requireAsset paths MUST be string literals (Lens Studio bundler).
 */

import {TalkyReactionId} from "./TalkyAssetManifest"

@component
export class TalkyAudioController extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyAudioController – SFX only</span>')
  @ui.separator

  @ui.group_start("Settings")
  @input
  @hint("One-shot SFX volume")
  @widget(new SliderWidget(0, 1, 0.05))
  sfxVolume: number = 0.9
  @ui.group_end

  private sfxHost!: SceneObject
  private sfxAudio!: AudioComponent
  private tracks: {[key: string]: AudioTrackAsset} = {}

  onAwake(): void {
    this.sfxHost = global.scene.createSceneObject("TalkySfx")
    this.sfxHost.setParent(this.getSceneObject())
    this.sfxAudio = this.sfxHost.createComponent("Component.AudioComponent") as AudioComponent
    this.sfxAudio.playbackMode = Audio.PlaybackMode.LowLatency
    this.sfxAudio.volume = this.sfxVolume

    this.loadTrack("ButtonClick", requireAsset("../GeneratedSFX/ButtonClick.wav") as AudioTrackAsset)
    this.loadTrack("DialTick", requireAsset("../GeneratedSFX/DialTick.wav") as AudioTrackAsset)
    this.loadTrack("RoomJoin", requireAsset("../GeneratedSFX/RoomJoin.wav") as AudioTrackAsset)
    this.loadTrack("RoomLeave", requireAsset("../GeneratedSFX/RoomLeave.wav") as AudioTrackAsset)
    this.loadTrack("TransmitStart", requireAsset("../GeneratedSFX/TransmitStart.wav") as AudioTrackAsset)
    this.loadTrack("Wizz", requireAsset("../GeneratedSFX/Wizz.wav") as AudioTrackAsset)
    this.loadTrack("Applause", requireAsset("../GeneratedSFX/Applause.wav") as AudioTrackAsset)
    this.loadTrack("Doorbell", requireAsset("../GeneratedSFX/Doorbell.wav") as AudioTrackAsset)
    this.loadTrack("Laugh", requireAsset("../GeneratedSFX/Laugh.wav") as AudioTrackAsset)
    this.loadTrack("Boo", requireAsset("../GeneratedSFX/Boo.wav") as AudioTrackAsset)
    this.loadTrack("Airhorn", requireAsset("../GeneratedSFX/Airhorn.wav") as AudioTrackAsset)
    this.loadTrack("Heart", requireAsset("../GeneratedSFX/Heart.wav") as AudioTrackAsset)
  }

  private loadTrack(name: string, track: AudioTrackAsset): void {
    if (track) {
      this.tracks[name] = track
    }
  }

  playNamed(name: string): void {
    const track = this.tracks[name]
    if (!track || !this.sfxAudio) {
      return
    }
    this.sfxAudio.audioTrack = track
    this.sfxAudio.volume = this.sfxVolume
    this.sfxAudio.playbackMode = Audio.PlaybackMode.LowLatency
    this.sfxAudio.play(1)
  }

  playClick(): void {
    this.playNamed("ButtonClick")
  }

  playDialTick(): void {
    this.playNamed("DialTick")
  }

  playJoin(): void {
    this.playNamed("RoomJoin")
  }

  playLeave(): void {
    this.playNamed("RoomLeave")
  }

  playTransmitStart(): void {
    this.playNamed("TransmitStart")
  }

  playReaction(id: TalkyReactionId): void {
    const map: {[k in TalkyReactionId]: string} = {
      wizz: "Wizz",
      applause: "Applause",
      doorbell: "Doorbell",
      laugh: "Laugh",
      boo: "Boo",
      airhorn: "Airhorn",
      heart: "Heart",
    }
    this.playNamed(map[id])
  }
}
