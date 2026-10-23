import { Injectable, Logger } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/client';
import { PasswordHasher } from '../../core/auth/password-hasher';
import type { SeedEnv } from '../../core/config/env';
import { PrismaService } from '../../core/database/prisma.service';

interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

/**
 * Seed users (the admin and, unless the env skips it, the demo customer), upserted by email so
 * the seed can run on every boot.
 * An existing user keeps its password: rotating it is the owner's call, not the deploy's.
 */
@Injectable()
export class UsersSeeder {
  private readonly logger = new Logger(UsersSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
  ) {}

  async seed(env: SeedEnv): Promise<void> {
    const users: SeedUser[] = [{ ...env.admin, fullName: 'Acme Admin', role: 'admin' }];
    if (env.customer) users.push({ ...env.customer, fullName: 'Demo Customer', role: 'customer' });
    for (const user of users) {
      const email = user.email.trim().toLowerCase();
      await this.prisma.user.upsert({
        where: { email },
        create: {
          email,
          passwordHash: await this.hasher.hash(user.password),
          fullName: user.fullName,
          role: user.role,
        },
        update: { role: user.role },
        select: { id: true },
      });
      this.logger.log({ role: user.role }, 'seed user ready');
    }
  }
}
