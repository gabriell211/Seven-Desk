import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/common/widgets/dialog.dart';

void main() {
  testWidgets('Seven Desk shows its own awaiting-approval dialog', (tester) async {
    var cancelled = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: SevenDeskSessionProgressCard(
            title: 'Aguardando o cliente',
            description: 'Solicitação enviada.',
            waitingForApproval: true,
            onCancel: () => cancelled++,
          ),
        ),
      ),
    ));

    expect(find.text('Seven Desk'), findsOneWidget);
    expect(find.text('Aguardando o cliente'), findsOneWidget);
    expect(find.text('O acesso depende da aprovação do cliente.'),
        findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('seven-progress-cancel')));
    expect(cancelled, 1);
  });

  testWidgets('Escape cancels the pending desktop request', (tester) async {
    var cancelled = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SevenDeskSessionProgressCard(
          title: 'Conectando ao cliente',
          description: 'Preparando a solicitação.',
          onCancel: () => cancelled++,
        ),
      ),
    ));
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    expect(cancelled, 1);
  });

  testWidgets('waiting for first image uses Seven Desk branding', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: SevenDeskSessionProgressCard(
          title: 'Cliente conectado',
          description: 'Preparando a transmissão da tela remota.',
          onCancel: _noop,
        ),
      ),
    ));
    expect(find.text('Cliente conectado'), findsOneWidget);
    expect(find.text('Preparando a transmissão da tela remota.'),
        findsOneWidget);
    expect(find.text('Estabelecendo uma conexão protegida.'), findsOneWidget);
  });
}

void _noop() {}
