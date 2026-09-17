/**
 * The reserved sandbox slug that boots a session on the pi-only image
 * (sandbox/pi-minimal-dockerfile.ts): kortixd with pi in-process, git, ripgrep,
 * and nothing else. Matched BEFORE project template resolution, like
 * META_SANDBOX_SLUG, and always runs the pi harness.
 */
export const PI_MINIMAL_SANDBOX_SLUG = 'pi-minimal';
