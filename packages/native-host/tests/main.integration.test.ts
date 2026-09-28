import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vitest";
import { encodeNativeMessage, readNativeMessages } from "../src/utils/native-messaging.ts";
import { createRequest, createResult } from "./fixtures.ts";

test.skipIf(process.platform === "win32").each([
  { outcome: "success", description: "성공" },
  { outcome: "failure", description: "실패" },
])(
  "번역 4개 실행 중에는 BUSY를 반환하고 하나가 $description 후 종료되면 다음 요청을 처리한다",
  {
    timeout: 10_000,
  },
  async ({ outcome }) => {
    const directory = await mkdtemp("/tmp/opener-main-");
    const socketPath = join(directory, "cli.sock");
    const executable = join(directory, "claude");
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      sockets.push(socket);
      if (sockets.length === 4) server.emit("four-started");
    });
    onTestFinished(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    });
    const listening = once(server, "listening");
    server.listen(socketPath);
    await listening;
    await copyFile(new URL("./controlled-cli.mjs", import.meta.url), executable);
    await chmod(executable, 0o700);

    const host = spawn(
      process.execPath,
      [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
      {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          OPENER_TEST_SOCKET: socketPath,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const closed = once(host, "close");
    onTestFinished(async () => {
      if (host.exitCode === null && host.signalCode === null) host.kill("SIGKILL");
      await closed;
    });
    const responses = readNativeMessages(host.stdout);
    const started = once(server, "four-started");
    for (let index = 0; index < 4; index += 1) {
      host.stdin.write(encodeNativeMessage(createRequest()));
    }
    await started;

    host.stdin.write(encodeNativeMessage(createRequest()));
    expect((await responses.next()).value).toStrictEqual({
      type: "translate.error",
      code: "BUSY",
      message: "Too many active translation requests.",
    });
    expect(sockets).toHaveLength(4);

    sockets[0].end(outcome);
    const completed = (await responses.next()).value;
    const success = { type: "translate.result", ...createResult() };
    if (outcome === "success") {
      expect(completed).toStrictEqual(success);
    } else {
      expect(completed).toMatchObject({ type: "translate.error", code: "TRANSLATION_FAILED" });
    }

    const nextStarted = once(server, "connection");
    host.stdin.write(encodeNativeMessage(createRequest()));
    await nextStarted;
    expect(sockets).toHaveLength(5);
    sockets[4].end("success");
    expect((await responses.next()).value).toStrictEqual(success);

    for (const socket of sockets.slice(1, 4)) socket.end("success");
    for (let index = 0; index < 3; index += 1) {
      expect((await responses.next()).value).toStrictEqual(success);
    }
    host.stdin.end();
    expect((await closed)[0]).toBe(0);
  },
);
