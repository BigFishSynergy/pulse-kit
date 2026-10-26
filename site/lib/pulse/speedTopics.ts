// The Speed Round's topics, read from the company's own material (content/speed-round.md: one "## Topic (N)" heading
// per topic), so the rules on the game page name what this company's quiz asks about.
import raw from "../../content/speed-round.md";

export const SPEED_TOPICS: string[] = String(raw ?? "").split("\n").map((l) => l.match(/^##\s+(.+?)\s*\(\d+\)\s*$/)?.[1]).filter((x): x is string => !!x);
