import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export interface TemporaryPostgresInstance {
  cleanup: () => Promise<void>;
  databaseUrl: string;
}

export async function startTemporaryPostgres(): Promise<TemporaryPostgresInstance> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "signal-inbox-db-smoke-"));
  const dataDir = path.join(tempRoot, "data");
  const logFile = path.join(tempRoot, "postgres.log");
  const port = await getFreePort();
  const databaseName = "signal_inbox_smoke";
  let postgresStarted = false;

  try {
    await execFile("initdb", ["-D", dataDir, "-A", "trust", "-U", "postgres"], {
      env: process.env,
    });
    await execFile("pg_ctl", ["-D", dataDir, "-l", logFile, "-o", `-F -p ${port}`, "start"], {
      env: process.env,
    });
    postgresStarted = true;
    await execFile("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", databaseName], {
      env: process.env,
    });

    return {
      cleanup: async () => {
        try {
          await execFile("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"], {
            env: process.env,
          });
        } finally {
          await rm(tempRoot, { force: true, recursive: true });
        }
      },
      databaseUrl: `postgresql://postgres@127.0.0.1:${port}/${databaseName}`,
    };
  } catch (error) {
    if (postgresStarted) {
      try {
        await execFile("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"], {
          env: process.env,
        });
      } catch {
        // Best effort cleanup for partial startup failures.
      }
    }

    await rm(tempRoot, { force: true, recursive: true });
    throw error;
  }
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a free TCP port for PostgreSQL.")));
        return;
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}
