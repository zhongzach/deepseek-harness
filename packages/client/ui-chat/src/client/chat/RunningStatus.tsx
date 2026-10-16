/** Running Turn status isolated from the transcript's render cycle. */
import { memo, useEffect, useRef, useState } from 'react'
import { TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { formatRunDuration, LIVE_RUN_CLOCK_INTERVAL_MS } from './message-chrome.ts'
import { RunningDots } from './RunningDots.tsx'
import a11yCss from './accessibility.module.css'
import css from './ChatView.module.css'

/** Shortest time one activity stays on screen, so quick successive steps do not flicker. */
const ACTIVITY_MINIMUM_MS = 600

/** What the running Turn is doing now. */
export interface RunningActivity {
  /** Localized activity, such as thinking or reading files. */
  readonly label: string
  /** Bounded live detail: the latest finished thought or the running call's task; empty when hidden. */
  readonly detail: string
}

function sameActivity(left: RunningActivity, right: RunningActivity): boolean {
  return left.label === right.label && left.detail === right.detail
}

/** Hold each shown activity for at least ACTIVITY_MINIMUM_MS, then show only the latest one. */
function useSteadyActivity(desired: RunningActivity): RunningActivity {
  const [shown, setShown] = useState(desired)
  const shownRef = useRef(shown)
  const desiredRef = useRef(desired)
  const shownAtRef = useRef(Date.now())
  useEffect(() => {
    desiredRef.current = desired
    if (sameActivity(shownRef.current, desired)) return
    const commit = (): void => {
      shownRef.current = desiredRef.current
      shownAtRef.current = Date.now()
      setShown(desiredRef.current)
    }
    const remaining = ACTIVITY_MINIMUM_MS - (Date.now() - shownAtRef.current)
    if (remaining <= 0) {
      commit()
      return
    }
    const timer = setTimeout(commit, remaining)
    return () => { clearTimeout(timer) }
  }, [desired.label, desired.detail])
  return shown
}

interface RunningStatusProps {
  readonly startTime: number | undefined
  readonly activity: RunningActivity
  readonly t: ChatViewSlotProps['t']
}

/**
 * Show what the running Turn is doing and its elapsed time after the current
 * content, without announcing ticks or activity changes.
 * @param props - Current Turn start time, live activity, and localized copy.
 * @returns the running indicator; mount only while the Session is running.
 */
export const RunningStatus = memo(function RunningStatus({ startTime, activity, t }: RunningStatusProps) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (startTime === undefined) return
    setNow(Date.now())
    const timer = setInterval(() => { setNow(Date.now()) }, LIVE_RUN_CLOCK_INTERVAL_MS)
    return () => { clearInterval(timer) }
  }, [startTime])
  const shown = useSteadyActivity(activity)
  const elapsed = startTime === undefined ? undefined
    : formatRunDuration(Math.max(1000, now - startTime), t).map(part => part.text).join('')
  return (
    <div className={css.running} data-chat-running>
      <span className={a11yCss.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{t('chat.deepDiving')}</span>
      <span className={css.runningContent}>
        <RunningDots />
        <TextShimmer active className={css.runningText}>{shown.label}</TextShimmer>
        {shown.detail !== '' && <span className={css.runningDetail}>{shown.detail}</span>}
        {elapsed !== undefined && <span className={css.runningClock} data-chat-running-clock>{elapsed}</span>}
      </span>
    </div>
  )
})
