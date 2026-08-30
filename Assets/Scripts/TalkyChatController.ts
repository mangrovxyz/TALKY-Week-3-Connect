/**
 * TalkyChatController — continuous ASR transcription for Spoka.
 */

import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"

@component
export class TalkyChatController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SpokaChatController – continuous speech</span>')
  @ui.separator

  readonly onTranscriptUpdate = new Event<{text: string; isFinal: boolean}>()
  readonly onUtteranceFinal = new Event<string>()
  readonly onDictateError = new Event<string>()
  readonly onListeningChanged = new Event<boolean>()

  private asrModule: AsrModule | null = null
  private dictating = false
  private asrReady = false
  private wantListen = false
  private started = false
  private restartEvent: DelayedCallbackEvent | null = null

  onAwake(): void {
    try {
      this.asrModule = require("LensStudio:AsrModule") as AsrModule
      this.asrReady = true
    } catch (_e) {
      this.asrReady = false
      print("[Spoka] ASR module unavailable")
    }
    this.createEvent("OnStartEvent").bind(() => {
      this.started = true
      if (this.wantListen) {
        this.beginTranscription()
      }
    })
    this.createEvent("OnDestroyEvent").bind(() => {
      this.stopListening()
    })
  }

  canDictate(): boolean {
    return this.asrReady && !!this.asrModule
  }

  isListening(): boolean {
    return this.wantListen && this.dictating
  }

  startListening(): void {
    this.wantListen = true
    if (this.started) {
      this.beginTranscription()
    }
    this.onListeningChanged.invoke(true)
  }

  stopListening(): void {
    this.wantListen = false
    this.endTranscription()
    this.onListeningChanged.invoke(false)
  }

  toggleListening(): boolean {
    if (this.wantListen) {
      this.stopListening()
      return false
    }
    this.startListening()
    return true
  }

  private beginTranscription(): void {
    if (!this.wantListen || !this.canDictate() || this.dictating || !this.asrModule) {
      if (!this.canDictate() && this.wantListen) {
        this.onDictateError.invoke("Speech unavailable — use Keys")
      }
      return
    }
    this.dictating = true
    print("[Spoka] ASR start")
    const options = AsrModule.AsrTranscriptionOptions.create()
    options.silenceUntilTerminationMs = 1400
    options.mode = AsrModule.AsrMode.HighAccuracy

    options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
      if (!this.dictating) {
        return
      }
      this.onTranscriptUpdate.invoke({text: e.text, isFinal: e.isFinal})
      if (e.isFinal && e.text.trim().length > 0) {
        print('[Spoka] ASR final: "' + e.text.trim().substring(0, 40) + '"')
        this.onUtteranceFinal.invoke(e.text.trim())
      }
    })

    options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
      if (code === AsrModule.AsrStatusCode.Success) {
        return
      }
      print("[Spoka] ASR error: " + String(code))
      this.dictating = false
      if (code === AsrModule.AsrStatusCode.Unauthenticated || code === AsrModule.AsrStatusCode.NoInternet) {
        this.onDictateError.invoke("Speech needs internet — use Keys")
        return
      }
      if (this.wantListen) {
        this.restartAfterStop(0.8)
      }
    })

    this.asrModule.startTranscribing(options)
  }

  private restartAfterStop(delaySec: number): void {
    if (!this.wantListen || !this.asrModule) {
      return
    }
    if (!this.restartEvent) {
      this.restartEvent = this.createEvent("DelayedCallbackEvent")
      this.restartEvent.bind(() => {
        if (!this.wantListen || !this.asrModule) {
          return
        }
        this.asrModule
          .stopTranscribing()
          .then(() => {
            this.dictating = false
            if (this.wantListen) {
              this.beginTranscription()
            }
          })
          .catch(() => {
            this.dictating = false
            if (this.wantListen) {
              this.beginTranscription()
            }
          })
      })
    }
    this.restartEvent.reset(delaySec)
  }

  private endTranscription(): void {
    if (!this.asrModule) {
      return
    }
    this.dictating = false
    this.asrModule.stopTranscribing()
  }

  showKeyboard(onSubmit: (text: string) => void): void {
    try {
      require("LensStudio:TextInputModule")
    } catch (_e) {
      this.onDictateError.invoke("Keyboard unavailable in this preview")
      return
    }

    const options = new TextInputSystem.KeyboardOptions()
    options.enablePreview = true
    options.keyboardType = TextInputSystem.KeyboardType.Text
    options.returnKeyType = TextInputSystem.ReturnKeyType.Send

    let current = ""
    options.onTextChanged = (text: string, _range: vec2) => {
      current = text
    }
    options.onReturnKeyPressed = () => {
      const trimmed = current.trim()
      if (trimmed.length > 0) {
        onSubmit(trimmed)
      }
      global.textInputSystem.dismissKeyboard()
    }

    global.textInputSystem.requestKeyboard(options)
  }
}
