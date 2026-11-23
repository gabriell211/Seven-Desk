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

  test('receiver chat does not mark currently visible session unread', () {
    expect(
      shouldCountSevenDeskReceiverUnread(
        panelVisible: true,
        visibleClientId: 11,
        incomingClientId: 11,
      ),
      isFalse,
    );
  });

  test('minimized receiver chat still counts incoming messages', () {
    expect(
      shouldCountSevenDeskReceiverUnread(
        panelVisible: false,
        visibleClientId: 11,
        incomingClientId: 11,
      ),
      isTrue,
    );
  });

  test('messages for another receiver session remain unread', () {
    expect(
      shouldCountSevenDeskReceiverUnread(
        panelVisible: true,
        visibleClientId: 11,
        incomingClientId: 22,
      ),
      isTrue,
    );
    expect(
      shouldCountSevenDeskReceiverUnread(
        panelVisible: false,
        visibleClientId: null,
        incomingClientId: 22,
      ),
      isTrue,
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
