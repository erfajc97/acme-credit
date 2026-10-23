import type { INestApplication } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { ACCESS_KEY } from './access.decorators';

export interface RouteMarkerViolation {
  route: string;
  markers: number;
}

/**
 * Lists every handler whose access is not declared by exactly one marker (AN10): the marker
 * on the handler or, failing that, on its controller. Used by each service's route test.
 */
export function findRouteMarkerViolations(app: INestApplication): RouteMarkerViolation[] {
  const modules = app.get(ModulesContainer);
  const scanner = new MetadataScanner();
  const reflector = new Reflector();
  const violations: RouteMarkerViolation[] = [];
  const controllers = [...modules.values()].flatMap((module) => [...module.controllers.values()]);

  for (const wrapper of controllers) {
    const instance: unknown = wrapper.instance;
    if (typeof instance !== 'object' || instance === null) continue;
    const prototype = Object.getPrototypeOf(instance) as object;
    const controller = prototype.constructor;
    const classMarkers = reflector.get<unknown>(ACCESS_KEY, controller) === undefined ? 0 : 1;

    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = (prototype as Record<string, unknown>)[name];
      if (typeof handler !== 'function') continue;
      if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
      const handlerMarkers = reflector.get<unknown>(ACCESS_KEY, handler) === undefined ? 0 : 1;
      const markers = handlerMarkers + classMarkers;
      if (markers !== 1) violations.push({ route: `${controller.name}.${name}`, markers });
    }
  }
  return violations;
}
