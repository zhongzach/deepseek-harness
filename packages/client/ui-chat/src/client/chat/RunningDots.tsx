/** Decorative running mark for the Chat status: three dots pulsing in turn, still under reduced motion. */
import css from './ChatView.module.css'

/**
 * Render the decorative running mark beside the live status text.
 * @returns a fixed-footprint row of dots; CSS owns their pulse.
 */
export function RunningDots() {
  return (
    <span className={css.runningIcon} aria-hidden="true">
      <span className={css.runningDot} />
      <span className={css.runningDot} />
      <span className={css.runningDot} />
    </span>
  )
}
