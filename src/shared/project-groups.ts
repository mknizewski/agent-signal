import type { ProjectGroupConfig } from "./types";

const PROJECT_COLORS = [
  "#6f82e8",
  "#2d9f75",
  "#d28d24",
  "#cc6469",
  "#8d6bc5",
  "#2d98a0",
  "#bd6e9f",
  "#6185ad"
] as const;

export interface ProjectGroupPresentation {
  key: string;
  name: string;
  symbol: string;
  color: string;
  collapsed: boolean;
  sidebarCollapsed: boolean;
  order: number;
}

export interface SessionProjectGroup<T> extends ProjectGroupPresentation {
  sessions: T[];
}

export function groupSessionsByProject<T extends { projectName: string }>(
  sessions: T[],
  grouped: boolean,
  noProjectLabel: string,
  configs: ProjectGroupConfig[]
): SessionProjectGroup<T>[] {
  if (!grouped) {
    return [
      {
        key: "all",
        name: "all",
        symbol: "A",
        color: PROJECT_COLORS[0],
        collapsed: false,
        sidebarCollapsed: false,
        order: 0,
        sessions
      }
    ];
  }

  const groups = new Map<string, T[]>();
  for (const session of sessions) {
    const key = session.projectName.trim();
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }

  return [...groups.entries()]
    .map(([key, entries]) => ({
      ...resolveProjectGroup(key, key || noProjectLabel, configs),
      sessions: entries
    }))
    .sort(compareProjectGroups);
}

export function resolveProjectGroup(
  projectKey: string,
  fallbackName: string,
  configs: ProjectGroupConfig[]
): ProjectGroupPresentation {
  const config = configs.find((item) => item.projectKey === projectKey);
  const name = config?.label?.trim() || fallbackName;
  return {
    key: projectKey,
    name,
    symbol:
      config?.symbol?.trim() ||
      defaultProjectSymbol(name),
    color:
      config?.color && isProjectColor(config.color)
        ? config.color
        : defaultProjectColor(projectKey || fallbackName),
    collapsed: config?.collapsed === true,
    sidebarCollapsed: config?.sidebarCollapsed === true,
    order:
      typeof config?.order === "number" && Number.isFinite(config.order)
        ? config.order
        : Number.MAX_SAFE_INTEGER
  };
}

export function normalizeProjectGroupConfigs(
  value: unknown
): ProjectGroupConfig[] {
  if (!Array.isArray(value)) return [];
  const normalized = new Map<string, ProjectGroupConfig>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<ProjectGroupConfig>;
    if (
      typeof candidate.projectKey !== "string" ||
      candidate.projectKey.length > 80
    ) {
      continue;
    }
    const label =
      typeof candidate.label === "string"
        ? candidate.label.trim().slice(0, 80)
        : "";
    const symbol =
      typeof candidate.symbol === "string"
        ? [...candidate.symbol.trim()].slice(0, 2).join("")
        : "";
    const color =
      typeof candidate.color === "string" &&
      isProjectColor(candidate.color)
        ? candidate.color.toLowerCase()
        : "";
    normalized.set(candidate.projectKey, {
      projectKey: candidate.projectKey,
      ...(label ? { label } : {}),
      ...(symbol ? { symbol } : {}),
      ...(color ? { color } : {}),
      ...(candidate.collapsed === true ? { collapsed: true } : {}),
      ...(candidate.sidebarCollapsed === true
        ? { sidebarCollapsed: true }
        : {}),
      order:
        typeof candidate.order === "number" &&
        Number.isFinite(candidate.order)
          ? Math.max(0, Math.round(candidate.order))
          : normalized.size
    });
  }
  return [...normalized.values()].sort((left, right) => left.order - right.order);
}

export function setProjectGroupsCollapsed(
  configs: ProjectGroupConfig[],
  projectKeys: string[],
  collapsed: boolean
): ProjectGroupConfig[] {
  const uniqueKeys = [...new Set(projectKeys)];
  const keySet = new Set(uniqueKeys);
  const existing = new Map(
    configs.map((group) => [group.projectKey, group])
  );
  const maxOrder = configs.reduce(
    (highest, group) => Math.max(highest, group.order),
    -1
  );
  const updated = uniqueKeys.map((projectKey, index) => {
    const group: ProjectGroupConfig = {
      ...(existing.get(projectKey) ?? {
        projectKey,
        order: maxOrder + index + 1
      })
    };
    if (collapsed) group.collapsed = true;
    else delete group.collapsed;
    return group;
  });

  return normalizeProjectGroupConfigs([
    ...configs.filter((group) => !keySet.has(group.projectKey)),
    ...updated
  ]);
}

export function defaultProjectColor(projectKey: string): string {
  let hash = 0;
  for (const character of projectKey.toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

export function defaultProjectSymbol(name: string): string {
  return [...name.trim()][0]?.toLocaleUpperCase() || "•";
}

export function isProjectColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function compareProjectGroups<T>(
  left: SessionProjectGroup<T>,
  right: SessionProjectGroup<T>
): number {
  const orderDifference = left.order - right.order;
  if (orderDifference !== 0) return orderDifference;
  return left.name.localeCompare(right.name);
}
