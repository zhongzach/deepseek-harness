/** Decorative running mark for the Chat status: a pulsing dot, still under reduced motion. */
import css from './ChatView.module.css'

/**
 * Render the decorative running mark beside the live status text.
 * @returns a fixed-footprint dot; CSS owns its pulse.
 */
export function RunningWhaleTail() {
  return (
    <span className={css.runningIcon} aria-hidden="true">
      <span className={css.runningDot} />
    </span>
  )
}
