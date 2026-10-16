import { memo } from 'react'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconChevronDownOutlineRegular, IconListPenOutlineRegular, IconSkillOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatNodeViewProps, TurnIdentityOwnerProps } from '../contract/slots.ts'
import { turnProcessAlwaysOpen } from '../contract/turn-process.ts'
import { formatMessageClock, formatRunDuration } from './message-chrome.ts'
import { ProcessNotes } from './ProcessNotes.tsx'
import { useCalendarDay } from './use-calendar-day.ts'
import a11yCss from './accessibility.module.css'
import css from './TurnProcessNodeView.module.css'

type TurnProcessNodeViewProps = ChatNodeViewProps<'turn-process'>
  & PropsRenderSlots<'conversation.chat.turn.identity' | 'conversation.chat.turn.skill'>

/** The skills a Turn loaded, as chips that open each skill's source. */
function SkillChips({ skills, openSkill, renderSlot }: {
  readonly skills: readonly string[]
  readonly openSkill: (name: string) => void
  readonly renderSlot: TurnProcessNodeViewProps['renderSlot']
}) {
  if (skills.length === 0) return null
  return (
    <span className={css.skills}>
      {skills.map(name => (
        <button key={name} type="button" className={css.skill} data-turn-skill={name} onClick={() => { openSkill(name) }}>
          <IconSkillOutlineRegular size={13} />
          <span className={css.skillName}>{renderSlot('conversation.chat.turn.skill', { name }, { fallback: name })}</span>
        </button>
      ))}
    </span>
  )
}

/**
 * Head of one Turn's reply: the assistant identity with the skills the Turn
 * loaded, its start time and settled duration or outcome, and, once a
 * completed Turn can fold its process, a one-line summary of that process
 * that opens and closes it.
 */
export const TurnProcessNodeView = memo(function TurnProcessNodeView({
  node, turnProcess, openSkill, renderSlot, t,
}: TurnProcessNodeViewProps) {
  if (turnProcess === undefined) throw new Error('turn-process node requires Turn process owner state')
  const day = useCalendarDay()
  const turn = node.location.kind === 'turn' || node.location.kind === 'step'
    ? node.location.turn
    : undefined
  if (turn === undefined) return null
  const closed = turn.status === 'closed'
  const open = !turnProcess.foldable || turnProcess.open
  const canCollapse = closed && turnProcess.foldable && turnProcess.hasContent && !turnProcessAlwaysOpen(node)
  const reason = turn.end?.data.reason.kind
  const elapsedMs = !closed || turn.start === undefined || turn.end === undefined ? undefined
    : Math.max(1000, turn.end.time - turn.start.time)
  // Other end reasons retain elapsed time; only cancellation and failure replace it.
  const duration = elapsedMs === undefined || reason === 'aborted' || reason === 'error' ? undefined
    : formatRunDuration(elapsedMs, t)
  const outcome = !closed ? undefined
    : reason === 'aborted' ? t('message.stopped')
      : reason === 'error' ? t('message.turnProcess.failed')
        : duration === undefined ? t('message.turnProcess.worked') : undefined
  const announcement = reason === 'aborted' ? t('message.stopped')
    : reason === 'error' ? t('message.turnProcess.failed')
      : t('message.turnProcess.worked')
  const startTime = turn.start?.time
  const identity: TurnIdentityOwnerProps = { turn: node.data.turn, running: !closed }
  const separator = t('message.processNotes.separator')
  return (
    <div
      className={css.root}
      data-turn-process={node.data.turn}
      data-turn-state={closed ? 'closed' : 'open'}
      data-turn-process-messages={node.data.messageCount}
      data-turn-process-tool-calls={node.data.toolCallCount}
      data-turn-process-subagents={node.data.subagentCount}
    >
      {closed && <span className={a11yCss.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>}
      <div className={css.header}>
        <span className={css.identity}>
          {renderSlot('conversation.chat.turn.identity', identity)}
          <SkillChips skills={node.data.skills} openSkill={openSkill} renderSlot={renderSlot} />
        </span>
        <span className={css.meta} data-turn-meta>
          {startTime !== undefined && <span>{formatMessageClock(startTime, t, day)}</span>}
          {closed && startTime !== undefined && <span className={css.metaSeparator}>{separator}</span>}
          {outcome !== undefined && <span>{outcome}</span>}
          {duration !== undefined && (
            <span>
              {t('message.turnHeader.took')}
              {duration.map((part, index) => (
                <span key={index} className={part.numeric ? css.durationNumber : undefined}>{part.text}</span>
              ))}
            </span>
          )}
        </span>
      </div>
      {canCollapse && (
        <button
          type="button"
          className={css.notes}
          data-open={open || undefined}
          data-turn-process-toggle
          aria-expanded={open}
          onClick={(event) => {
            event.currentTarget.focus()
            turnProcess.setOpen(!open)
          }}
        >
          <span className={css.notesIcon} aria-hidden="true"><IconListPenOutlineRegular /></span>
          <span className={css.notesSummary}>
            <ProcessNotes counts={node.data.activity} readPaths={node.data.readPaths} live={false} t={t} />
          </span>
          <span className={css.toggle}>
            {t(open ? 'message.processNotes.hide' : 'message.processNotes.show')}
            <IconChevronDownOutlineRegular className={css.chevron} />
          </span>
        </button>
      )}
    </div>
  )
})
