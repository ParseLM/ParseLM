import { z } from "zod";
import { ProviderConfig, structured } from "./model";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Schema } from "jsonschema";

type ParseLMConfig = {
  provider: ProviderConfig;
  retryCount?: number; // Number of retries after the first attempt
  backoffFactor?: number; // Exponential backoff factor
};

export const createOpenAICompatibleProvider = (
  model: string,
  url: string,
  key: string
) => {
  return {
    model,
    url,
    key,
  };
};

export class ParseLM {
  private config: Required<ParseLMConfig>; // Use Required to ensure defaults are set

  constructor(config: ParseLMConfig) {
    this.config = {
      retryCount: 0, // Default to 0 retries (1 attempt total)
      backoffFactor: 2, // Default backoff factor
      ...config, // User config overrides defaults
    };
  }

  context(context: string) {
    return {
      schema: <T>(schema: z.ZodSchema<T>) => {
        const jsonSchema = zodToJsonSchema(schema);

        let result: Awaited<ReturnType<typeof structured>>;

        const execute = async () => {
          result =
            result ||
            (await structured({
              provider: this.config.provider,
              retryCount: this.config.retryCount,
              backoffFactor: this.config.backoffFactor,
              input: context,
              schema: jsonSchema as Schema,
            }));
        };

        return {
          value: async (): Promise<T> => {
            await execute();
            return result.structured as T;
          },
          safeValue: async (): Promise<
            | { success: true; value: T }
            | { success: false; error: string; value: null }
          > => {
            return execute()
              .then((r) => {
                return {
                  success: true,
                  value: result.structured as T,
                } as const;
              })
              .catch((e) => {
                return {
                  success: false,
                  error: e.message,
                  value: null,
                } as const;
              });
          },
          raw: async (): Promise<typeof result> => {
            await execute();
            return result;
          },
        };
      },
    };
  }

  isTrue(context: string) {
    return this.context(context)
      .schema(
        z.object({
          isTrue: z.boolean(),
        })
      )
      .value()
      .then((r) => r.isTrue === true);
  }

  oneOf(context: string, strings: string[]) {
    const [s1, ...rest] = strings;

    return this.context(context)
      .schema(
        z.object({
          value: z.enum([s1, ...rest]),
        })
      )
      .value()
      .then((r) => r.value);
  }

  toList(context: string) {
    return this.context(context)
      .schema(
        z.object({
          value: z.array(z.string()),
        })
      )
      .value()
      .then((r) => r.value);
  }

  toListOf(context: string, schema: z.ZodSchema) {
    return this.context(context)
      .schema(z.object({ value: z.array(schema) }))
      .value();
  }

  switch(context: string, fns: Record<string, Function>) {
    const [fn1, ...rest] = Object.keys(fns);

    return this.context(context)
      .schema(z.object({ value: z.enum([fn1, ...rest]) }))
      .value()
      .then((r) => fns[r.value](context));
  }
}
