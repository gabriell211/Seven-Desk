import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/models/chat_model.dart';

void main() {
  test('native remote sessions keep chat within the Seven Desk bubble', () {
    expect(
      useInlineSevenDeskRemoteChat(
        desktop: true,
        web: false,
        connectionManager: false,
      ),
      isTrue,
    );
  });

  test('receiver connection manager keeps its own session chat', () {
    expect(
      useInlineSevenDeskRemoteChat(
        desktop: true,
        web: false,
        connectionManager: true,
      ),
      isFalse,
    );
  });

  test('web and mobile retain their existing chat routing', () {
    for (final desktop in [true, false]) {
      expect(
        useInlineSevenDeskRemoteChat(
          desktop: desktop,
          web: true,
          connectionManager: false,
        ),
        isFalse,
      );
    }
    expect(
      useInlineSevenDeskRemoteChat(
        desktop: false,
        web: false,
        connectionManager: false,
      ),
      isFalse,
    );
  });
}
