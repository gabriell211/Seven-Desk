import 'dart:convert';

/// Optional build-time defaults for a private ID/relay server.
///
/// A private server does not require an account login, but remote-session
/// authentication and device approval remain unchanged.
class SevenDeskServerDefaults {
  const SevenDeskServerDefaults({
    required this.idServer,
    required this.publicKey,
    this.relayServer = '',
  });

  static const fromBuild = SevenDeskServerDefaults(
    idServer: String.fromEnvironment('SEVEN_DESK_ID_SERVER'),
    relayServer: String.fromEnvironment('SEVEN_DESK_RELAY_SERVER'),
    publicKey: String.fromEnvironment('SEVEN_DESK_SERVER_KEY'),
  );

  final String idServer;
  final String relayServer;
  final String publicKey;

  static bool _validHost(String input) {
    final value = input.trim();
    if (value.isEmpty ||
        !RegExp(r'^[a-zA-Z0-9.\-:\[\]]+$').hasMatch(value)) {
      return false;
    }
    final uri = Uri.tryParse('tcp://$value');
    if (uri == null || uri.host.isEmpty || uri.userInfo.isNotEmpty) {
      return false;
    }
    final host = uri.host.toLowerCase();
    // Never mistake the public provider (which requires login) for self-hosting.
    if (host == 'rustdesk.com' || host.endsWith('.rustdesk.com')) {
      return false;
    }
    return uri.path.isEmpty && !uri.hasQuery && !uri.hasFragment;
  }

  bool get isValid {
    if (!_validHost(idServer) ||
        (relayServer.trim().isNotEmpty && !_validHost(relayServer))) {
      return false;
    }
    try {
      // The OSS server's id_ed25519.pub contains a 32-byte public key.
      return base64Decode(base64.normalize(publicKey.trim())).length == 32;
    } on FormatException {
      return false;
    }
  }

  /// Applies defaults only to a clean installation with no account session.
  /// Already configured clients and custom builds keep their current server.
  Future<bool> apply({
    required Future<String> Function(String) readOption,
    required Future<void> Function(String, String) writeOption,
    required bool hasAccountToken,
    required bool settingsDisabled,
    required bool isCustomClient,
  }) async {
    if (!isValid || hasAccountToken || settingsDisabled || isCustomClient) {
      return false;
    }

    const optionKeys = [
      'custom-rendezvous-server',
      'relay-server',
      'api-server',
      'key',
    ];
    for (final name in optionKeys) {
      if ((await readOption(name)).trim().isNotEmpty) {
        return false;
      }
    }

    // Install the public key BEFORE switching ID server so transport
    // authentication remains in place throughout configuration.
    final changes = [
      MapEntry('key', publicKey.trim()),
      if (relayServer.trim().isNotEmpty)
        MapEntry('relay-server', relayServer.trim()),
      MapEntry('custom-rendezvous-server', idServer.trim()),
    ];
    final applied = <String>[];
    try {
      for (final change in changes) {
        await writeOption(change.key, change.value);
        applied.add(change.key);
      }
      return true;
    } catch (_) {
      // Only these keys were blank initially. Best-effort rollback ensures
      // an interrupted setup doesn't strand the existing network settings.
      for (final name in applied.reversed) {
        try {
          await writeOption(name, '');
        } catch (_) {}
      }
      rethrow;
    }
  }
}
