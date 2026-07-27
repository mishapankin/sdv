export type GitRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<{ stdout: string }>;

export async function resolveCommit(
  run: GitRunner,
  cwd: string,
  ref: string,
) {
  const { stdout } = await run(
    "git",
    ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
    cwd,
  );

  return stdout.trim();
}
