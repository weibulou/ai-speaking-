
// Neutralized firebase.ts for domestic compatibility (No VPN required for frontend)
// All database and auth operations are now proxied via the backend server.

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  console.error(`Firestore Proxy Error [${operationType}] at ${path}:`, error);
  throw error;
}

// Mock types to maintain compatibility during migration
export type User = {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
};
