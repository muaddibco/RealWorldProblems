const ISLAND_PATTERN = /<!--\s*rw:([a-z-]+):start\s*-->([\s\S]*?)<!--\s*rw:\1:end\s*-->/gi;

export function getIslandContent(body: string | null, islandName: string): string {
  if (!body) {
    return "";
  }

  const regex = new RegExp(
    `<!--\\s*rw:${islandName}:start\\s*-->([\\s\\S]*?)<!--\\s*rw:${islandName}:end\\s*-->`,
    "i"
  );

  const match = body.match(regex);
  if (!match || !match[1]) {
    return "";
  }

  return match[1].trim();
}

export function listIslands(body: string | null): string[] {
  if (!body) {
    return [];
  }

  const islands = new Set<string>();
  let match: RegExpExecArray | null = ISLAND_PATTERN.exec(body);
  while (match) {
    islands.add(match[1]);
    match = ISLAND_PATTERN.exec(body);
  }

  return Array.from(islands.values());
}
