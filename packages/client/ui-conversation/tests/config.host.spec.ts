import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as HostPlugin from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'
import { plainConfig } from '../../../settings/settings/src/schema.ts'
import {
  DEFAULT_BUSY_ENTER_BEHAVIOR, Config, apply,
} from '@deepseek-ai/dsh-client-ui-conversation'


describe('ui-conversation host', () => {
  it('registers, validates, and disposes the durable busy-Enter preference', async () => {
    const ctx = new Context()
    const configuration = await liveConfig(ctx, { Config, apply })
    const { fiber } = configuration
    expect(plainConfig(configuration.fiber.config)).toEqual({ busyEnter: DEFAULT_BUSY_ENTER_BEHAVIOR })
    await configuration.update({ busyEnter: 'steer' })
    expect(plainConfig(configuration.fiber.config)).toEqual({ busyEnter: 'steer' })
    await expect(configuration.update({ busyEnter: 'invalid' })).rejects.toThrow()
    await fiber.dispose()
  })

  it('publishes composition placeholder copy and validates localized fields', async () => {
    const ctx = new Context()
    const inputPlaceholder = { zh: '输入内容，@ 技能、# 文件', en: 'Write here, @ skills, # files' }
    const heroPlaceholder = { zh: '开始创作', en: 'Start writing' }
    const configuration = await liveConfig(ctx, { Config, apply }, { inputPlaceholder, heroPlaceholder })
    const { fiber } = configuration
    expect(plainConfig(fiber.config)).toEqual({
      busyEnter: DEFAULT_BUSY_ENTER_BEHAVIOR, inputPlaceholder, heroPlaceholder,
    })
    await configuration.update({ inputPlaceholder: { zh: '自定义', en: 'Custom' } })
    expect(plainConfig(fiber.config)).toEqual({
      busyEnter: DEFAULT_BUSY_ENTER_BEHAVIOR,
      inputPlaceholder: { zh: '自定义', en: 'Custom' },
      heroPlaceholder,
    })
    // @ts-expect-error Validate an incomplete configuration crossing the Loader boundary.
    expect(() => Config({ inputPlaceholder: { zh: '缺少英文' } })).toThrow()
    await expect(configuration.update({ heroPlaceholder: { zh: 123, en: 'Invalid' } })).rejects.toThrow()
    await fiber.dispose()
  })
})

it('keeps its own instance off the generated Settings pages', () => omitsGeneratedPage(ctx => ctx.plugin(HostPlugin)))
