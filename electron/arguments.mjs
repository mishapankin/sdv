export function getRequestedWorkspace(argv) {
  const inlineOption = argv.find((argument) =>
    argument.startsWith("--workspace="),
  );

  if (inlineOption) {
    return inlineOption.slice("--workspace=".length);
  }

  const optionIndex = argv.indexOf("--workspace");
  return optionIndex >= 0 ? argv[optionIndex + 1] : undefined;
}
