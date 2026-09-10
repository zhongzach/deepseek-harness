/** Private deployment roots have no npm publication or shared release version. */

/**
 * Identify the exact dependency-only application maintained by this fork.
 * @param directory - normalized repository-relative package directory.
 * @returns its required private package name, or undefined for release packages.
 */
export function deploymentOnlyPackageName(directory: string): string | undefined {
  return directory === 'apps/closure' ? '@deepseek-ai/dsh-closure' : undefined
}
