import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/common.dart' show OverlayDialogManager, OverlayKeyState;
import 'package:uuid/uuid.dart';
import 'package:flutter_hbb/common/widgets/dialog.dart';
import 'package:flutter_hbb/models/model.dart'
    show isSevenDeskClientCancellationMessage,
        classifySevenDeskConnectionFailure;

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

  test('only an explicit client refusal uses the cancellation message', () {
    expect(isSevenDeskClientCancellationMessage(
        'error', 'Connection Error', 'Cancelled by the client'), isTrue);
    for (final message in [
      'Timeout',
      'Reset by the peer',
      'Closed manually by the peer',
      'Connection not allowed',
      'Failed to connect',
    ]) {
      expect(isSevenDeskClientCancellationMessage(
          'error', 'Connection Error', message), isFalse,
          reason: message);
    }
    expect(isSevenDeskClientCancellationMessage(
        'error', 'Other Error', 'Cancelled by the client'), isFalse);
    expect(isSevenDeskClientCancellationMessage(
        'success', 'Connection Error', 'Cancelled by the client'), isFalse);
    expect(isSevenDeskClientCancellationMessage(
        null, null, null), isFalse);
  });

  testWidgets('client refusal changes the current waiting card in place',
      (tester) async {
    final manager = OverlayDialogManager();
    final overlayKey = OverlayKeyState();
    manager.setOverlayState(overlayKey);
    final sessionId = const Uuid().v4obj();
    var closed = 0;

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Overlay(
          key: overlayKey.key,
          initialEntries: [
            OverlayEntry(builder: (_) => const SizedBox.shrink()),
          ],
        ),
      ),
    ));
    showWaitAcceptDialog(
      sessionId,
      'wait-remote-accept-nook',
      'Prompt',
      'Waiting for approval',
      manager,
    );
    await tester.pump();

    final waiting = find.byType(SevenDeskSessionProgressCard);
    expect(waiting, findsOneWidget);
    expect(find.text('Aguardando o cliente'), findsOneWidget);
    final originalElement = tester.element(waiting);

    showSevenDeskClientCancelledDialog(manager, sessionId, () => closed++);
    await tester.pump();

    expect(identical(tester.element(waiting), originalElement), isTrue);
    expect(find.text('Cancelado pelo cliente'), findsOneWidget);
    expect(find.text('Aguardando o cliente'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Fechar'), findsOneWidget);

    // A later socket reset cannot replace an explicit client refusal.
    showSevenDeskWaitingFailureDialog(
      manager, sessionId, SevenDeskWaitingFailure.network, () => closed++);
    await tester.pump();
    expect(find.text('Cancelado pelo cliente'), findsOneWidget);
    expect(find.text('Problema de rede'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('seven-progress-cancel')));
    await tester.pump();
    expect(closed, 1);
    expect(manager.existing('$sessionId-seven-desk-approval'), isFalse);
  });

  test('timeout and network errors have distinct classified outcomes', () {
    for (final value in [
      'Timeout',
      'Operation timed out',
      'deadline exceeded',
    ]) {
      expect(
        classifySevenDeskConnectionFailure(
          'error', 'Connection Error', value),
        SevenDeskWaitingFailure.timeout,
        reason: value,
      );
    }
    for (final value in [
      'Reset by the peer',
      'Failed to connect to sevendesk.tech:21116',
      'Connection refused',
      'No route to host',
      'Network is unreachable',
    ]) {
      expect(
        classifySevenDeskConnectionFailure(
          'error', 'Connection Error', value),
        SevenDeskWaitingFailure.network,
        reason: value,
      );
    }

    expect(
      classifySevenDeskConnectionFailure(
        'error', 'Connection Error', 'Cancelled by the client'),
      SevenDeskWaitingFailure.clientCancelled,
    );
    for (final value in [
      'Wrong Password',
      'Remote desktop is offline',
      'Connection not allowed',
      'Closed manually by the peer',
    ]) {
      expect(
        classifySevenDeskConnectionFailure(
          'error', 'Connection Error', value),
        isNull,
        reason: value,
      );
    }
    expect(
      classifySevenDeskConnectionFailure(
        'restarting-show', 'Connecting...', 'Timeout'),
      isNull,
    );
  });

  testWidgets('timeout changes the approval card in the same overlay',
      (tester) async {
    final manager = OverlayDialogManager();
    final overlayKey = OverlayKeyState();
    manager.setOverlayState(overlayKey);
    final sessionId = const Uuid().v4obj();
    var closed = 0;

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: Overlay(
        key: overlayKey.key,
        initialEntries: [
          OverlayEntry(builder: (_) => const SizedBox.shrink()),
        ],
      )),
    ));

    showWaitAcceptDialog(
      sessionId, 'wait-remote-accept-nook',
      'Prompt', 'Waiting for approval', manager);
    await tester.pump();
    final card = find.byType(SevenDeskSessionProgressCard);
    final before = tester.element(card);

    showSevenDeskWaitingFailureDialog(
      manager, sessionId, SevenDeskWaitingFailure.timeout,
      () => closed++);
    await tester.pump();

    expect(identical(tester.element(card), before), isTrue);
    expect(find.text('Tempo limite esgotado'), findsOneWidget);
    expect(find.text('Aguardando o cliente'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    // Out-of-order approval prompts must not resurrect the spinner.
    showWaitAcceptDialog(
      sessionId, 'wait-remote-accept-nook',
      'Prompt', 'Waiting for approval', manager);
    await tester.pump();
    expect(find.text('Tempo limite esgotado'), findsOneWidget);
    expect(find.text('Aguardando o cliente'), findsNothing);
    expect(find.byIcon(Icons.access_time_rounded), findsOneWidget);
    expect(find.text('Fechar'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('seven-progress-cancel')));
    await tester.pump();
    expect(closed, 1);
    expect(hasSevenDeskSessionProgress(manager, sessionId), isFalse);
  });

  testWidgets('network problem replaces the connecting state in place',
      (tester) async {
    final manager = OverlayDialogManager();
    final overlayKey = OverlayKeyState();
    manager.setOverlayState(overlayKey);
    final sessionId = const Uuid().v4obj();
    var closed = 0;

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: Overlay(
        key: overlayKey.key,
        initialEntries: [
          OverlayEntry(builder: (_) => const SizedBox.shrink()),
        ],
      )),
    ));

    // This also verifies the earlier "Conectando" phase, before any
    // client approval prompt has been sent.
    showSevenDeskConnectingDialog(manager, sessionId);
    await tester.pump();
    final card = find.byType(SevenDeskSessionProgressCard);
    final before = tester.element(card);
    expect(find.text('Conectando ao cliente'), findsOneWidget);

    showSevenDeskWaitingFailureDialog(
      manager, sessionId, SevenDeskWaitingFailure.network,
      () => closed++);
    await tester.pump();

    expect(identical(tester.element(card), before), isTrue);
    expect(find.text('Problema de rede'), findsOneWidget);
    expect(find.text('Conectando ao cliente'), findsNothing);
    expect(find.byIcon(Icons.wifi_off_rounded), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Fechar'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('seven-progress-cancel')));
    await tester.pump();
    expect(closed, 1);
  });

  testWidgets('client cancellation is not shown as a loading state',
      (tester) async {
    var closed = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SevenDeskSessionProgressCard(
          title: 'Cancelado pelo cliente',
          description: 'O cliente recusou ou cancelou a solicitação de suporte remoto.',
          cancelledByClient: true,
          onCancel: () => closed++,
        ),
      ),
    ));
    expect(find.text('Cancelado pelo cliente'), findsOneWidget);
    expect(find.text('Fechar'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.tap(find.byKey(const ValueKey('seven-progress-cancel')));
    expect(closed, 1);
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
