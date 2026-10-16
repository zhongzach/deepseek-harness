/** Stable process container; display policy changes visibility, never member parents. */
import { memo, useCallback, useEffect, useId, useRef, type ComponentProps } from 'react'
import { IconChevronDownOutlineRegular, IconListPenOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GroupKey, NodeReference } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatStoreState } from '../contract/store.ts'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { storedTurnProcessEntry } from '../stores.ts'
import { ChatNodeSeat } from './ChatNodeSeat.tsx'
import { chatRenderKey } from './render-entry.ts'
import { ProcessNotes, processFileLabel, workspaceRelativePath } from './ProcessNotes.tsx'
import { useSearchableHidden } from './searchable-hidden.ts'
import { useDisclosure } from './use-disclosure.ts'
import { useProcessScroll } from './use-process-scroll.ts'
import css from './ChatGroupSeat.module.css'

type SeatProps = Omit<ComponentProps<typeof ChatNodeSeat>, 'nodeKey' | 'groupPart'>
type ChatGroupSeatProps = SeatProps & {
  readonly groupKey: GroupKey
  readonly useChatGroup: ChatViewSlotProps['useChatGroup']
}
const GroupMembers = memo(function GroupMembers({ members, ...props }: SeatProps & {
  readonly members: readonly NodeReference[]
}) {
  return members.map(member => <ChatNodeSeat {...props} key={chatRenderKey(member)} nodeKey={member.key}
    {...member.groupPart === undefined ? {} : { groupPart: member.groupPart }} />)
})

/**
 * Summary line of one group whose Turn cannot fold as a whole. The toggle
 * covers the whole line; the file chips inside it open their files instead.
 */
const ProcessGroupHeader = memo(function ProcessGroupHeader({
  groupKey, useChatGroup, fileLabel, openFile, cwd, t, open, bodyId, toggle,
}: {
  readonly groupKey: GroupKey
  readonly useChatGroup: ChatViewSlotProps['useChatGroup']
  readonly fileLabel: ChatViewSlotProps['fileLabel']
  readonly openFile: (path: string) => void
  readonly cwd: string | undefined
  readonly t: ChatViewSlotProps['t']
  readonly open: boolean
  readonly bodyId: string
  readonly toggle: () => void
}) {
  const data = useChatGroup(groupKey, group => group?.data)
  const summaryId = useId()
  const nameFile = useCallback((path: string) => {
    const relative = workspaceRelativePath(path, cwd)
    return (relative === undefined ? undefined : fileLabel(relative))
      ?? processFileLabel(path, cwd, t('message.processNotes.separator'))
  }, [cwd, fileLabel, t])
  if (data === undefined) return null
  return (
    <div className={css.title} data-process-state={data.closed ? 'done' : 'live'}>
      <span className={css.leading} aria-hidden="true">
        {data.closed ? <IconListPenOutlineRegular /> : <span className={css.spinner} />}
      </span>
      <span className={css.label} id={summaryId}>
        <ProcessNotes counts={data.summary.counts} readPaths={data.summary.readPaths} live={!data.closed}
          fileLabel={nameFile} openFile={openFile} t={t} />
      </span>
      <button type="button" className={css.toggle} aria-expanded={open} aria-controls={bodyId}
        aria-describedby={summaryId} data-process-activity={data.summary.counts[0]?.kind ?? 'thinking'}
        onClick={(event) => { event.currentTarget.focus(); toggle() }}>
        {t(open ? 'message.processNotes.hide' : 'message.processNotes.show')}
        <IconChevronDownOutlineRegular className={css.chevron} />
      </button>
    </div>
  )
})

/** Render a process group with local disclosure and the existing outer-Turn visibility. */
export const ChatGroupSeat = memo(function ChatGroupSeat({ groupKey, useChatGroup, ...props }: ChatGroupSeatProps) {
  const members = useChatGroup(groupKey, group => group?.members)
  const turn = useChatGroup(groupKey, group => group?.data.turn)
  const closed = useChatGroup(groupKey, group => group?.data.closed)
  const foldCompleted = props.usePresentation(policy => policy.foldCompletedTurns)
  const { expanded: open, setExpanded: setOpen } = useDisclosure()
  const firstKey = members?.[0]?.key ?? ''
  const presentation = props.useChatNodeProcess(firstKey)
  const turnLocation = props.useChatNode(firstKey, (node) => {
    const location = node?.location
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn : undefined
  })
  const reason = turnLocation?.end?.data.reason.kind
  const alwaysOpen = presentation?.turnClosed === false || presentation?.hasInterleavedInput === true
    || reason === 'aborted' || reason === 'error'
  const spec = presentation?.spec
  const wholeTurnFolds = foldCompleted && presentation?.turnClosed === true && spec !== undefined && !alwaysOpen
  const grouped = props.usePresentation(policy => policy.stepGrouping === 'unfoldable') && !wholeTurnFolds
  const selectStored = useCallback((state: Readonly<ChatStoreState>) => turn === undefined
    ? undefined : storedTurnProcessEntry(state, turn), [turn])
  const stored = props.useStore(selectStored)
  const outerHidden = wholeTurnFolds && stored?.answerStep !== (spec.answerStep ?? 0)
  const revealOuter = useCallback(() => {
    if (spec !== undefined && !alwaysOpen) props.actions.setTurnProcessOpen(spec.turn, spec.answerStep ?? 0, true)
  }, [props.actions, spec, alwaysOpen])
  const rootRef = useSearchableHidden(outerHidden, revealOuter)
  useEffect(() => {
    if (outerHidden && rootRef.current?.hasAttribute('hidden')) setOpen(false)
  }, [outerHidden, rootRef, setOpen])
  // Rows the whole-Turn control has opened stay open if the group later gains a
  // header, as when paging reveals input that stops the whole Turn from folding.
  useEffect(() => {
    if (wholeTurnFolds && !outerHidden && !open) setOpen(true)
  }, [open, outerHidden, setOpen, wholeTurnFolds])
  const reveal = useCallback(() => { setOpen(true) }, [setOpen])
  const bodyRef = useSearchableHidden(grouped && !open, reveal)
  const contentRef = useRef<HTMLDivElement>(null)
  const bodyId = useId()
  const { edges, events, initialize } = useProcessScroll(bodyRef, contentRef, open, grouped)
  const toggle = useCallback(() => {
    if (!open) initialize(closed === false ? 'bottom' : 'top')
    setOpen(!open)
  }, [closed, initialize, open, setOpen])
  if (members === undefined) return null
  const classes = [css.body, !grouped ? css.expandedBody : '',
    grouped && edges.canScrollUp ? css.fadeTop : '', grouped && edges.canScrollDown ? css.fadeBottom : '']
  return (
    <div ref={rootRef} className={css.root} data-chat-group-key={groupKey}
      data-chat-flow-key={groupKey} data-chat-anchor-key={`group:${groupKey}`} data-chat-turn={turn}
      data-chat-paging-anchor={grouped && !open || undefined}
      data-step-process data-group-expanded-mode={!grouped || undefined}>
      <div hidden={!grouped}>
        <ProcessGroupHeader groupKey={groupKey} useChatGroup={useChatGroup} fileLabel={props.fileLabel}
          openFile={props.openFile} cwd={props.cwd} t={props.t} open={open} bodyId={bodyId} toggle={toggle} />
      </div>
      <div ref={bodyRef} id={bodyId} className={classes.join(' ')} data-step-process-body
        data-scroll-up={edges.canScrollUp || undefined} data-scroll-down={edges.canScrollDown || undefined}
        {...events}>
        <div ref={contentRef} className={css.content} data-step-process-content data-chat-flow="">
          <GroupMembers {...props} members={members} />
        </div>
      </div>
    </div>
  )
})
