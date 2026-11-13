import 'package:flutter/material.dart';
import 'package:flutter_hbb/common.dart';
import 'package:flutter_hbb/desktop/pages/desktop_setting_page.dart';
import 'package:flutter_hbb/desktop/widgets/session_toolbar_avatar.dart';
import 'package:flutter_hbb/desktop/widgets/tabbar_widget.dart';
import 'package:flutter_hbb/models/peer_tab_model.dart';
import 'package:flutter_hbb/models/platform_model.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_hbb/models/state_model.dart';
import 'package:get/get.dart';

bool get useHomeDashboard =>
    isDesktop && !bind.isIncomingOnly() && !bind.isCustomClient();

class HomeDashboardTheme extends InheritedWidget {
  const HomeDashboardTheme({super.key, required super.child});

  static bool of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<HomeDashboardTheme>() != null;

  static const background = Color(0xFF0C0A19);
  static const surface = Color(0xFF171326);
  static const border = Color(0xFF403752);
  static const muted = Color(0xFFC3BDD4);
  static const purple = Color(0xFFBA64FD);
  static const green = Color(0xFF23E693);
  static const accent = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF922CFA), Color(0xFF5623B9)],
  );
  static const panel = BoxDecoration(
    borderRadius: BorderRadius.all(Radius.circular(17)),
    border: Border.fromBorderSide(BorderSide(color: border)),
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF241B38), Color(0xFF12101F)],
    ),
  );

  @override
  bool updateShouldNotify(HomeDashboardTheme oldWidget) => false;
}

enum HomeDashboardSection {
  home('Home', Icons.home_outlined),
  computers('Computers', Icons.desktop_windows_outlined, PeerTabIndex.lan),
  contacts('Contacts', Icons.people_outline, PeerTabIndex.ab),
  groups('Groups', Icons.layers_outlined, PeerTabIndex.group),
  transfer('Transfer file', Icons.swap_horiz_rounded),
  sessions('Sessions', Icons.history_rounded, PeerTabIndex.recent),
  settings('Settings', Icons.settings_outlined);

  const HomeDashboardSection(this.label, this.icon, [this.peerTab]);

  final String label;
  final IconData icon;
  final PeerTabIndex? peerTab;
}

class HomeDashboard extends StatelessWidget {
  const HomeDashboard({
    super.key,
    required this.section,
    required this.onSection,
    required this.credentials,
    required this.notices,
    required this.connection,
    required this.peers,
    required this.status,
  });

  final HomeDashboardSection section;
  final ValueChanged<HomeDashboardSection> onSection;
  final Widget? credentials;
  final Widget? notices;
  final Widget connection;
  final Widget peers;
  final Widget? status;

  @override
  Widget build(BuildContext context) {
    final dark = MyTheme.darkTheme;
    return HomeDashboardTheme(
      child: Theme(
        data: dark.copyWith(
          colorScheme: dark.colorScheme.copyWith(
            primary: HomeDashboardTheme.purple,
            surface: HomeDashboardTheme.surface,
          ),
          scaffoldBackgroundColor: HomeDashboardTheme.background,
          dividerColor: HomeDashboardTheme.border,
          hintColor: HomeDashboardTheme.muted,
        ),
        child: Material(
          color: HomeDashboardTheme.background,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 1040;
              final inset = wide ? 30.0 : 16.0;
              final showProfileName = constraints.maxWidth >= 520;
              return Row(
                children: [
                  _sidebar(context, wide),
                  Expanded(
                    child: Column(
                      children: [
                        Obx(() => stateGlobal.showTabBar.isTrue
                            ? _header(context, showProfileName)
                            : const SizedBox.shrink()),
                        Expanded(
                          child: DecoratedBox(
                            decoration: const BoxDecoration(
                              gradient: RadialGradient(
                                center: Alignment(0, -1),
                                radius: 1.15,
                                colors: [
                                  Color(0xFF1D1332),
                                  HomeDashboardTheme.background,
                                ],
                              ),
                            ),
                            child: LayoutBuilder(
                              builder: (context, body) => SingleChildScrollView(
                                padding: EdgeInsets.fromLTRB(
                                    inset, wide ? 32 : 16, inset, 12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    _welcome(wide),
                                    if (credentials != null) ...[
                                      const SizedBox(height: 25),
                                      credentials!,
                                    ],
                                    if (notices != null) notices!,
                                    const SizedBox(height: 22),
                                    connection,
                                    const SizedBox(height: 26),
                                    SizedBox(
                                      height: (body.maxHeight - 410)
                                          .clamp(224.0, double.infinity)
                                          .toDouble(),
                                      child: peers,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (status != null)
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: inset),
                            decoration: const BoxDecoration(
                              color: HomeDashboardTheme.surface,
                              border: Border(
                                top: BorderSide(
                                    color: HomeDashboardTheme.border),
                              ),
                            ),
                            child: SizedBox(height: 68, child: Center(child: status)),
                          ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _sidebar(BuildContext context, bool wide) {
    final peers = context.watch<PeerTabModel>();
    return Container(
      width: wide ? 312 : 64,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF100E1B), Color(0xFF1F0E36)],
        ),
        border: Border(right: BorderSide(color: HomeDashboardTheme.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 110,
            child: Padding(
              padding: EdgeInsets.only(
                  left: wide ? 16 : 10,
                  right: wide ? 12 : 10,
                  top: isMacOS && !kUseCompatibleUiMode ? 16 : 0),
              child: Row(
                mainAxisAlignment:
                    wide ? MainAxisAlignment.start : MainAxisAlignment.center,
                children: [
                  HomeDashboardLogo(size: wide ? 65 : 38),
                  if (wide) ...[
                    const SizedBox(width: 12),
                    Flexible(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Seven Desk',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  height: 1.12,
                                  fontSize: 27,
                                  fontWeight: FontWeight.w700)),
                          const SizedBox(height: 3),
                          Text('Acesso Remoto Seguro',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  height: 1.15,
                                  color: HomeDashboardTheme.muted,
                                  fontSize: 14)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView(
              primary: false,
              padding: EdgeInsets.fromLTRB(wide ? 18 : 8, 22, wide ? 18 : 8, 8),
              children: [
                for (final item in HomeDashboardSection.values)
                  if (_showSection(item, peers)) _navigationItem(item, wide),
              ],
            ),
          ),
          if (status != null &&
              !bind.isDisableSettings() &&
              DesktopSettingPage.tabKeys.contains(SettingsTabKey.safety))
            Padding(
              padding: EdgeInsets.fromLTRB(wide ? 36 : 8, 4, wide ? 30 : 8, 14),
              child: Tooltip(
                message: 'Configurações de segurança',
                child: OutlinedButton(
                  onPressed: () =>
                      DesktopSettingPage.switch2page(SettingsTabKey.safety),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: HomeDashboardTheme.green,
                    side: const BorderSide(color: HomeDashboardTheme.border),
                    backgroundColor: const Color(0xFF231638),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    minimumSize: const Size(0, 68),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.verified_user_outlined, size: 29),
                      if (wide) ...[
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Conexão Segura',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600)),
                              Text('TLS + Criptografia',
                                  style: TextStyle(
                                      color: HomeDashboardTheme.muted,
                                      fontSize: 12)),
                            ],
                          ),
                        ),
                        Obx(() => Icon(Icons.circle,
                            size: 10,
                            color: stateGlobal.svcStatus.value ==
                                        SvcStatus.ready &&
                                    !Get.find<RxBool>(
                                            tag: 'stop-service')
                                        .value
                                ? HomeDashboardTheme.green
                                : HomeDashboardTheme.muted)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          if (wide)
            const SizedBox(
              height: 78,
              child: CustomPaint(painter: _SidebarRibbon()),
            ),
        ],
      ),
    );
  }

  bool _showSection(HomeDashboardSection item, PeerTabModel peers) {
    if (item == HomeDashboardSection.settings) {
      return !bind.isDisableSettings();
    }
    final tab = item.peerTab;
    return tab == null || peers.visibleEnabledOrderedIndexs.contains(tab.index);
  }

  Widget _navigationItem(HomeDashboardSection item, bool wide) {
    final selected = item == section;
    final label = switch (item) {
      HomeDashboardSection.home => 'Início',
      HomeDashboardSection.computers => 'Computadores',
      HomeDashboardSection.contacts => 'Contatos',
      HomeDashboardSection.groups => 'Grupos',
      HomeDashboardSection.transfer => 'Transferência',
      HomeDashboardSection.sessions => 'Logs & Sessões',
      HomeDashboardSection.settings => 'Configurações',
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Semantics(
        selected: selected,
        button: true,
        child: Tooltip(
          message: label,
          child: Material(
            borderRadius: BorderRadius.circular(13),
            color: Colors.transparent,
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                gradient: selected ? HomeDashboardTheme.accent : null,
                border: selected
                    ? Border.all(color: HomeDashboardTheme.purple)
                    : null,
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(13),
                onTap: () => onSection(item),
                child: SizedBox(
                  height: 62,
                  child: Row(
                    mainAxisAlignment: wide
                        ? MainAxisAlignment.start
                        : MainAxisAlignment.center,
                    children: [
                      if (wide) const SizedBox(width: 25),
                      Icon(item.icon, size: 26, color: Colors.white),
                      if (wide) ...[
                        const SizedBox(width: 19),
                        Expanded(
                          child: Text(label,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 17)),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context, bool showProfileName) {
    final tabs = Get.find<DesktopTabController>();
    final user = gFFI.userModel;
    final localPhoto = sessionToolbarPhoto;
    return Container(
      height: 90,
      decoration: const BoxDecoration(
        color: HomeDashboardTheme.surface,
        border: Border(bottom: BorderSide(color: HomeDashboardTheme.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onPanStart:
                  kUseCompatibleUiMode ? null : (_) => startDragging(true),
              onPanEnd: isMacOS ? (_) => setMovable(true, false) : null,
              onPanCancel: isMacOS ? () => setMovable(true, false) : null,
              onDoubleTap: kUseCompatibleUiMode
                  ? null
                  : () async =>
                      stateGlobal.setMaximized(await toggleMaximize(true)),
            ),
          ),
          if (status != null && showProfileName)
            Obx(() {
              final active = stateGlobal.videoConnCount.value;
              return IconButton(
                tooltip: translate('Status'),
                icon: Badge(
                  isLabelVisible: active > 0,
                  label: Text('$active'),
                  child: const Icon(Icons.notifications_none_rounded),
                ),
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: Text(translate('Status')),
                    content: Obx(() => Text(translate('{} video sessions')
                        .replaceAll('{}',
                            stateGlobal.videoConnCount.value.toString()))),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: Text(translate('Close')),
                      ),
                    ],
                  ),
                ),
              );
            }),
          if (showProfileName)
            IconButton(
              tooltip: translate('Help'),
              onPressed: () => launchUrl(
                Uri.parse('https://seven-desk-site.vercel.app/#perguntas'),
                mode: LaunchMode.externalApplication,
              ),
              icon: const Icon(Icons.help_outline_rounded),
            ),
          const SizedBox(width: 4),
          Obx(() {
            final name = user.displayNameOrUserName;
            final avatarUrl = user.avatar.value;
            final photo = localPhoto.isNotEmpty || avatarUrl.isEmpty
                ? null
                : buildAvatarWidget(
                    avatar: bind.mainResolveAvatarUrl(avatar: avatarUrl),
                    size: 44,
                  );
            final pages = DesktopSettingPage.tabKeys;
            return PopupMenuButton<SettingsTabKey>(
              tooltip: translate('Settings'),
              enabled: !bind.isDisableSettings() &&
                  (pages.contains(SettingsTabKey.general) ||
                      pages.contains(SettingsTabKey.account)),
              onSelected: DesktopSettingPage.switch2page,
              itemBuilder: (context) => [
                if (pages.contains(SettingsTabKey.general))
                  PopupMenuItem(
                    value: SettingsTabKey.general,
                    child: Text(translate(sessionToolbarPhotoLabel)),
                  ),
                if (pages.contains(SettingsTabKey.account))
                  PopupMenuItem(
                    value: SettingsTabKey.account,
                    child: Text(translate('Account')),
                  ),
              ],
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    Stack(
                      children: [
                        photo ??
                            SessionToolbarAvatar(photo: localPhoto, size: 44),
                        if (status != null)
                          Obx(() => stateGlobal.svcStatus.value ==
                                      SvcStatus.ready &&
                                  !Get.find<RxBool>(tag: 'stop-service').value
                              ? const Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Icon(Icons.circle,
                                      color: HomeDashboardTheme.green, size: 9),
                                )
                              : const SizedBox.shrink()),
                      ],
                    ),
                    if (showProfileName) ...[
                      const SizedBox(width: 12),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 150),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name.isEmpty ? 'Computador local' : name,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 17,
                                    fontWeight: FontWeight.w600)),
                            const Text('Suporte',
                                style: TextStyle(
                                    color: HomeDashboardTheme.muted,
                                    fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                    const Icon(Icons.expand_more_rounded, size: 16),
                  ],
                ),
              ),
            );
          }),
          if (!isMacOS && !kUseCompatibleUiMode) ...[
            const SizedBox(width: 7),
            const SizedBox(height: 32, child: VerticalDivider(width: 1)),
            const SizedBox(width: 7),
            WindowActionPanel(
              isMainWindow: true,
              state: tabs.state,
              tabController: tabs,
              invisibleTabKeys: <String>[].obs,
            ),
          ],
          const SizedBox(width: 5),
        ],
      ),
    );
  }

  Widget _welcome(bool wide) {
    final title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            children: [
              const TextSpan(text: 'Bem-vindo ao '),
              const TextSpan(
                text: 'Seven Desk',
                style: TextStyle(color: HomeDashboardTheme.purple),
              ),
            ],
          ),
          style: const TextStyle(fontSize: 35, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'Acesse e gerencie seus computadores de forma rápida, segura e estável.',
          style: const TextStyle(color: HomeDashboardTheme.muted, fontSize: 18),
        ),
      ],
    );
    if (!wide || status == null) return title;
    final stopped = Get.find<RxBool>(tag: 'stop-service');
    return Row(
      children: [
        Expanded(child: title),
        Obx(() {
          if (stateGlobal.svcStatus.value != SvcStatus.ready || stopped.value) {
            return const SizedBox.shrink();
          }
          return Container(
            margin: const EdgeInsets.only(left: 10),
            padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F2726),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: const Color(0xFF205445)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.circle, size: 11, color: HomeDashboardTheme.green),
                SizedBox(width: 10),
                Text('Pronto para conexões',
                    style: TextStyle(color: Color(0xFFB3F4D1), fontSize: 14)),
              ],
            ),
          );
        }),
      ],
    );
  }
}

class HomeDashboardLogo extends StatelessWidget {
  const HomeDashboardLogo({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(
        dimension: size,
        child: const CustomPaint(painter: _SevenDeskMark()),
      );
}

class _SevenDeskMark extends CustomPainter {
  const _SevenDeskMark();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 64, size.height / 64);
    final paint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [Color(0xFFC575FF), Color(0xFF6D2BEC)],
      ).createShader(const Rect.fromLTWH(4, 2, 54, 60));
    final mark = Path()
      ..moveTo(61, 11)
      ..cubicTo(49, -3, 23, 5, 9, 26)
      ..cubicTo(-5, 45, 11, 47, 32, 37)
      ..cubicTo(45, 30, 54, 28, 53, 35)
      ..cubicTo(45, 45, 24, 60, 6, 55)
      ..cubicTo(19, 69, 47, 56, 56, 39)
      ..cubicTo(65, 23, 52, 20, 32, 29)
      ..cubicTo(23, 33, 14, 37, 13, 34)
      ..cubicTo(24, 21, 45, 7, 61, 11)
      ..close();
    canvas.drawPath(mark, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SevenDeskMark oldDelegate) => false;
}

class _SidebarRibbon extends CustomPainter {
  const _SidebarRibbon();

  @override
  void paint(Canvas canvas, Size size) {
    final ribbon = Path()
      ..moveTo(0, 0)
      ..cubicTo(size.width * .45, 0, size.width * .65, size.height, size.width,
          size.height * .6)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      ribbon,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xFF6A2CDD), Color(0xFF1C1033)],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_SidebarRibbon oldDelegate) => false;
}
