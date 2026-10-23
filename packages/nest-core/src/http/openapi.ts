import { ERROR_CODES, errorEnvelopeSchema } from '@acme/contracts';
import type { INestApplication } from '@nestjs/common';
import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type OperationObject,
  type ParameterObject,
} from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';
import { ACCESS_KEY, type Access } from '../auth/access.decorators';

export const DOCS_PATH = 'docs';
export const DOCS_JSON_PATH = 'docs/openapi.json';
const BEARER = 'bearer';
const ERROR_SCHEMA = 'ErrorEnvelope';

/**
 * Swagger UI is served from the app's own copy of swagger-ui-dist (no CDN): scripts and
 * styles are same-origin; the page carries one inline `<style>` and data: icons. This CSP
 * applies to `/docs` only; every other route keeps Helmet's default.
 */
export const DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export interface OpenApiOptions {
  title: string;
  version: string;
  description: string;
  servers?: readonly { url: string; description?: string }[];
  /** Applied param decorators (`IdempotentRequest()`) that require `Idempotency-Key` (MO2). */
  idempotencyKeyParams?: readonly ParameterDecorator[];
}

interface RouteFacts {
  tag: string;
  access: Access | undefined;
  idempotent: boolean;
}

type ParamFactory = (...args: unknown[]) => unknown;

/** The factory behind a `createParamDecorator` decorator, read by applying it to a probe. */
function factoryOf(decorator: ParameterDecorator): ParamFactory | undefined {
  class Probe {
    handler(): void {}
  }
  decorator(Probe.prototype, 'handler', 0);
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler') as
    Record<string, { factory?: ParamFactory }> | undefined;
  return Object.values(args ?? {})[0]?.factory;
}

function usesFactory(controller: object, method: string, factories: Set<ParamFactory>): boolean {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) as
    Record<string, { factory?: ParamFactory }> | undefined;
  return Object.values(args ?? {}).some(
    (arg) => arg.factory !== undefined && factories.has(arg.factory),
  );
}

/** `PaymentsModule` → `payments`, `AdminModule` → `admin`. */
function tagOf(moduleName: string): string {
  return moduleName
    .replace(/Module$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/** Access marker, module tag and idempotency of every route, keyed by its operationId. */
function routeFacts(app: INestApplication, factories: Set<ParamFactory>): Map<string, RouteFacts> {
  const scanner = new MetadataScanner();
  const facts = new Map<string, RouteFacts>();
  for (const module of app.get(ModulesContainer).values()) {
    const tag = tagOf(module.metatype.name);
    for (const wrapper of module.controllers.values()) {
      // A controller wrapper's metatype is always its class.
      const controller = wrapper.metatype as new (...args: never[]) => object;
      const prototype = controller.prototype as Record<string, unknown>;
      const classAccess = Reflect.getMetadata(ACCESS_KEY, controller) as Access | undefined;
      for (const method of scanner.getAllMethodNames(prototype)) {
        // getAllMethodNames lists functions only; helpers without a route are skipped.
        const handler = prototype[method] as object;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        const access =
          (Reflect.getMetadata(ACCESS_KEY, handler) as Access | undefined) ?? classAccess;
        facts.set(`${controller.name}_${method}`, {
          tag,
          access,
          idempotent: usesFactory(controller, method, factories),
        });
      }
    }
  }
  return facts;
}

function header(name: string, required: boolean, description: string): ParameterObject {
  return { name, in: 'header', required, description, schema: { type: 'string' } };
}

const IDEMPOTENCY_KEY = header(
  'Idempotency-Key',
  true,
  'A client-generated UUID. A retry with the same key and body replays the first answer (MO2).',
);

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${ERROR_SCHEMA}` } } },
  };
}

/** Adds security, headers, tags and the error envelope to one operation from its route facts. */
function annotate(operation: OperationObject, facts: RouteFacts): void {
  operation.tags = [facts.tag];
  const parameters = [...(operation.parameters ?? [])];
  const { access } = facts;
  if (access?.kind === 'roles') {
    operation.security = [{ [BEARER]: [] }];
    operation.description = [operation.description, `Roles: ${access.roles.join(', ')}.`]
      .filter(Boolean)
      .join('\n\n');
    operation.responses['401'] = errorResponse('`common.unauthenticated`: no or expired token.');
    operation.responses['403'] = errorResponse('`common.forbidden`: the role is not allowed.');
  } else if (access?.kind === 'signed') {
    operation.security = [];
    operation.description = [
      operation.description,
      `Service-to-service call signed by \`${access.caller}\` (P3): HMAC-SHA256 over ` +
        '`timestamp.method.path.idempotencyKey.body`.',
    ]
      .filter(Boolean)
      .join('\n\n');
    parameters.push(
      header('X-Signature', true, 'Hex HMAC-SHA256 signature of the request.'),
      header('X-Signature-Timestamp', true, 'Unix seconds; accepted within ±5 minutes.'),
    );
    if (!facts.idempotent) {
      parameters.push(header('Idempotency-Key', false, 'Signed as sent; empty when absent.'));
    }
    operation.responses['401'] = errorResponse('`signature.invalid`: forged or stale signature.');
  } else {
    operation.security = [];
  }
  if (facts.idempotent) parameters.push(IDEMPOTENCY_KEY);
  operation.parameters = parameters;
  operation.responses.default = errorResponse(
    'Error envelope (A7): branch on `code`, never on `message`.',
  );
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

/** The OpenAPI 3.1 document of the real controllers and nestjs-zod DTOs, annotated. */
export function buildOpenApiDocument(
  app: INestApplication,
  options: OpenApiOptions,
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle(options.title)
    .setVersion(options.version)
    .setDescription(options.description)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token' },
      BEARER,
    );
  for (const server of options.servers ?? []) builder.addServer(server.url, server.description);

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, builder.build()), {
    version: '3.1',
  });

  const factories = new Set(
    (options.idempotencyKeyParams ?? [])
      .map(factoryOf)
      .filter((factory): factory is ParamFactory => factory !== undefined),
  );
  const facts = routeFacts(app, factories);
  for (const item of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      const routeFacts = operation?.operationId ? facts.get(operation.operationId) : undefined;
      if (operation && routeFacts) annotate(operation, routeFacts);
    }
  }

  const { $schema: _ignored, ...envelope } = z.toJSONSchema(errorEnvelopeSchema) as Record<
    string,
    unknown
  >;
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      [ERROR_SCHEMA]: {
        ...envelope,
        description: `One envelope for every error. Codes: ${ERROR_CODES.join(', ')}.`,
      },
    },
  };
  document.tags = [...new Set([...facts.values()].map((route) => route.tag))]
    .sort()
    .map((name) => ({ name }));
  return document;
}

/**
 * Serves Swagger UI at `GET /docs` and the document at `GET /docs/openapi.json`. Both are
 * mounted on the HTTP adapter, outside Nest's controllers: no guard runs (they are public by
 * construction) and the route-marker scan (AN10) never sees them. Call before `app.init()`.
 */
export function setupOpenApi(app: INestApplication, options: OpenApiOptions): OpenAPIObject {
  const document = buildOpenApiDocument(app, options);
  app.use(`/${DOCS_PATH}`, (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', DOCS_CSP);
    next();
  });
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: DOCS_JSON_PATH,
    raw: ['json'],
    customSiteTitle: options.title,
  });
  return document;
}
