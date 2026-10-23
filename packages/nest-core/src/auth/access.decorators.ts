import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Access markers (AN10). Every handler declares exactly one, on itself or its controller; an
 * unmarked route is denied. Applying a second marker to the same target throws at load time,
 * so two different markers can never silently override each other.
 */
export const ACCESS_KEY = 'access';

export type Access =
  | { kind: 'public' }
  | { kind: 'roles'; roles: readonly string[] }
  | { kind: 'signed'; caller: string };

function accessMarker(access: Access): MethodDecorator & ClassDecorator {
  return ((target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    const holder: object = (descriptor?.value as object | undefined) ?? target;
    if (Reflect.getMetadata(ACCESS_KEY, holder) !== undefined) {
      const name = key === undefined ? (target as { name?: string }).name : String(key);
      throw new Error(`Two access markers on ${name ?? 'a route'} (AN10)`);
    }
    Reflect.defineMetadata(ACCESS_KEY, access, holder);
    return descriptor;
  }) as MethodDecorator & ClassDecorator;
}

/** Anyone may call it (health checks, sign-in). Justify every use. */
export const Public = () => accessMarker({ kind: 'public' });

/** A signed-in user with one of these roles (bearer access token). */
export const Roles = (...roles: [string, ...string[]]) => accessMarker({ kind: 'roles', roles });

/** A service-to-service call signed with the shared secret of `caller` (P3). */
export const Signed = (caller: string) => accessMarker({ kind: 'signed', caller });

/** The authenticated user of a `@Roles()` route. */
export interface Principal {
  id: string;
  role: string;
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<{ principal?: Principal }>();
    if (!request.principal) throw new Error('CurrentPrincipal used outside a @Roles() route');
    return request.principal;
  },
);
