import Fastify from "fastify";
import type { FastifyBaseLogger } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { ERROR_CODES, errorBody } from "./errors.ts";

/**
 * Build the Fastify instance with the zod schema type provider, the validation
 * and serialization compilers, and the OpenAPI document and docs UI generated
 * from the same schemas the routes validate with.
 */
export async function buildApp(logger: FastifyBaseLogger) {
  const app = Fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>();
  app.decorateRequest("user", undefined);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      info: { title: "Spend Tracer API", version: "1.0.0" },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs" });

  // One coded error shape for validation failures, thrown errors and 404s.
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send(errorBody(ERROR_CODES.validationFailed, "request validation failed"));
    }
    const err = error as { statusCode?: number; message: string };
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, "Request failed");
      return reply.code(status).send(errorBody(ERROR_CODES.internal, "internal error"));
    }
    const code = status === 404 ? ERROR_CODES.notFound : "request_error";
    return reply.code(status).send(errorBody(code, err.message));
  });
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorBody(ERROR_CODES.notFound, "route not found"));
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
