import { describe, expect, test } from 'bun:test';

import { buildPiMinimalSandboxDockerfile } from '../pi-minimal-dockerfile';

describe('buildPiMinimalSandboxDockerfile', () => {
  const dockerfile = buildPiMinimalSandboxDockerfile({
    agentBinaryPath: 'kortix-agent.gz',
    entrypointScriptPath: 'kortix-entrypoint',
    catalogPath: 'kortix-llm-catalog.json',
    managedSkillsPath: 'managed-skills',
  });

  test('installs only what the daemon and the pi tools execute', () => {
    expect(dockerfile).toContain('FROM debian:bookworm-slim');
    expect(dockerfile).toContain('ca-certificates git ripgrep');
    expect(dockerfile).toContain('/usr/local/bin/kortix-agent');
    expect(dockerfile).toContain('/usr/local/bin/kortix-entrypoint');
    expect(dockerfile).toContain('/opt/kortix/llm-catalog.json');
    expect(dockerfile).toContain('/opt/kortix/managed-skills');
    expect(dockerfile).toContain('KORTIX_HARNESS=pi');
    expect(dockerfile).toContain('ENTRYPOINT ["/usr/local/bin/kortix-entrypoint"]');
  });

  test('ships no OpenCode, Node, pnpm, Python, browser or Kortix CLI', () => {
    for (const absent of ['opencode', 'pnpm', 'node', 'uv ', 'python', 'chromium', 'playwright', 'kortix.gz']) {
      expect(dockerfile.toLowerCase()).not.toContain(absent);
    }
  });
});
