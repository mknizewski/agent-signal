export type ProjectDropPosition = "before" | "after";

export function projectDropPositionForDirection(
  projectKeys: string[],
  sourceProjectKey: string,
  targetProjectKey: string
): ProjectDropPosition | null {
  const sourceIndex = projectKeys.indexOf(sourceProjectKey);
  const targetIndex = projectKeys.indexOf(targetProjectKey);
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex === targetIndex
  ) {
    return null;
  }
  return sourceIndex < targetIndex ? "after" : "before";
}

export function reorderProjectKeys(
  projectKeys: string[],
  sourceProjectKey: string,
  targetProjectKey: string,
  position: ProjectDropPosition
): string[] {
  if (
    sourceProjectKey === targetProjectKey ||
    !projectKeys.includes(sourceProjectKey) ||
    !projectKeys.includes(targetProjectKey)
  ) {
    return projectKeys;
  }
  const withoutSource = projectKeys.filter(
    (projectKey) => projectKey !== sourceProjectKey
  );
  const targetIndex = withoutSource.indexOf(targetProjectKey);
  const insertionIndex = targetIndex + (position === "after" ? 1 : 0);
  withoutSource.splice(insertionIndex, 0, sourceProjectKey);
  return withoutSource;
}
