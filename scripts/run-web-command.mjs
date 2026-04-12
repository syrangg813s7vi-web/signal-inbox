import { spawn } from "node:child_process";

const [, , command, ...rawArgs] = process.argv;

if (!command) {
  console.error("Missing web command.");
  process.exit(1);
}

const forwardedArgs = rawArgs.filter((arg) => arg !== "--");

const child = spawn(
  "pnpm",
  ["--dir", "apps/web", command, ...forwardedArgs],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
