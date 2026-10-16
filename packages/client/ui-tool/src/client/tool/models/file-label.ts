/** Display names for the file and pattern a Tool row's call names. */
import { isAbsoluteWorkspacePath, relativizeToCwd } from '@deepseek-ai/dsh-util-workspace-path'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Summary text for a row whose call names one file: a provider's name for a
 * workspace file, otherwise the row's own path summary.
 * @param summary - the row model's path summary.
 * @param filePath - the call's file path, when the row names one.
 * @param cwd - Session workspace root, when known.
 * @param fileLabel - names a workspace-relative file; absent keeps the path.
 * @returns the text the row shows.
 */
export function fileRowSummary(
  summary: string,
  filePath: string | undefined,
  cwd: string | undefined,
  fileLabel: ((relative: string) => string | undefined) | undefined,
): string {
  if (filePath === undefined || fileLabel === undefined) return summary
  const relative = relativizeToCwd(filePath, cwd)
  if (isAbsoluteWorkspacePath(relative)) return summary
  return fileLabel(relative.replaceAll('\\', '/').replace(/^(?:\.\/)+/u, '')) ?? summary
}

const WILDCARD_ONLY = /^(?:\*\*\/)?\*(\.[\p{L}\p{N}_-]+)?$/u

/**
 * Plain words for a file-name pattern that only says "every file" or "every
 * file of one type"; any other pattern stays as written.
 * @param pattern - the glob call's pattern.
 * @param t - conversation namespace translator.
 * @returns the summary text.
 */
export function globSummary(pattern: string, t: TranslateNS<'conversation'>): string {
  const match = WILDCARD_ONLY.exec(pattern.trim())
  if (match === null) return pattern
  const extension = match[1]
  return extension === undefined ? t('tool.glob.everything') : t('tool.glob.allOfType', { extension })
}
