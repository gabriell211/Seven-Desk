import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/common/widgets/incoming_support_identity.dart';
import 'package:flutter_hbb/desktop/widgets/receiver_session_panel.dart';

void main() {
  const profile = IncomingSupportIdentity(
    technician: 'Maria Técnica',
    company: 'Empresa Modelo',
    avatarUrl: '',
  );

  Widget app({
    required bool compact,
    required ReceiverPanelView view,
    required VoidCallback onChat,
    required VoidCallback onFiles,
    required VoidCallback onScreen,
    required VoidCallback onDisconnect,
    required VoidCallback onMinimize,
    required VoidCallback onRestore,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 510, height: 540,
            child: ReceiverSessionPanel(
              identity: profile,
              peerId: '789123',
              minimized: compact,
              view: view,
              onMinimize: onMinimize,
              onRestore: onRestore,
              onChat: onChat,
              onTransfers: onFiles,
              onNextMonitor: onScreen,
              onControls: () {},
              onDisconnect: onDisconnect,
              details: const Text('Detalhes de sessão'),
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('shows connected profile and dispatches session actions', (tester) async {
    var chat=0, files=0, monitor=0, disconnect=0, minimize=0;
    await tester.pumpWidget(app(
      compact:false,
      view:ReceiverPanelView.none,
      onChat:()=>chat++,
      onFiles:()=>files++,
      onScreen:()=>monitor++,
      onDisconnect:()=>disconnect++,
      onMinimize:()=>minimize++,
      onRestore:(){},
    ));
    expect(find.text('Maria Técnica'), findsOneWidget);
    expect(find.text('Empresa Modelo'), findsOneWidget);
    expect(find.text('Conectado'), findsOneWidget);
    await tester.tap(find.byTooltip('Chat'));
    await tester.tap(find.byTooltip('Transferências'));
    await tester.tap(find.byTooltip('Trocar monitor'));
    await tester.tap(find.byTooltip('Desconectar sessão'));
    await tester.tap(find.byTooltip('Minimizar painel'));
    expect([chat,files,monitor,disconnect,minimize], [1,1,1,1,1]);
  });

  testWidgets('compact mode retains disconnect and restore', (tester) async {
    var restore=0,disconnect=0;
    await tester.pumpWidget(app(
      compact:true,
      view:ReceiverPanelView.none,
      onChat:(){},onFiles:(){},onScreen:(){},
      onDisconnect:()=>disconnect++,
      onMinimize:(){},
      onRestore:()=>restore++,
    ));
    expect(find.text('Conectado'),findsOneWidget);
    expect(find.text('Empresa Modelo'),findsNothing);
    await tester.tap(find.byTooltip('Restaurar painel'));
    await tester.tap(find.text('Desconectar'));
    expect(restore,1);
    expect(disconnect,1);
  });
}
