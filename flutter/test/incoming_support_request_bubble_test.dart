import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/common/widgets/incoming_support_identity.dart';
import 'package:flutter_hbb/common/widgets/incoming_support_request_bubble.dart';

void main() {
  const identity = IncomingSupportIdentity(
    technician: 'Ana Oliveira',
    company: 'Seven Suporte',
    avatarUrl: '',
  );

  Widget screen({
    VoidCallback? onAdmin,
    VoidCallback? onAccept,
    required VoidCallback onReject,
    String? disabledReason,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 300,
            child: IncomingSupportRequestBubble(
              identity: identity,
              requesterId: '123-456-789',
              onAccept: onAccept,
              onAcceptAsAdministrator: onAdmin,
              onReject: onReject,
              acceptanceDisabledReason: disabledReason,
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('receiver can identify technician, company and requester ID',
      (tester) async {
    await tester.pumpWidget(screen(onReject: () {}));
    expect(find.text('Solicitação de acesso remoto'), findsOneWidget);
    expect(find.text('Ana Oliveira'), findsOneWidget);
    expect(find.text('Seven Suporte'), findsOneWidget);
    expect(find.text('ID: 123-456-789'), findsOneWidget);
    expect(find.text('Aceitar como administrador'), findsOneWidget);
    expect(find.text('Aceitar'), findsOneWidget);
    expect(find.text('Recusar'), findsOneWidget);
  });

  testWidgets('three distinct actions dispatch only on explicit tap',
      (tester) async {
    var admins = 0;
    var accepted = 0;
    var rejected = 0;
    await tester.pumpWidget(screen(
      onAdmin: () => admins++,
      onAccept: () => accepted++,
      onReject: () => rejected++,
    ));
    expect([admins, accepted, rejected], [0, 0, 0]);

    await tester.tap(find.text('Aceitar como administrador'));
    await tester.pump();
    expect([admins, accepted, rejected], [1, 0, 0]);

    await tester.tap(find.text('Aceitar'));
    await tester.pump();
    expect([admins, accepted, rejected], [1, 1, 0]);

    await tester.tap(find.text('Recusar'));
    await tester.pump();
    expect([admins, accepted, rejected], [1, 1, 1]);
  });

  testWidgets('password-only or UAC-unavailable choices stay disabled',
      (tester) async {
    var rejected = 0;
    await tester.pumpWidget(screen(
      onReject: () => rejected++,
      disabledReason: 'Somente autenticação por senha.',
    ));
    expect(find.text('Aceitar como administrador'), findsOneWidget);
    expect(find.text('Aceitar'), findsOneWidget);
    // FilledButton.icon and FilledButton.tonal are different runtime classes;
    // find.byType(FilledButton) misses the icon variant.
    final buttons = tester.widgetList<FilledButton>(
      find.byWidgetPredicate((widget) => widget is FilledButton),
    ).toList();
    expect(buttons, hasLength(2));
    expect(buttons.every((button) => button.onPressed == null), isTrue);
    expect(find.text('Somente autenticação por senha.'), findsOneWidget);
    await tester.tap(find.text('Recusar'));
    expect(rejected, 1);
  });
}
