import "server-only";
import { notFound } from "next/navigation";
import { pageOn, type PageKey } from "./config";

/** Call at the top of a page or route: a page switched off in pulse.config.json is a plain 404. */
export function requirePage(k: PageKey) {
  if (!pageOn(k)) notFound();
}
