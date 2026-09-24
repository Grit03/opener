import { execFile } from "node:child_process";

interface CliInvocation {
  command: string;
  args: string[];
  input: string;
  cwd: string;
  signal: AbortSignal;
  timeoutMilliseconds?: number;
}

export function runCli({
  command,
  args,
  input,
  cwd,
  signal,
  timeoutMilliseconds = 120_000,
}: CliInvocation): Promise<string> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      {
        cwd,
        signal,
        timeout: timeoutMilliseconds,
        killSignal: "SIGKILL",
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          // CLI errors can contain page text in stdout or stderr.
          reject(new Error("CLI execution failed. Check installation, login, and timeout."));
          return;
        }
        resolve(stdout);
      },
    );

    child.stdin!.on("error", () => {
      child.kill("SIGKILL");
      reject(new Error("Could not send the translation request to the CLI."));
    });
    child.stdin!.end(input);
  });
}
