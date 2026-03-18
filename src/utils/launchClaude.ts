export function launchClaude(projectPath: string, command: string, title: string) {
  if (!projectPath) return;
  const path = projectPath.replace(/\\/g, '/');
  const url = 'claudecode:' + encodeURIComponent(path) + '?' + encodeURIComponent(command) + '?' + encodeURIComponent(title);
  window.open(url, '_blank');
}
