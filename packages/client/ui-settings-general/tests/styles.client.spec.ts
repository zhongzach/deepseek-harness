/** Settings shell sizing and scroll-ownership stylesheet contract. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/SettingsRoot.module.css', import.meta.url)), 'utf8')

/** The declarations of one top-level rule, by selector. */
function block(selector: string): string {
  const match = new RegExp(`^\\${selector} \\{([^}]*)\\}`, 'm').exec(css)
  if (match === null) throw new Error(`SettingsRoot.module.css has no \`${selector}\` rule`)
  return match[1] ?? ''
}

describe('settings shell styles', () => {
  it('keeps a compact fixed desktop height with a short-viewport fallback', () => {
    const panel = block('.panel')
    expect(panel).toMatch(/width:\s*800px/)
    expect(panel).toMatch(/height:\s*min\(640px, calc\(100vh - 2 \* max\(24px, var\(--dsh-frame-top-clearance, 24px\)\)\)\)/)
    expect(panel).toMatch(/overflow:\s*hidden/)
  })

  it('assigns vertical scrolling to the active section content', () => {
    const options = block('.options')
    expect(options).toMatch(/flex:\s*1/)
    expect(options).toMatch(/min-height:\s*0/)
    expect(options).toMatch(/overflow-y:\s*auto/)
  })
})
