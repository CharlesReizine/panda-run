export interface ControlsState { left: boolean; right: boolean; jump: boolean }

export const emptyControls = (): ControlsState => ({ left: false, right: false, jump: false })

export function mergeControls(a: ControlsState, b: ControlsState): ControlsState {
  return { left: a.left || b.left, right: a.right || b.right, jump: a.jump || b.jump }
}
