import type { TranslateRequest, TranslationResult } from "@opener/protocol";

export type CliAdapter = (invocation: {
  input: string;
  instructions: string;
  cwd: string;
  signal?: AbortSignal;
}) => Promise<unknown>;

export type Translator = (
  request: TranslateRequest,
  signal: AbortSignal,
) => Promise<TranslationResult>;

export type CliAdapterMap = Readonly<Record<TranslateRequest["provider"], CliAdapter>>;
