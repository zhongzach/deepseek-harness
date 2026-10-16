// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ProcessNotes, processFileLabel, workspaceRelativePath } from '../src/client/chat/ProcessNotes.tsx'
import { zh } from '../src/client/locale.ts'

const t = makeTranslate(zh, commonZh)

afterEach(cleanup)

describe('ProcessNotes', () => {
  it('names file changes and questions before what was consulted, and keeps five categories', () => {
    const view = render(<ProcessNotes live={false} readPaths={['a.md', 'b.md']} t={t} counts={[
      { kind: 'read', count: 5 }, { kind: 'search', count: 3 }, { kind: 'tools', count: 2 },
      { kind: 'write', count: 1 }, { kind: 'edit', count: 1 }, { kind: 'questions', count: 1 },
    ]} />)
    expect(view.container.textContent).toBe('写入了 1 个文件 · 修改了 1 处 · 提问了 1 次 · 读取了 2 个文件 · 搜索了 3 次')
  })

  it('counts the read calls when no distinct paths were recorded', () => {
    const view = render(<ProcessNotes live={false} readPaths={[]} counts={[{ kind: 'read', count: 2 }]} t={t} />)
    expect(view.container.textContent).toBe('读取了 2 个文件')
  })

  it('falls back to the thinking title, live or settled', () => {
    const live = render(<ProcessNotes live readPaths={[]} counts={[]} t={t} />)
    expect(live.container.textContent).toBe(t('message.stepProcess.thinking'))
    cleanup()
    const settled = render(<ProcessNotes live={false} readPaths={[]} counts={[]} t={t} />)
    expect(settled.container.textContent).toBe(t('message.stepProcess.done.thinking'))
  })

  it('names three files as chips that open them and counts the rest', () => {
    const openFile = vi.fn()
    render(<ProcessNotes live readPaths={['a.md', 'b.md', 'c.md', 'd.md']} counts={[{ kind: 'read', count: 4 }]}
      fileLabel={path => path.toUpperCase()} openFile={openFile} t={t} />)
    const chips = screen.getAllByRole('button')
    expect(chips.map(chip => chip.textContent)).toEqual(['A.MD', 'B.MD', 'C.MD'])
    expect(screen.getByText('等 1 个')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '打开 B.MD' }))
    expect(openFile).toHaveBeenCalledWith('b.md')
  })

  it('leaves chips as text without an opener', () => {
    const view = render(<ProcessNotes live readPaths={['a.md']} counts={[{ kind: 'read', count: 1 }]}
      fileLabel={() => 'A'} t={t} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(view.container.querySelector('[data-process-file="a.md"]')?.textContent).toBe('A')
  })
})

describe('process file names', () => {
  it('reads paths relative to the workspace with forward slashes', () => {
    expect(workspaceRelativePath('D:\\书\\正文\\全文.md', 'D:\\书')).toBe('正文/全文.md')
    expect(workspaceRelativePath('./设定/人物库.md', '/books/a')).toBe('设定/人物库.md')
    expect(workspaceRelativePath('/elsewhere/x.md', '/books/a')).toBeUndefined()
  })

  it('labels a file by its folders and name without the extension', () => {
    expect(processFileLabel('正文/全文.md', '/books/a', ' · ')).toBe('正文 · 全文')
    expect(processFileLabel('/elsewhere/notes.txt', '/books/a', ' · ')).toBe('notes')
    expect(processFileLabel('.env', undefined, ' · ')).toBe('.env')
    expect(processFileLabel('/', undefined, ' · ')).toBe('/')
  })
})
