// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelProviderGroup, ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComponentProps } from 'react'
import type { ModelDirectoryState } from '../src/client/directory.ts'
import { ModelSelect } from '../src/client/ModelSelect.tsx'
import { modelPresentationSections, modelSectionKey } from '../src/client/presentation.ts'
import { zh } from '../src/client/locales.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'

// The seat's key domain is model ∪ common; the stub mirrors the real lookup
// chain: package dictionary, then common vocabulary, then the key.
const t: ComponentProps<typeof ModelSelect>['t'] = (key, params) => {
  const template = (zh as Record<string, string>)[key]
    ?? (commonZh as Record<string, string>)[key]
    ?? key
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match)
}

const reasoning = {
  efforts: [
    { id: 'off', name: 'Off' },
    { id: 'high', name: 'High' },
    { id: 'max', name: 'Max', description: 'Largest budget' },
  ],
  defaultEffort: 'high',
}

function state(overrides: Partial<ModelDirectoryState> = {}): ModelDirectoryState {
  return {
    current: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    routable: true,
    groups: [{
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', reasoning }],
    }],
    failures: [],
    status: 'ready',
    error: null,
    ...overrides,
  }
}

function presentedModel(
  id: string,
  name: string,
  sectionId: string,
  sectionName: string,
  sectionOrder: number,
): ModelProviderGroup['models'][number] {
  return { id, name, presentation: { sectionId, sectionName, sectionOrder } } as never
}

afterEach(cleanup)

describe('ModelSelect reasoning effort', () => {
  it('keeps locked model rows visible with their reason but cannot select them', () => {
    const directory = createSnapshotStore(state({ groups: [{
      id: 'hub', name: 'WriterX', models: [
        { id: 'free', name: '免费模型', availability: { selectable: true } },
        { id: 'premium', name: '专供模型', availability: { selectable: false, reason: '请先开通会员' } },
      ],
    }], current: { provider: 'hub', model: 'free' } }))
    const select = vi.fn().mockResolvedValue(true)
    render(<ModelSelect requestAction={vi.fn()} locked={false} available directory={directory} load={vi.fn()} select={select} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: '选择模型，当前 免费模型' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    const locked = screen.getByRole('menuitemradio', { name: /专供模型/ }) as HTMLButtonElement
    expect(locked.disabled).toBe(true)
    expect(locked.title).toBe('请先开通会员')
    fireEvent.click(locked)
    expect(select).not.toHaveBeenCalled()
    expect(screen.getByRole<HTMLButtonElement>('menuitemradio', { name: '免费模型' }).disabled).toBe(false)
  })

  it('keeps an unmarked provider as the existing single group', () => {
    const group = state().groups[0]!
    const sections = modelPresentationSections(group)
    expect(sections).toEqual([{
      key: 'deepseek-official',
      name: 'DeepSeek',
      models: group.models,
      presented: false,
    }])
  })

  it('renders stable Hub sections while current selection and clicks keep provider=hub', async () => {
    const groups: ModelProviderGroup[] = [{
      id: 'hub',
      name: 'WriterX 云',
      models: [
        presentedModel('vip-current', '专供当前', 'premium', '会员专供', 20),
        presentedModel('free-a', '免费 A', 'free', '内置免费', 10),
        presentedModel('vip-next', '专供 B', 'premium', '会员专供', 20),
        presentedModel('free-b', '免费 C', 'free', '内置免费', 10),
      ],
    }]
    const directory = createSnapshotStore<ModelDirectoryState>(state({
      groups,
      current: { provider: 'hub', model: 'vip-current' },
    }))
    const select = vi.fn().mockResolvedValue(true)
    render(<ModelSelect
      requestAction={vi.fn()}
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    expect(screen.getByRole('button', { name: '选择模型，当前 专供当前' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '选择模型，当前 专供当前' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    const headings = screen.getAllByRole('group').map(group => group.getAttribute('aria-labelledby'))
      .map(labelledBy => document.getElementById(labelledBy!)?.textContent)
    expect(headings).toEqual(['内置免费', '会员专供'])
    expect(screen.getByRole('menuitemradio', { name: '专供当前' }).getAttribute('aria-checked')).toBe('true')

    fireEvent.click(screen.getByRole('menuitemradio', { name: '专供 B' }))
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({ provider: 'hub', model: 'vip-next' })
    })
  })

  it('scopes identical presentation section ids by provider for unique keys', () => {
    expect(modelSectionKey('hub', 'presented:free')).not.toBe(modelSectionKey('other', 'presented:free'))
    const hub = modelPresentationSections({
      id: 'hub', name: 'WriterX', models: [presentedModel('h', 'H', 'free', '内置免费', 0)],
    })
    const other = modelPresentationSections({
      id: 'other', name: 'Other', models: [presentedModel('o', 'O', 'free', '免费', 0)],
    })
    expect(new Set([...hub, ...other].map(section => section.key)).size).toBe(2)
  })

  it('renders adapter metadata and submits the effort as part of the session selection', async () => {
    const directory = createSnapshotStore<ModelDirectoryState>(state())
    const select = vi.fn(async (selection: ModelSelection) => {
      directory.set(state({ current: selection }))
      return true
    })
    render(<ModelSelect
      requestAction={vi.fn()}
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const trigger = screen.getByRole('button', {
      name: '选择模型，当前 DeepSeek-V4-Flash，推理等级 High',
    })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent))
      .toEqual(['Off', 'High', 'MaxLargest budget'])

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Max/ }))
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        reasoningEffort: 'max',
      })
      expect(trigger.getAttribute('aria-label')).toBe('选择模型，当前 DeepSeek-V4-Flash，推理等级 Max')
    })
  })

  it('offers provider default only when the adapter does not configure a model default', () => {
    const directory = createSnapshotStore(state({
      groups: [{
        id: 'provider',
        name: 'Provider',
        models: [{
          id: 'model',
          name: 'Model',
          reasoning: { efforts: [{ id: 'standard', name: 'Standard' }] },
        }],
      }],
      current: { provider: 'provider', model: 'model' },
    }))
    render(<ModelSelect
      requestAction={vi.fn()}
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={vi.fn().mockResolvedValue(true)}
      t={t}
    />)

    fireEvent.click(screen.getByRole('button', {
      name: '选择模型，当前 Model，推理等级 Default',
    }))
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent))
      .toEqual(['Default', 'Standard'])
  })

  it('prompts for a selection when the current model is no longer advertised', () => {
    const directory = createSnapshotStore(state({
      current: { provider: 'deepseek-official', model: 'removed-model' },
    }))
    const select = vi.fn().mockResolvedValue(true)
    render(<ModelSelect
      requestAction={vi.fn()}
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const trigger = screen.getByRole('button', { name: '选择模型' })
    expect(trigger.textContent).toContain('选择模型')
    fireEvent.click(trigger)
    expect(screen.queryByRole('menuitem', { name: /推理等级/ })).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    expect(screen.queryByText('removed-model')).toBeNull()
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeTruthy()
  })

  it('announces a rejected selection as a transient toast and keeps the in-menu strip for loads', async () => {
    const groups = [{
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', reasoning },
        { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
      ],
    }]
    const directory = createSnapshotStore<ModelDirectoryState>(state({ groups }))
    const select = vi.fn(async () => {
      directory.set(state({ groups, status: 'error', error: 'model-unavailable: session already contains images' }))
      return false
    })
    render(<ModelSelect
      requestAction={vi.fn()}
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    fireEvent.click(screen.getByRole('button', { name: /选择模型|当前/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /模型/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /DeepSeek-V4-Pro/ }))
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toContain('模型操作失败：model-unavailable: session already contains images')
    // The selection failure does not render the in-menu load strip (no Retry).
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  })

  it('renders no Agent-bound control for an addressed subagent session', () => {
    const load = vi.fn()
    render(<ModelSelect
      requestAction={vi.fn()}
      locked={false}
      available={false}
      directory={createSnapshotStore(state())}
      load={load}
      select={vi.fn().mockResolvedValue(false)}
      t={t}
    />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })
})
