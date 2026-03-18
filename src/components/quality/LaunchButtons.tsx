import React, { useState } from 'react';

export function launchClaude(projectPath: string, command: string, title: string) {
  if (!projectPath) return;
  const path = projectPath.replace(/\\/g, '/');
  const url = 'claudecode:' + path + '?' + command + '?' + title;
  window.open(url, '_blank');
}

export function HealthcheckButton({ projectPath }: { projectPath: string }) {
  const [launched, setLaunched] = useState(false);

  const handleRun = () => {
    launchClaude(projectPath, '/codehealth scan', 'Healthcheck');
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
      {launched ? '\u2713 Scanning...' : 'Healthcheck'}
    </button>
  );
}

export function AutofixButton({ projectPath }: { projectPath: string }) {
  const [launched, setLaunched] = useState(false);

  const handleRun = () => {
    launchClaude(projectPath, '/autofix', 'Autofix');
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
      {launched ? '\u2713 Fixing...' : 'Autofix'}
    </button>
  );
}
