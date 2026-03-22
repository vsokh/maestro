import React, { useState } from 'react';
import {
  LAUNCH_HEALTHCHECK_CMD, LAUNCH_HEALTHCHECK, LAUNCH_HEALTHCHECK_ACTIVE,
  LAUNCH_AUTOFIX_CMD, LAUNCH_AUTOFIX, LAUNCH_AUTOFIX_ACTIVE,
} from '../../constants/strings.ts';
import { api } from '../../api.ts';

export function HealthcheckButton() {
  const [launched, setLaunched] = useState(false);

  const handleRun = async () => {
    try {
      await api.launch(0, LAUNCH_HEALTHCHECK_CMD);
      setLaunched(true);
      setTimeout(() => setLaunched(false), 5000);
    } catch (err) {
      console.error('Failed to launch healthcheck:', err);
    }
  };

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

export function AutofixButton() {
  const [launched, setLaunched] = useState(false);

  const handleRun = async () => {
    try {
      await api.launch(0, LAUNCH_AUTOFIX_CMD);
      setLaunched(true);
      setTimeout(() => setLaunched(false), 5000);
    } catch (err) {
      console.error('Failed to launch autofix:', err);
    }
  };

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
