import { describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh } from '../../ui-conversation/src/client/locales.ts'
import { fileRowSummary, globSummary } from '../src/client/tool/models/file-label.ts'

const t = makeTranslate(zh)

describe('Tool row file names', () => {
  it('shows a provider name for a workspace file and keeps the path otherwise', () => {
    const label = (relative: string) => relative === '正文/全文.md' ? '正文 · 全文' : undefined
    expect(fileRowSummary('正文/全文.md', '/books/a/正文/全文.md', '/books/a', label)).toBe('正文 · 全文')
    expect(fileRowSummary('大纲/蓝图.md', '/books/a/大纲/蓝图.md', '/books/a', label)).toBe('大纲/蓝图.md')
    expect(fileRowSummary('/x/y.md', '/x/y.md', '/books/a', label)).toBe('/x/y.md')
    expect(fileRowSummary('a.md', undefined, '/books/a', label)).toBe('a.md')
    expect(fileRowSummary('a.md', 'a.md', '/books/a', undefined)).toBe('a.md')
  })

  it('says what a wildcard-only pattern means and keeps any other pattern', () => {
    expect(globSummary('**/*.md', t)).toBe('全部 .md 文件')
    expect(globSummary('*.txt', t)).toBe('全部 .txt 文件')
    expect(globSummary('**/*', t)).toBe('全部文件')
    expect(globSummary('正文/*.md', t)).toBe('正文/*.md')
  })
})
