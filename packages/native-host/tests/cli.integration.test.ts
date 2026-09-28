import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, onTestFinished, test } from "vitest";
import { encodeNativeMessage, readNativeMessages } from "../src/utils/native-messaging.ts";
import { runCli } from "../src/utils/run-cli.ts";
import { createRequest, createResult } from "./fixtures.ts";

function createInvocation(script: string, cancellation = new AbortController()) {
  onTestFinished(() => cancellation.abort());
  return {
    command: process.execPath,
    args: ["-e", script],
    cwd: tmpdir(),
    input: "Hello",
    signal: cancellation.signal,
  };
}

describe("CLI process integration", () => {
  test("passes text through stdin unchanged and returns only stdout", async () => {
    const input = '번역 $(echo unsafe) "quoted"';
    const invocation = createInvocation(
      "process.stdin.pipe(process.stdout); process.stderr.write('diagnostic');",
    );

    const stdout = await runCli({ ...invocation, input });

    expect(stdout).toBe(input);
  });

  test("rejects a missing executable", async () => {
    const invocation = createInvocation("");

    await expect(
      runCli({ ...invocation, command: join(tmpdir(), "opener-missing-cli") }),
    ).rejects.toThrow();
  });

  test("rejects an unsuccessful exit without exposing CLI stderr", async () => {
    const invocation = createInvocation(
      "process.stderr.write('PRIVATE_PAGE_TEXT'); process.exitCode = 1;",
    );

    await expect(runCli(invocation)).rejects.toMatchObject({
      message: expect.not.stringContaining("PRIVATE_PAGE_TEXT"),
    });
  });

  test.each(["stdout", "stderr"])("rejects excessive %s", async (stream) => {
    const invocation = createInvocation(`process.${stream}.write('x'.repeat(2 * 1024 * 1024));`);

    await expect(runCli(invocation)).rejects.toThrow();
  });

  test("rejects a CLI that exceeds its timeout", async () => {
    const invocation = createInvocation("setInterval(() => {}, 1000)");

    await expect(runCli({ ...invocation, timeoutMilliseconds: 50 })).rejects.toThrow();
  });

  test("rejects an active CLI invocation when cancelled", async () => {
    const cancellation = new AbortController();
    const invocation = createInvocation("setInterval(() => {}, 1000)", cancellation);
    const running = runCli(invocation);

    cancellation.abort();

    await expect(running).rejects.toThrow();
  });
});

test.skipIf(process.platform === "win32").each(["claude", "codex"] as const)(
  "%s translates through the TypeScript host and exits on disconnect",
  { timeout: 10_000 },
  async (provider) => {
    const directory = await mkdtemp(join(tmpdir(), "opener-cli-test-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const executable = join(directory, provider);
    await copyFile(new URL("./fake-cli.mjs", import.meta.url), executable);
    await chmod(executable, 0o700);
    const hostPath = fileURLToPath(new URL("../src/main.ts", import.meta.url));
    const host = spawn(process.execPath, [hostPath], {
      cwd: directory,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const closed = once(host, "close");
    onTestFinished(async () => {
      if (host.exitCode === null && host.signalCode === null) host.kill("SIGKILL");
      await closed;
    });
    const responses = readNativeMessages(host.stdout);

    host.stdin.write(encodeNativeMessage(createRequest({ provider })));
    const response = await responses.next();
    host.stdin.end();
    const [exitCode] = await closed;

    expect(response.value).toStrictEqual({
      type: "translate.result",
      ...createResult(),
    });
    expect(exitCode).toBe(0);
  },
);
