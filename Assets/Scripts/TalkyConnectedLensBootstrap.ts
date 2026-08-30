/**
 * TalkyConnectedLensBootstrap — Connected Lens session + wires TalkyPreviewBridge for dual-preview sync.
 */

import {TalkyPreviewBridge} from "./TalkyPreviewBridge"

@component
export class TalkyConnectedLensBootstrap extends BaseScriptComponent {
  @ui.label('<span style="color: #FACC15;">TalkyConnectedLensBootstrap – dual preview session</span>')
  @ui.separator

  @input
  @allowUndefined
  connectedLensModule: ConnectedLensModule | undefined

  @input
  @allowUndefined
  previewBridge: TalkyPreviewBridge

  @input
  autoStartSession: boolean = true

  @input
  enableDebugLogs: boolean = true

  private session: MultiplayerSession | null = null

  onAwake(): void {
    if (!this.autoStartSession) {
      return
    }
    this.createEvent("OnStartEvent").bind(() => {
      this.startSession()
    })
    this.createEvent("OnDestroyEvent").bind(() => {
      if (this.previewBridge) {
        this.previewBridge.setSession(null)
      }
      this.session = null
    })
  }

  private log(msg: string): void {
    if (this.enableDebugLogs) {
      print(`[TalkyCL] ${msg}`)
    }
  }

  private startSession(): void {
    if (!this.connectedLensModule) {
      this.log("No ConnectedLensModule — preview transport limited to local-only")
      return
    }

    try {
      const options = ConnectedLensSessionOptions.create()

      options.onConnected = (_session: MultiplayerSession, info: ConnectedLensModule.ConnectionInfo) => {
        this.session = _session
        if (this.previewBridge) {
          this.previewBridge.setSession(_session)
        }
        const count = 1 + info.externalUsersInfo.length
        this.log(`Connected · CL users=${count}`)
      }

      options.onMessageReceived = (
        _session: MultiplayerSession,
        userId: string,
        message: string,
        senderInfo: ConnectedLensModule.UserInfo
      ) => {
        if (this.previewBridge) {
          this.previewBridge.handleSessionMessage(userId, message, senderInfo.displayName)
        }
      }

      options.onUserJoinedSession = (_session: MultiplayerSession, user: ConnectedLensModule.UserInfo) => {
        this.log(`User joined: ${user.displayName}`)
        if (this.previewBridge) {
          this.previewBridge.onUserJoinedSession()
        }
      }

      options.onUserLeftSession = (_session: MultiplayerSession, user: ConnectedLensModule.UserInfo) => {
        this.log(`User left: ${user.displayName}`)
        if (this.previewBridge) {
          this.previewBridge.onUserLeftSession()
        }
      }

      options.onSessionCreated = (_session: MultiplayerSession, _type: ConnectedLensSessionOptions.SessionCreationType) => {
        this.log("Session created")
      }

      options.onError = (_session: MultiplayerSession, code: string, description: string) => {
        this.log(`Session error ${code}: ${description}`)
      }

      this.connectedLensModule.createSession(options)
      this.log("Requested Connected Lens session")
    } catch (e) {
      this.log("Failed to create session: " + String(e))
    }
  }

  getSession(): MultiplayerSession | null {
    return this.session
  }
}
