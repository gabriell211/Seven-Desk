/// Requests Windows elevation before authorizing the remote session.
///
/// The UAC/service request is asynchronous in the native backend. Calling it
/// first preserves the legacy native consent sequence but does not mean that
/// UAC approval has already succeeded; the service reports its own status.
void acceptRemoteSessionAsAdministrator({
  required void Function() requestElevation,
  required void Function() authorizeConnection,
}) {
  requestElevation();
  authorizeConnection();
}
