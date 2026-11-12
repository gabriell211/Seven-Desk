import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/utils/seven_desk_server_defaults.dart';

void main() {
  final publicKey = base64Encode(List<int>.generate(32, (index) => index));

  SevenDeskServerDefaults defaults({
    String idServer = 'desk.example.com:21116',
    String relayServer = 'desk.example.com:21117',
    String? key,
  }) =>
      SevenDeskServerDefaults(
        idServer: idServer,
        relayServer: relayServer,
        publicKey: key ?? publicKey,
      );

  Future<bool> apply(
    SevenDeskServerDefaults config,
    Map<String, String> options, {
    bool accountToken = false,
    bool disabledSettings = false,
    bool customClient = false,
  }) =>
      config.apply(
        readOption: (name) async => options[name] ?? '',
        writeOption: (name, value) async {
          options[name] = value;
        },
        hasAccountToken: accountToken,
        settingsDisabled: disabledSettings,
        isCustomClient: customClient,
      );

  test('configures a new client without a server account', () async {
    final options = <String, String>{};
    expect(await apply(defaults(), options), isTrue);
    expect(options['custom-rendezvous-server'], 'desk.example.com:21116');
    expect(options['relay-server'], 'desk.example.com:21117');
    expect(options['key'], publicKey);
    expect(options.containsKey('api-server'), isFalse);
  });

  test('does not replace an existing ID server', () async {
    final options = <String, String>{
      'custom-rendezvous-server': 'existing.example.org:21116',
      'key': 'previous-key',
    };
    expect(await apply(defaults(), options), isFalse);
    expect(options['custom-rendezvous-server'], 'existing.example.org:21116');
    expect(options['key'], 'previous-key');
  });

  test('does not change existing keys or account sessions', () async {
    final options = <String, String>{'key': 'existing'};
    expect(await apply(defaults(), options), isFalse);
    expect(options['key'], 'existing');

    final empty = <String, String>{};
    expect(await apply(defaults(), empty, accountToken: true), isFalse);
    expect(empty, isEmpty);
  });

  test('respects a locked or custom installation', () async {
    final locked = <String, String>{};
    expect(await apply(defaults(), locked, disabledSettings: true), isFalse);
    expect(locked, isEmpty);

    final custom = <String, String>{};
    expect(await apply(defaults(), custom, customClient: true), isFalse);
    expect(custom, isEmpty);
  });

  test('rejects public servers, malformed hosts and keys', () {
    expect(defaults(idServer: 'rs-ny.rustdesk.com:21116').isValid, isFalse);
    expect(defaults(idServer: 'https://desk.example.com').isValid, isFalse);
    expect(defaults(idServer: 'user@desk.example.com').isValid, isFalse);
    expect(defaults(idServer: 'desk.example.com/path').isValid, isFalse);
    expect(defaults(key: 'invalid').isValid, isFalse);
    expect(defaults().isValid, isTrue);
  });

  test('rolls back incomplete initial configuration', () async {
    final options = <String, String>{};
    final config = defaults();
    expect(
      () => config.apply(
        readOption: (name) async => options[name] ?? '',
        writeOption: (name, value) async {
          if (name == 'custom-rendezvous-server' && value.isNotEmpty) {
            throw StateError('simulated write failure');
          }
          options[name] = value;
        },
        hasAccountToken: false,
        settingsDisabled: false,
        isCustomClient: false,
      ),
      throwsA(isA<StateError>()),
    );
    expect(options['key'], '');
    expect(options['relay-server'], '');
    expect(options['custom-rendezvous-server'], isNull);
  });
}
