import { env } from "./config/env.js";
import { disconnectPrisma } from "./config/prisma.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  console.log(`CSKH API listening on port ${env.PORT}`);
});

const shutdown = async () => {
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

