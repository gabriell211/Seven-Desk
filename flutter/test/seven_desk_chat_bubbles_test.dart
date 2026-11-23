import 'package:dash_chat_2/dash_chat_2.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/common/widgets/chat_page.dart';

void main() {
  test('messages written by this device are outgoing bubbles', () {
    final me = ChatUser(id: 'local-user');
    final msg = ChatMessage(
      text: 'Mensagem enviada',
      user: ChatUser(id: 'local-user'),
      createdAt: DateTime.now(),
    );

    expect(isOwnSevenDeskChatMessage(msg, me), isTrue);
  });

  test('remote messages are incoming bubbles even with nonempty ids', () {
    final me = ChatUser(id: 'local-user');
    final msg = ChatMessage(
      text: 'Mensagem recebida',
      user: ChatUser(id: 'remote-user'),
      createdAt: DateTime.now(),
    );

    expect(isOwnSevenDeskChatMessage(msg, me), isFalse);
  });
}
