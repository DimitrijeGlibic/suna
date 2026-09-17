export interface PiMinimalSandboxDockerfileOptions {
  agentBinaryPath: string;
  entrypointScriptPath: string;
  catalogPath: string;
  managedSkillsPath: string;
}

/**
 * Render the pi-only session image.
 *
 * pi runs in-process inside kortixd, so the image needs the daemon and what the
 * daemon and pi's tools execute: git (repo checkout, identity), ripgrep (glob and
 * grep tools), bash (bash tool; in bookworm-slim's essential set with tar, gzip,
 * coreutils and util-linux for the entrypoint's setpriv and /dev/shm mount) and
 * CA certificates. No OpenCode, Node, pnpm, Python, browsers, document tooling or
 * Kortix CLI: a session on this image can edit files and run shell commands, and
 * nothing else is preinstalled.
 */
export function buildPiMinimalSandboxDockerfile(options: PiMinimalSandboxDockerfileOptions): string {
  return `# syntax=docker/dockerfile:1.7
FROM debian:bookworm-slim

RUN apt-get update \\
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \\
      ca-certificates git ripgrep \\
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash kortix \\
 && mkdir -p /workspace /opt/kortix \\
 && chown -R kortix:kortix /workspace /opt/kortix

COPY ${options.agentBinaryPath} /tmp/kortix-agent.gz
RUN gzip -dc /tmp/kortix-agent.gz > /usr/local/bin/kortix-agent \\
 && chmod 0755 /usr/local/bin/kortix-agent \\
 && rm /tmp/kortix-agent.gz
COPY ${options.entrypointScriptPath} /usr/local/bin/kortix-entrypoint
RUN chmod 0755 /usr/local/bin/kortix-entrypoint
COPY --chown=kortix:kortix ${options.catalogPath} /opt/kortix/llm-catalog.json
COPY --chown=kortix:kortix ${options.managedSkillsPath} /opt/kortix/managed-skills

ENV KORTIX_WORKSPACE=/workspace \\
    KORTIX_HARNESS=pi \\
    KORTIX_LLM_CATALOG_FILE=/opt/kortix/llm-catalog.json
WORKDIR /workspace
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/kortix-entrypoint"]
`;
}
