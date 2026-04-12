export const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  PAUSED: 'paused',
  DONE: 'done',
  BLOCKED: 'blocked',
  CREATED: 'created',
  BACKLOG: 'backlog',
} as const;

export const DEFAULT_ACTIVITY_LIMIT = 20;
