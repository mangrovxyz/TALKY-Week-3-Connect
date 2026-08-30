/**
 * TalkyHeadLock — world-space 3D floater: smooth camera follow + pinch reposition.
 * Camera-local Z is negative in front of the user (matches scene placement).
 */

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

@component
export class TalkyHeadLock extends BaseScriptComponent {
  /** Anchor offset (cm). Z negative = in front of user (camera-local convention). */
  @input
  anchorOffset: vec3 = new vec3(0, -3.5, -45)

  @input
  smoothSpeed: number = 10

  @input
  lockOnStart: boolean = true

  @input
  grabColliderSize: vec3 = new vec3(11, 0.6, 0.2)

  private cameraTransform: Transform | null = null
  private ready = false
  private worldDetached = false
  private userDragging = false
  private userNudge = vec3.zero()
  private targetAnchor = new vec3(0, -3.5, -45)
  private pinchReady = false

  onAwake(): void {
    if (!this.lockOnStart) {
      return
    }
    this.targetAnchor = this.anchorOffset
    this.userNudge = vec3.zero()
    this.ensureCameraParent()
    this.snapVisibleNow()
    this.createEvent("OnStartEvent").bind(() => {
      this.refreshCamera()
      this.tryDetachToWorld()
      this.setupPinch()
    })
    this.createEvent("LateUpdateEvent").bind(() => {
      this.refreshCamera()
      if (!this.worldDetached) {
        this.tryDetachToWorld()
      }
      this.followCamera()
    })
  }

  setAnchorOffset(offset: vec3): void {
    this.targetAnchor = offset
  }

  /** Immediate placement while still camera-attached. */
  snapVisibleNow(): void {
    const host = this.getSceneObject()
    host.enabled = true
    this.ensureCameraParent()
    if (host.getParent() && !this.worldDetached) {
      host.getTransform().setLocalPosition(this.targetAnchor)
      host.getTransform().setLocalRotation(quat.quatIdentity())
    }
  }

  private refreshCamera(): void {
    try {
      this.cameraTransform = WorldCameraFinderProvider.getInstance().getTransform()
    } catch (_e) {
      this.cameraTransform = null
    }
  }

  private ensureCameraParent(): void {
    const host = this.getSceneObject()
    if (host.getParent() || this.worldDetached) {
      return
    }
    this.refreshCamera()
    if (!this.cameraTransform) {
      return
    }
    host.setParent(this.cameraTransform.getSceneObject())
    host.getTransform().setLocalPosition(this.targetAnchor)
    host.getTransform().setLocalRotation(quat.quatIdentity())
  }

  private tryDetachToWorld(): void {
    if (this.worldDetached) {
      this.ready = true
      return
    }

    const host = this.getSceneObject()
    host.enabled = true
    this.ensureCameraParent()

    if (!this.cameraTransform) {
      this.ready = true
      return
    }

    if (host.getParent()) {
      host.getTransform().setLocalPosition(this.targetAnchor)
    }

    host.setParent(null)
    this.userNudge = vec3.zero()
    const anchor = this.computeAnchorTransform()
    host.getTransform().setWorldPosition(anchor.position)
    host.getTransform().setWorldRotation(anchor.rotation)
    this.worldDetached = true
    this.ready = true
    print("[Spoka] floater in front · z=" + anchor.position.z.toFixed(1))
  }

  private setupPinch(): void {
    if (this.pinchReady) {
      return
    }
    this.pinchReady = true

    const host = this.getSceneObject()
    let handle = this.findChildByName(host, "SpokaGrabHandle")
    if (!handle) {
      handle = global.scene.createSceneObject("SpokaGrabHandle")
      handle.setParent(host)
      handle.getTransform().setLocalPosition(new vec3(0, 2.8, 0.2))
    }

    let collider = handle.getComponent("Physics.ColliderComponent") as ColliderComponent
    if (!collider) {
      collider = handle.createComponent("Physics.ColliderComponent") as ColliderComponent
    }
    const shape = Shape.createBoxShape()
    shape.size = this.grabColliderSize
    collider.shape = shape
    collider.intangible = false
    collider.fitVisual = false

    let interactable = handle.getComponent(Interactable.getTypeName()) as Interactable
    if (!interactable) {
      interactable = handle.createComponent(Interactable.getTypeName()) as Interactable
    }
    interactable.targetingMode = TargetingMode.Direct
    interactable.colliders = [collider]

    let manip = handle.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    if (!manip) {
      manip = handle.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    }
    manip.setManipulateRoot(host.getTransform())
    manip.setCanRotate(false)
    manip.setCanScale(false)

    manip.onManipulationStart.add(() => {
      this.userDragging = true
    })
    manip.onManipulationEnd.add(() => {
      this.userDragging = false
      if (!this.cameraTransform) {
        return
      }
      const anchor = this.computeAnchorTransform()
      this.userNudge = host.getTransform().getWorldPosition().sub(anchor.position)
    })
  }

  private findChildByName(root: SceneObject, name: string): SceneObject | null {
    if (root.name === name) {
      return root
    }
    const n = root.getChildrenCount()
    for (let i = 0; i < n; i++) {
      const found = this.findChildByName(root.getChild(i), name)
      if (found) {
        return found
      }
    }
    return null
  }

  private computeAnchorTransform(): {position: vec3; rotation: quat} {
    if (!this.cameraTransform) {
      const t = this.getSceneObject().getTransform()
      return {position: t.getWorldPosition(), rotation: t.getWorldRotation()}
    }
    const cam = this.cameraTransform
    const o = this.targetAnchor
    // Same convention as SIK getForwardPosition: forward * negativeZ places UI in front.
    const position = cam
      .getWorldPosition()
      .add(cam.right.uniformScale(o.x))
      .add(cam.up.uniformScale(o.y))
      .add(cam.forward.uniformScale(o.z))
    return {position, rotation: cam.getWorldRotation()}
  }

  private followCamera(): void {
    if (!this.ready || !this.cameraTransform || this.userDragging) {
      return
    }

    if (!this.worldDetached) {
      const host = this.getSceneObject()
      if (host.getParent()) {
        const dt = getDeltaTime()
        const alpha = 1 - Math.exp(-this.smoothSpeed * dt)
        const t = host.getTransform()
        t.setLocalPosition(vec3.lerp(t.getLocalPosition(), this.targetAnchor, alpha))
        t.setLocalRotation(quat.slerp(t.getLocalRotation(), quat.quatIdentity(), alpha))
      }
      return
    }

    const anchor = this.computeAnchorTransform()
    const targetPos = anchor.position.add(this.userNudge)
    const dt = getDeltaTime()
    const alpha = 1 - Math.exp(-this.smoothSpeed * dt)
    const t = this.getSceneObject().getTransform()
    t.setWorldPosition(vec3.lerp(t.getWorldPosition(), targetPos, alpha))
    t.setWorldRotation(quat.slerp(t.getWorldRotation(), anchor.rotation, alpha))
  }
}
