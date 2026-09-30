/** Shared provider display order for the composer and command model pickers. */

/**
 * Put WriterX's Hub (fork), then the account and official providers first, preserving every other relative order.
 * @param groups - Provider groups in catalog order.
 * @returns a sorted copy; model order within each group is unchanged.
 */
export function orderModelProviders<T extends { readonly id: string }>(groups: readonly T[]): T[] {
  const rank = (id: string): number => id === 'hub' ? 0 : id === 'deepseek-account' ? 1 : id === 'deepseek-official' ? 2 : 3
  return groups.toSorted((left, right) => rank(left.id) - rank(right.id))
}
