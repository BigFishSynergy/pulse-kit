#!/usr/bin/env node
// Manage Pulse logins. Passwords are stored only as scrypt hashes in PULSE_USERS.
//
//   node users.mjs list
//   node users.mjs add <name> "<Full Name>" rep <rep-slug>     sales rep (slug = roster name, lower case with dashes, like alex-rivera)
//   node users.mjs add <name> "<Full Name>" lead               leadership (sees everything)
//   node users.mjs add <name> "<Full Name>" csr <csr-slug>     CSR (slug = their "Appointment Set By" name, lower case with dashes, like jamie-ortiz)
//   node users.mjs password <name>                             set a new password (ends their sessions)
//   node users.mjs link <name>                                 new personal sign-in link (the old one stops working)
//   node users.mjs rename <name> "<Full Name>"                 change the name shown on screen
//   node users.mjs guest [days]                                one open guest link to the leadership Pulse, view only (default 7 days; replaces the old one)
//   node users.mjs remove <name>
//   node users.mjs push                                        copy PULSE_USERS to Vercel production
//
// Run it from site/. Works on site/.env.local (never committed). add and password print a new random password once, in
// this terminal only; pass --password <pw> to choose one. Hand passwords over in person or with the sign-in link, never by email.
// push needs the Vercel CLI, logged in to the client's own Vercel account and linked to their project (vercel link).
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV = new URL("./.env.local", import.meta.url);
const SITE = JSON.parse(readFileSync(new URL("./pulse.config.json", import.meta.url), "utf8")).company.site_url.replace(/\/$/, "");
const args = process.argv.slice(2);
const flag = (k) => {
  const i = args.indexOf(k);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const chosen = flag("--password");
const [cmd, name, ...rest] = args;

const text = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const line = text.split("\n").find((l) => l.startsWith("PULSE_USERS="));
let users = line ? JSON.parse(line.slice("PULSE_USERS=".length).replace(/^'|'$/g, "")) : [];

const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("base64url")}:${scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString("base64url")}`;
};
const newPassword = () => chosen || randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
const save = () => {
  const value = `PULSE_USERS='${JSON.stringify(users)}'`;
  const out = line ? text.replace(line, value) : (text && !text.endsWith("\n") ? text + "\n" : text) + value + "\n";
  writeFileSync(ENV, out);
};

if (cmd === "list") {
  for (const u of users) console.log(`${u.u.padEnd(12)} ${u.role.padEnd(5)} ${u.name}${u.rep ? `  (${u.rep})` : ""}${u.csr ? `  (CSR ${u.csr})` : ""}${u.expires ? `  expires ${u.expires.slice(0, 10)}` : ""}`);
} else if (cmd === "add") {
  const [full, role, rep] = rest;
  if (!name || !full || !["rep", "lead", "csr"].includes(role) || ((role === "rep" || role === "csr") && !rep)) {
    console.error('Usage: add <name> "<Full Name>" rep <rep-slug> | add <name> "<Full Name>" csr <csr-slug> | add <name> "<Full Name>" lead');
    process.exit(1);
  }
  if (users.some((u) => u.u === name)) {
    console.error(`${name} already exists. Use password ${name} to reset it.`);
    process.exit(1);
  }
  const pw = newPassword();
  users.push({ u: name, name: full, role, ...(rep ? (role === "csr" ? { csr: rep } : { rep }) : {}), hash: hash(pw) });
  save();
  console.log(`Added ${name}. Password: ${pw}`);
} else if (cmd === "password") {
  const u = users.find((x) => x.u === name);
  if (!u) {
    console.error(`No user ${name}`);
    process.exit(1);
  }
  const pw = newPassword();
  u.hash = hash(pw);
  save();
  console.log(`New password for ${name}: ${pw}`);
} else if (cmd === "link") {
  const u = users.find((x) => x.u === name);
  if (!u) {
    console.error(`No user ${name}`);
    process.exit(1);
  }
  const token = randomBytes(24).toString("base64url");
  u.key = createHash("sha256").update(token).digest("base64url");
  save();
  console.log(`Link for ${name}: ${SITE}/pulse/k/${token}`);
} else if (cmd === "rename") {
  const u = users.find((x) => x.u === name);
  if (!u || !rest[0]) {
    console.error(u ? 'Usage: rename <name> "<Full Name>"' : `No user ${name}`);
    process.exit(1);
  }
  u.name = rest[0];
  save();
  console.log(`${name} is now ${u.name}.`);
} else if (cmd === "guest") {
  const days = Number(name || 7);
  if (!(days > 0 && days <= 30)) {
    console.error("Usage: guest [days]   (1 to 30)");
    process.exit(1);
  }
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + days * 864e5).toISOString();
  users = users.filter((x) => x.u !== "guest");
  users.push({ u: "guest", name: "Guest", role: "lead", view: true, hash: hash(randomBytes(16).toString("hex")), key: createHash("sha256").update(token).digest("base64url"), expires });
  save();
  console.log(`Guest link (works until ${expires.slice(0, 10)}): ${SITE}/pulse/k/${token}`);
} else if (cmd === "remove") {
  users = users.filter((x) => x.u !== name);
  save();
  console.log(`Removed ${name}.`);
} else if (cmd === "push") {
  const value = JSON.stringify(users);
  // Never drop a login by accident: compare with what production has before replacing it.
  try {
    const live = execFileSync("vercel", ["env", "pull", "--environment=production", "/dev/stdout"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = live.split("\n").find((l) => l.startsWith("PULSE_USERS="));
    const prod = m ? JSON.parse(m.slice(12).replace(/^"|"$/g, "").replace(/\\"/g, '"')) : [];
    const gone = prod.filter((x) => !users.some((u) => u.u === x.u)).map((x) => x.u);
    if (gone.length && !args.includes("--drop")) {
      console.error(`Production has logins that are not in .env.local: ${gone.join(", ")}. Add them back, or run push --drop to remove them.`);
      process.exit(1);
    }
  } catch {}
  try {
    execFileSync("vercel", ["env", "rm", "PULSE_USERS", "production", "--yes"], { stdio: "ignore" });
  } catch {}
  execFileSync("vercel", ["env", "add", "PULSE_USERS", "production"], { input: value, stdio: ["pipe", "inherit", "inherit"] });
  console.log("PULSE_USERS updated on Vercel. Redeploy for it to take effect.");
} else {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 17).join("\n"));
}
