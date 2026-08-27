/** Provider-internal presentation sections for the model directory UI. */
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'

type CatalogModel = ModelProviderGroup['models'][number]

/** Optional model metadata carried by deployments that subdivide one real provider. */
export interface ModelPresentation {
  sectionId: string
  sectionName: string
  sectionOrder?: number
}

/** One rendered section. `presented=false` is the unchanged provider group. */
export interface ModelPresentationSection {
  key: string
  name: string
  models: readonly CatalogModel[]
  presented: boolean
}

function presentationOf(model: CatalogModel): ModelPresentation | undefined {
  const value = (model as CatalogModel & { presentation?: unknown }).presentation
  if (value === null || typeof value !== 'object') return undefined
  const row = value as { sectionId?: unknown; sectionName?: unknown; sectionOrder?: unknown }
  if (typeof row.sectionId !== 'string' || row.sectionId.length === 0
    || typeof row.sectionName !== 'string' || row.sectionName.length === 0
    || (row.sectionOrder !== undefined && (typeof row.sectionOrder !== 'number' || !Number.isFinite(row.sectionOrder)))) {
    return undefined
  }
  return {
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    ...row.sectionOrder === undefined ? {} : { sectionOrder: row.sectionOrder },
  }
}

/** Stable React/DOM identity scoped by the real provider route. */
export function modelSectionKey(provider: string, sectionId: string): string {
  return `${provider}\u0000section\u0000${sectionId}`
}

/**
 * Partition one provider without changing its route identity. With no valid
 * metadata this returns the existing single group unchanged. Section order is
 * numeric first, then first occurrence; models retain provider order.
 */
export function modelPresentationSections(group: ModelProviderGroup): ModelPresentationSection[] {
  const presented = group.models.some(model => presentationOf(model) !== undefined)
  if (!presented) {
    return [{ key: group.id, name: group.name, models: group.models, presented: false }]
  }

  const buckets = new Map<string, {
    id: string
    name: string
    order: number
    first: number
    models: CatalogModel[]
    presented: boolean
  }>()
  group.models.forEach((model, index) => {
    const presentation = presentationOf(model)
    const id = presentation?.sectionId ?? 'provider'
    const bucketKey = presentation === undefined ? 'default\u0000provider' : `presented\u0000${id}`
    let bucket = buckets.get(bucketKey)
    if (bucket === undefined) {
      bucket = {
        id,
        name: presentation?.sectionName ?? group.name,
        order: presentation?.sectionOrder ?? 0,
        first: index,
        models: [],
        presented: presentation !== undefined,
      }
      buckets.set(bucketKey, bucket)
    }
    bucket.models.push(model)
  })

  return [...buckets.values()]
    .sort((left, right) => left.order - right.order || left.first - right.first)
    .map(section => ({
      key: modelSectionKey(group.id, `${section.presented ? 'presented:' : 'default:'}${section.id}`),
      name: section.name,
      models: section.models,
      presented: section.presented,
    }))
}
