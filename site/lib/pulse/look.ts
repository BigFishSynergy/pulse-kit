import "server-only";
import { cookies } from "next/headers";

// Which look a person picked: Clean (the few numbers that matter) or Everything (every section). Kept in a cookie so
// the server renders the right one straight away, with no flash. Clean is the default;
// anyone who picked Everything keeps it.
export type Look = "clean" | "full";
export const getLook = (): Look => (cookies().get("rr_look")?.value === "full" ? "full" : "clean");
