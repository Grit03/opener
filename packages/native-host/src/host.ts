import type { Readable, Writable } from "node:stream";
import { readNativeMessages, ResponseError, writeNativeMessage } from "./utils/native-messaging.ts";
import {
  isValidNativeHostRequest,
  type NativeHostRequest,
  type NativeHostResponse,
} from "@opener/protocol";

export class NativeHost {
  private readonly input: Readable;
  private readonly output: Writable;
  private state: "ready" | "listening" | "closed" = "ready";
  private readonly handlers = new Map<
    string,
    (request: NativeHostRequest) => Promise<NativeHostResponse>
  >();

  constructor(input: Readable, output: Writable) {
    this.input = input;
    this.output = output;
  }

  on<Type extends NativeHostRequest["type"]>(
    type: Type,
    handler: (request: Extract<NativeHostRequest, { type: Type }>) => Promise<NativeHostResponse>,
  ): this {
    const matchesType = (
      request: NativeHostRequest,
    ): request is Extract<NativeHostRequest, { type: Type }> => request.type === type;

    this.handlers.set(type, async (request) => {
      if (!matchesType(request)) {
        throw new Error(`Unexpected request type: ${request.type}`);
      }
      return handler(request);
    });
    return this;
  }

  async listen(): Promise<void> {
    if (this.state !== "ready") {
      throw new Error(`Cannot start native host in state: ${this.state}`);
    }
    this.state = "listening";
    this.addListeners();

    // 메세지 읽기
    try {
      for await (const message of readNativeMessages(this.input)) {
        if (this.state !== "listening") break;
        void this.handleMessage(message).catch(this.handleError);
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.close();
    }
  }

  private async handleMessage(message: unknown) {
    if (!isValidNativeHostRequest(message)) {
      this.send({
        type: "error",
        code: "INVALID_REQUEST",
        message: "Received an invalid request.",
      });

      return;
    }

    const handler = this.handlers.get(message.type);

    if (!handler) {
      this.send({
        type: "error",
        code: "INVALID_REQUEST",
        message: "No handler registered for request type: " + message.type,
      });
      return;
    }

    const response = await handler(message);
    this.send(response);
  }

  private close = () => {
    this.state = "closed";

    this.input.removeListener("end", this.close);
    this.input.removeListener("close", this.close);
  };

  private addListeners() {
    this.input.once("end", this.close);
    this.input.once("close", this.close);
    this.output.once("error", this.handleOutputError);
    this.output.once("close", () => this.output.removeListener("error", this.handleOutputError));
  }

  private send(response: NativeHostResponse) {
    if (this.state !== "listening") return;
    writeNativeMessage(this.output, response);
  }

  private handleOutputError = (error: Error) => {
    this.state = "closed";
    this.output.destroy(error);
    this.input.destroy(error);
    console.error(error.message);
  };

  private handleError = (error: unknown) => {
    if (error instanceof ResponseError) {
      this.send({
        type: "error",
        code: "INVALID_REQUEST",
        message: error.message,
      });
    } else {
      console.error("Unknown error occurred: ", error);
    }
  };
}
