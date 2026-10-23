import { inject } from 'vitest';

// Every spec file boots the app against the run's throwaway database (global-setup.ts).
Object.assign(process.env, inject('testEnv'));
