/// Model the actual receiver policy, never enable password access implicitly.
int sevenDeskInteractiveMode({
  required String approveMode,
  required bool onlyWhenWindowOpen,
}) {
  if (approveMode == 'password') return 2;
  return onlyWhenWindowOpen ? 1 : 0;
}

/// A permanent password is considered active only when the receiver policy
/// also permits password authentication. Temporary passwords do not count.
bool sevenDeskUnattendedEnabled({
  required bool passwordConfigured,
  required String approveMode,
  required String verificationMethod,
}) {
  return passwordConfigured &&
      approveMode != 'click' &&
      verificationMethod != 'use-temporary-password';
}
