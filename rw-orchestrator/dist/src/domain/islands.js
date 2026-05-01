"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIslandContent = getIslandContent;
exports.listIslands = listIslands;
const ISLAND_PATTERN = /<!--\s*rw:([a-z-]+):start\s*-->([\s\S]*?)<!--\s*rw:\1:end\s*-->/gi;
function getIslandContent(body, islandName) {
    if (!body) {
        return "";
    }
    const regex = new RegExp(`<!--\\s*rw:${islandName}:start\\s*-->([\\s\\S]*?)<!--\\s*rw:${islandName}:end\\s*-->`, "i");
    const match = body.match(regex);
    if (!match || !match[1]) {
        return "";
    }
    return match[1].trim();
}
function listIslands(body) {
    if (!body) {
        return [];
    }
    const islands = new Set();
    let match = ISLAND_PATTERN.exec(body);
    while (match) {
        islands.add(match[1]);
        match = ISLAND_PATTERN.exec(body);
    }
    return Array.from(islands.values());
}
