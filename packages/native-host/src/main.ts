#!/usr/bin/env node
import { serveNativeHost } from "./host.ts";
import { translate } from "./translate.ts";

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  await serveNativeHost(process.stdin, process.stdout, translate, shutdown.signal);
} catch {
  if (!shutdown.signal.aborted) {
    console.error("Native host stopped because its messaging connection failed.");
    process.exitCode = 1;
  }
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
