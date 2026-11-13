import 'package:flutter/material.dart';
import 'package:flutter_hbb/common.dart';
import 'package:flutter_hbb/desktop/pages/connection_page.dart';
import 'package:flutter_hbb/desktop/widgets/home_dashboard.dart';
import 'package:flutter_hbb/desktop/widgets/tabbar_widget.dart';
import 'package:flutter_hbb/generated_bridge.dart';
import 'package:flutter_hbb/models/peer_model.dart';
import 'package:flutter_hbb/models/platform_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:provider/provider.dart';

class _DashboardBinding extends Fake implements RustdeskImpl {
  final options = <String, String>{};

  @override
  String translate(
          {required String name, required String locale, dynamic hint}) =>
      name;

  @override
  bool isOutgoingOnly({dynamic hint}) => false;

  @override
  bool isIncomingOnly({dynamic hint}) => false;

  @override
  bool isDisableAccount({dynamic hint}) => false;

  @override
  bool isDisableSettings({dynamic hint}) => false;

  @override
  bool isDisableAb({dynamic hint}) => false;

  @override
  bool isDisableGroupPanel({dynamic hint}) => false;

  @override
  String mainGetLocalOption({required String key, dynamic hint}) => '';

  @override
  String mainGetBuildinOption({required String key, dynamic hint}) => '';

  @override
  String mainGetOptionSync({required String key, dynamic hint}) => '';

  @override
  bool mainIsOptionFixed({required String key, dynamic hint}) => false;

  @override
  String getLocalFlutterOption({required String k, dynamic hint}) =>
      options[k] ?? '';

  @override
  Future<void> setLocalFlutterOption(
      {required String k, required String v, dynamic hint}) async {
    options[k] = v;
  }

  @override
  Future<String> mainGetLastRemoteId({dynamic hint}) async => '123456789';

  @override
  Future<String> mainGetConnectStatus({dynamic hint}) async =>
      '{"status_num":1,"video_conn_count":2}';

  @override
  Future<bool> mainIsUsingPublicServer({dynamic hint}) async => true;

  @override
  Future<void> mainLoadRecentPeers({dynamic hint}) async {}

  @override
  Future<void> mainLoadFavPeers({dynamic hint}) async {}

  @override
  Future<void> mainLoadLanPeers({dynamic hint}) async {}

  @override
  Future<void> queryOnlines({required List<String> ids, dynamic hint}) async {}
}

void main() {
  testWidgets('opens the dashboard at desktop and compact window sizes',
      (tester) async {
    final binding = _DashboardBinding();
    platformFFI.setBindingForTesting(binding);
    isTest = true;
    await initGlobalFFI();
    Get.put(DesktopTabController(tabType: DesktopTabType.main));
    Get.put<RxBool>(false.obs, tag: 'stop-service');
    addTearDown(() {
      Get.reset();
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      isTest = false;
    });

    gFFI.recentPeersModel.peers = [
      Peer.fromJson({
        'id': '123456789',
        'alias': 'Support PC',
        'platform': 'Windows',
      })
        ..online = true,
    ];
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1160, 740);
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: gFFI.peerTabModel,
        child: MaterialApp(
          home: Scaffold(
            body: ConnectionPage(
              dashboardBuilder:
                  (section, onSection, connection, peers, status) =>
                      HomeDashboard(
                section: section,
                onSection: onSection,
                credentials: const Text('Local credentials'),
                notices: null,
                connection: connection,
                peers: peers,
                status: status,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump();
    expect(
        find.text('Welcome to Seven Desk', findRichText: true), findsOneWidget);
    expect(find.text('123 456 789'), findsOneWidget);
    expect(find.text('Ready for connections'), findsWidgets);
    expect(find.text('Support PC'), findsOneWidget);
    expect(find.text('Recent sessions (1)'), findsOneWidget);
    expect(tester.takeException(), isNull);

    tester.view.physicalSize = const Size(800, 600);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('Transfer file').first);
    await tester.pump();
    expect(
        find.widgetWithText(ElevatedButton, 'Transfer file'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 25));
  });
}
