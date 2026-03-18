import React, { useState } from 'react';
import {
  LAUNCH_HEALTHCHECK_CMD, LAUNCH_HEALTHCHECK, LAUNCH_HEALTHCHECK_ACTIVE,
  LAUNCH_AUTOFIX_CMD, LAUNCH_AUTOFIX, LAUNCH_AUTOFIX_ACTIVE,
} from '../../constants/strings.ts';
import { launchClaude } from '../../utils/launchClaude.ts';

export function HealthcheckButton({ projectPath }: { projectPath: string }) {
  const [launched, setLaunched] = useState(false);

  const handleRun = () => {
    launchClaude(projectPath, LAUNCH_HEALTHCHECK_CMD, LAUNCH_HEALTHCHECK);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 5000);
  };

  if (!projectPath) return null;

  return (
    <button
      onClick={handleRun}
      className={`healthcheck-btn ${launched ? 'healthcheck-btn--launched' : 'healthcheck-btn--idle'}`}
      style={{ padding: '6px 14px' }}
    >
      {launched ? LAUNCH_HEALTHCHECK_ACTIVE : LAUNCH_HEALTHCHECK}
    </button>
  );
}

export function AutofixButton({ projectPath }: { projectPath: string }) {
  const [launched, setLaunched] = useState(false);

  const handleRun = () => {
    launchClaude(projectPath, LAUNCH_AUTOFIX_CMD, LAUNCH_AUTOFIX);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 5000);
  };

  if (!projectPath) return null;

  return (
    <button
      onClick={handleRun}
      className={`autofix-btn ${launched ? 'autofix-btn--launched' : 'autofix-btn--idle'}`}
      style={{ padding: '6px 14px' }}
    >
      {launched ? LAUNCH_AUTOFIX_ACTIVE : LAUNCH_AUTOFIX}
    </button>
  );
}
