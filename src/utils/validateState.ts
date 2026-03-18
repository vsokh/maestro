interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateState(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['State must be an object'] };
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.tasks)) {
    errors.push('tasks must be an array');
  } else {
    const ids = new Set<number>();
    (d.tasks as Record<string, unknown>[]).forEach((t, i) => {
      if (typeof t.id !== 'number') errors.push(`tasks[${i}].id must be a number`);
      if (typeof t.name !== 'string' || !t.name) errors.push(`tasks[${i}].name must be a non-empty string`);
      if (ids.has(t.id as number)) errors.push(`Duplicate task id: ${t.id}`);
      ids.add(t.id as number);
      if (t.dependsOn !== undefined && !Array.isArray(t.dependsOn)) {
        errors.push(`tasks[${i}].dependsOn must be an array`);
      }
      if (Array.isArray(t.dependsOn)) {
        (t.dependsOn as unknown[]).forEach(dep => {
          if (typeof dep !== 'number') errors.push(`tasks[${i}].dependsOn contains non-number: ${dep}`);
        });
      }
      if (t.status !== undefined) {
        const validStatuses = ['pending', 'in-progress', 'done', 'blocked', 'paused', 'backlog'];
        if (!validStatuses.includes(t.status as string)) errors.push(`tasks[${i}].status "${t.status}" is not valid`);
      }
    });
  }

  if (d.queue !== undefined && !Array.isArray(d.queue)) {
    errors.push('queue must be an array');
  } else if (Array.isArray(d.queue)) {
    (d.queue as Record<string, unknown>[]).forEach((q, i) => {
      if (typeof q.task !== 'number') errors.push(`queue[${i}].task must be a number`);
      if (typeof q.taskName !== 'string') errors.push(`queue[${i}].taskName must be a string`);
    });
  }

  if (d.activity !== undefined && !Array.isArray(d.activity)) {
    errors.push('activity must be an array');
  }

  return { valid: errors.length === 0, errors };
}
