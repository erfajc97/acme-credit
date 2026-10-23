import 'reflect-metadata';
import {
  Body,
  Controller,
  createParamDecorator,
  Get,
  Module,
  Param,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject, OperationObject, ParameterObject } from '@nestjs/swagger';
import helmet from 'helmet';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Public, Roles, Signed } from '../../auth/access.decorators';
import { DOCS_CSP, setupOpenApi } from '../openapi';

const IdemKey = createParamDecorator(() => 'key');
const Other = createParamDecorator(() => 'other');

class AmountDto extends createZodDto(z.object({ amountCents: z.string().max(19) }).strict()) {}
class IdDto extends createZodDto(z.object({ id: z.uuid() }).strict()) {}

@Controller('v1/things/:id')
@Roles('customer')
class ThingsController {
  @Post('deposits')
  deposit(@IdemKey() _key: string, @Param() _params: IdDto, @Body() _body: AmountDto): string {
    return 'ok';
  }

  @Get('deposits')
  list(@Other() _other: string, @Param() _params: IdDto): string {
    return 'ok';
  }
}

@Controller('v1/network')
@Signed('network')
class NetworkController {
  @Post('authorize')
  authorize(@IdemKey() _key: string): string {
    return 'ok';
  }

  @Get('status')
  status(): string {
    return this.helper();
  }

  helper(): string {
    return 'ok';
  }
}

@Controller()
class OpenController {
  @Get('health')
  @Public()
  health(): string {
    return 'ok';
  }

  @Get('unmarked')
  unmarked(): string {
    return 'ok';
  }
}

@Module({ controllers: [ThingsController] })
class LendingThingsModule {}

@Module({ controllers: [NetworkController, OpenController] })
class NetworkModule {}

@Module({ imports: [LendingThingsModule, NetworkModule] })
class RootModule {}

let app: INestApplication;
let doc: OpenAPIObject;

function op(path: string, method: 'get' | 'post'): OperationObject {
  const operation = doc.paths[path]?.[method];
  if (!operation) throw new Error(`missing ${method} ${path}`);
  return operation;
}

function headers(operation: OperationObject): Record<string, boolean | undefined> {
  return Object.fromEntries(
    (operation.parameters ?? [])
      .map((p) => p as ParameterObject)
      .filter((p) => p.in === 'header')
      .map((p) => [p.name, p.required]),
  );
}

beforeAll(async () => {
  app = await NestFactory.create(RootModule, { logger: false });
  app.use(helmet());
  doc = setupOpenApi(app, {
    title: 'Test API',
    version: '1.2.3',
    description: 'desc',
    servers: [{ url: 'http://localhost:9999', description: 'local' }],
    // A decorator that is not a param decorator yields no factory and is ignored.
    idempotencyKeyParams: [IdemKey(), () => undefined],
  });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('setupOpenApi', () => {
  it('builds an OpenAPI 3.1 document with info, servers, bearer scheme and module tags', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toMatchObject({ title: 'Test API', version: '1.2.3', description: 'desc' });
    expect(doc.servers).toEqual([{ url: 'http://localhost:9999', description: 'local' }]);
    expect(doc.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(doc.tags).toEqual([{ name: 'lending-things' }, { name: 'network' }]);
  });

  it('documents a role route with bearer security and a money POST with Idempotency-Key', () => {
    const deposit = op('/v1/things/{id}/deposits', 'post');
    expect(deposit.tags).toEqual(['lending-things']);
    expect(deposit.security).toEqual([{ bearer: [] }]);
    expect(deposit.description).toContain('Roles: customer.');
    expect(headers(deposit)).toEqual({ 'Idempotency-Key': true });
    expect(deposit.responses['401']).toBeDefined();
    expect(deposit.requestBody).toBeDefined();

    const list = op('/v1/things/{id}/deposits', 'get');
    expect(list.security).toEqual([{ bearer: [] }]);
    expect(headers(list)).toEqual({});
  });

  it('documents the signature headers on signed routes', () => {
    const authorize = op('/v1/network/authorize', 'post');
    expect(authorize.security).toEqual([]);
    expect(authorize.description).toContain('signed by `network`');
    expect(headers(authorize)).toEqual({
      'X-Signature': true,
      'X-Signature-Timestamp': true,
      'Idempotency-Key': true,
    });
    expect(headers(op('/v1/network/status', 'get'))).toEqual({
      'X-Signature': true,
      'X-Signature-Timestamp': true,
      'Idempotency-Key': false,
    });
  });

  it('leaves public and unmarked routes without security and adds the error envelope', () => {
    expect(op('/health', 'get').security).toEqual([]);
    expect(op('/unmarked', 'get').security).toEqual([]);
    expect(op('/health', 'get').responses.default).toEqual({
      description: expect.any(String),
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
    });
    const envelope = doc.components?.schemas?.ErrorEnvelope as {
      properties: { code: { enum: string[] } };
      required: string[];
    };
    expect(envelope.properties.code.enum).toContain('idempotency.key_required');
    expect(envelope.required).toEqual(expect.arrayContaining(['code', 'message', 'requestId']));
    expect(envelope).not.toHaveProperty('$schema');
  });

  it('serves the JSON at /docs/openapi.json and Swagger UI at /docs with the docs-only CSP', async () => {
    const json = await request(app.getHttpServer()).get('/docs/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.1.0');
    expect(json.headers['content-security-policy']).toBe(DOCS_CSP);

    const ui = await request(app.getHttpServer()).get('/docs').redirects(1);
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.text).toContain('swagger-ui-bundle.js');
    expect(ui.headers['content-security-policy']).toBe(DOCS_CSP);

    const asset = await request(app.getHttpServer()).get('/docs/swagger-ui-bundle.js');
    expect(asset.status).toBe(200);
  });

  it('keeps Helmet default CSP on every other route', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).not.toBe(DOCS_CSP);
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });
});
