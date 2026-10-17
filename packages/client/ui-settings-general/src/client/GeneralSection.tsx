/** The General section: one column rendering feature-owned item contributions. */
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsGeneralPage } from '@deepseek-ai/dsh-client-ui-settings/client'
import css from './GeneralSection.module.css'

/** Full component props: section owner share plus item render share. */
export type GeneralSectionComponentProps =
  PropsRuntime<'settings.section'> & PropsRenderSlots<'settings.general.item'>

/**
 * Render the General section content column: every item stacked, or — when the
 * shell draws it as one page of a composition's layout — that page's title and
 * its groups of rows, each group a card.
 * @param props - composed slot props (contract/slots.ts).
 * @returns the section element tree.
 */
export function GeneralSection({ renderSlot, page }: GeneralSectionComponentProps) {
  if (page === undefined) {
    return (
      <div className={css.section}>
        {renderSlot('settings.general.item', {})}
      </div>
    )
  }
  return <GeneralPage page={page} renderSlot={renderSlot} />
}

/**
 * One General page. Each row sits in its own `[data-setting-item]` wrapper keyed by
 * its item id, so a composition can style the rows of its pages without the rows'
 * owners knowing about pages; a row that draws nothing leaves its wrapper empty.
 * @param props - the page and the item render seat.
 * @returns the page element tree.
 */
function GeneralPage({ page, renderSlot }: { page: SettingsGeneralPage; renderSlot: GeneralSectionComponentProps['renderSlot'] }) {
  return (
    <div className={css.page} data-settings-page={page.id}>
      <div className={css.pageHead}>
        <h2 className={css.pageTitle}>{page.label}</h2>
        {page.description !== undefined && page.description !== '' && <p className={css.pageDescription}>{page.description}</p>}
      </div>
      {page.groups.map((group, index) => (
        <section key={`${String(index)}:${group.items.join(',')}`} className={css.group}
          {...group.label === undefined ? {} : { 'aria-label': group.label }}>
          {group.label !== undefined && <h3 className={css.groupLabel}>{group.label}</h3>}
          <div className={css.card} data-settings-group="">
            {group.items.map(id => (
              <div key={id} className={css.item} data-setting-item={id}>
                {renderSlot('settings.general.item', {}, { only: id })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
