import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/** Argon2id with the library's defaults (A12): the only place passwords are hashed or checked. */
@Injectable()
export class PasswordHasher {
  /** Verified when the email is unknown, so both paths cost the same (no user enumeration). */
  private decoy: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    if (hash === null) {
      this.decoy ??= this.hash('decoy-password-never-matches');
      await argon2.verify(await this.decoy, password);
      return false;
    }
    return argon2.verify(hash, password);
  }
}
