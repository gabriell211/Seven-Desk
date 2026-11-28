/// Display-only data from a remote login request.
/// These fields are NOT proof of identity: the rendezvous server must authorize
/// the connection separately and the receiver must still approve it locally.
class IncomingSupportIdentity {
  const IncomingSupportIdentity({
    required this.technician,
    required this.company,
    required this.avatarUrl,
  });

  final String technician;
  final String company;
  final String avatarUrl;
}

String _safeDisplayName(String raw, {required String fallback}) {
  final value = raw.trim();
  if (value.isEmpty || value.length > 100 || value.runes.any(
    (rune) => rune < 32 || rune == 127,
  )) {
    return fallback;
  }
  return value;
}

String _officialAvatar(String value) {
  if (value.isEmpty || value.length > 512) return '';
  final uri = Uri.tryParse(value);
  if (uri == null ||
      uri.scheme != 'https' ||
      uri.host != 'www.sevendesk.tech' ||
      uri.hasPort ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      !RegExp(
        r'^/avatars/[0-9a-f-]{36}/(?:profile|technician-[1-9][0-9]{0,4})\.(?:jpg|png|webp)$',
      ).hasMatch(uri.path)) {
    return '';
  }
  return uri.toString();
}

IncomingSupportIdentity incomingSupportIdentity({
  required String requesterName,
  required String requesterAvatar,
}) {
  // The installed sender uses 'Technician · Company' in LoginRequest.my_name.
  // Legacy clients may send only the desktop username.
  final separator = requesterName.indexOf(' · ');
  final technician = _safeDisplayName(
    separator >= 0 ? requesterName.substring(0, separator) : requesterName,
    fallback: 'Técnico não identificado',
  );
  final company = separator >= 0
      ? _safeDisplayName(
          requesterName.substring(separator + 3),
          fallback: 'Empresa não informada',
        )
      : 'Empresa não informada';
  return IncomingSupportIdentity(
    technician: technician,
    company: company,
    avatarUrl: _officialAvatar(requesterAvatar),
  );
}

bool canAcceptRemoteAsAdministrator({
  required bool isWindows,
  required bool canElevate,
  required bool showElevation,
  required bool isRemoteDesktop,
  required bool keyboardAllowed,
  required bool policyAllowsElevation,
  required bool clickApprovalAllowed,
}) {
  return isWindows &&
      canElevate &&
      showElevation &&
      isRemoteDesktop &&
      keyboardAllowed &&
      policyAllowsElevation &&
      clickApprovalAllowed;
}
