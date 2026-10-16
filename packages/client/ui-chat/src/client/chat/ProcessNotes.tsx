/** One-line summary of process work: what each category of Tool call did, and which files were read. */
import { Fragment, memo, type ReactNode } from 'react'
import { isAbsoluteWorkspacePath, pathPartsOf, relativizeToCwd } from '@deepseek-ai/dsh-util-workspace-path'
import type { ProcessActivity, ProcessActivityCount } from '../contract/process-groups.ts'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './ProcessNotes.module.css'

/** Files named before the summary folds the rest into a count. */
const SHOWN_FILES = 3

/** Categories a summary names. */
const SHOWN_CATEGORIES = 5

/**
 * Summary order: what changed files first, then what involved the reader, then
 * what was consulted; categories outside the list keep their ranking after it.
 */
const CATEGORY_ORDER: readonly ProcessActivity[] = [
  'write', 'edit', 'questions', 'read', 'readImage', 'search', 'webSearch', 'webFetch',
  'subagents', 'commands', 'code', 'plan', 'skills', 'tools',
]

function categoryRank(kind: ProcessActivity): number {
  const index = CATEGORY_ORDER.indexOf(kind)
  return index === -1 ? CATEGORY_ORDER.length : index
}

/**
 * Read a path relative to the Session's workspace, with `/` separators.
 * @param path - absolute or workspace-relative path as a Tool call named it.
 * @param cwd - Session workspace root, when known.
 * @returns the relative path, or undefined for a path outside the workspace.
 */
export function workspaceRelativePath(path: string, cwd: string | undefined): string | undefined {
  const relative = relativizeToCwd(path, cwd)
  if (isAbsoluteWorkspacePath(relative)) return undefined
  return relative.replaceAll('\\', '/').replace(/^(?:\.\/)+/u, '')
}

/**
 * Default chip text for a file a process read: its folders and its name
 * without the extension, joined by the summary separator; a file outside the
 * workspace shows only its name.
 * @param path - path as the Tool call named it.
 * @param cwd - Session workspace root, when known.
 * @param separator - localized segment separator.
 * @returns the display label.
 */
export function processFileLabel(path: string, cwd: string | undefined, separator: string): string {
  const relative = workspaceRelativePath(path, cwd)
  const segments = relative === undefined
    ? [pathPartsOf(path).name]
    : relative.split('/').filter(segment => segment !== '')
  const name = segments.pop()
  if (name === undefined) return path
  return [...segments, name.replace(/(?<=.)\.[^.]+$/u, '')].join(separator)
}

type Translate = ChatViewSlotProps['t']

/** Countable summary phrase for one category. */
function categoryPhrase(kind: Exclude<ProcessActivity, 'read'>, count: number, t: Translate): string {
  return t(`message.processNotes.${kind}.${count === 1 ? 'one' : 'other'}`, { count })
}

/**
 * Compose a process summary: its categories with their counts, file changes
 * and questions first, the files read named one by one when `fileLabel` is
 * given, and a thinking title when no Tool call ran.
 * @param props.counts - ranked distinct-call counts.
 * @param props.readPaths - distinct files read, in first-read order.
 * @param props.live - whether the range is still running; selects the thinking title.
 * @param props.fileLabel - names one read file's chip; absent counts the files instead.
 * @param props.openFile - opens one read file from its chip; absent leaves chips as text.
 * @param props.t - Chat namespace translator.
 * @returns the summary phrases separated by the localized separator.
 */
export const ProcessNotes = memo(function ProcessNotes({ counts, readPaths, live, fileLabel, openFile, t }: {
  readonly counts: readonly ProcessActivityCount[]
  readonly readPaths: readonly string[]
  readonly live: boolean
  readonly fileLabel?: ((path: string) => string) | undefined
  readonly openFile?: ((path: string) => void) | undefined
  readonly t: Translate
}) {
  const segments: ReactNode[] = []
  const ordered = [...counts].sort((left, right) => categoryRank(left.kind) - categoryRank(right.kind))
  for (const { kind, count } of ordered.slice(0, SHOWN_CATEGORIES)) {
    if (kind !== 'read') {
      segments.push(categoryPhrase(kind, count, t))
    } else if (fileLabel !== undefined && readPaths.length > 0) {
      const hidden = readPaths.length - SHOWN_FILES
      segments.push(
        <span className={css.files}>
          <span>{t('message.processNotes.readPrefix')}</span>
          {readPaths.slice(0, SHOWN_FILES).map((path) => {
            const name = fileLabel(path)
            return openFile === undefined
              ? <span key={path} className={css.file} data-process-file={path}>{name}</span>
              : (
                <button key={path} type="button" className={css.file} data-process-file={path}
                  aria-label={t('message.processNotes.openFile', { name })} onClick={() => { openFile(path) }}>
                  {name}
                </button>
              )
          })}
          {hidden > 0 && <span>{t('message.processNotes.moreFiles', { count: hidden })}</span>}
        </span>,
      )
    } else {
      const files = readPaths.length > 0 ? readPaths.length : count
      segments.push(t(`message.processNotes.read.${files === 1 ? 'one' : 'other'}`, { count: files }))
    }
  }
  if (segments.length === 0) segments.push(t(live ? 'message.stepProcess.thinking' : 'message.stepProcess.done.thinking'))
  const separator = t('message.processNotes.separator')
  return segments.map((segment, index) => (
    <Fragment key={index}>
      {index > 0 && <span className={css.separator}>{separator}</span>}
      <span className={css.segment}>{segment}</span>
    </Fragment>
  ))
})
