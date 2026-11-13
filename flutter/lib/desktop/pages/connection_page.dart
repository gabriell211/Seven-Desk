// main window right pane

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_hbb/common/widgets/connection_page_title.dart';
import 'package:flutter_hbb/consts.dart';
import 'package:flutter_hbb/desktop/pages/desktop_setting_page.dart';
import 'package:flutter_hbb/desktop/widgets/home_dashboard.dart';
import 'package:flutter_hbb/desktop/widgets/popup_menu.dart';
import 'package:flutter_hbb/models/state_model.dart';
import 'package:get/get.dart';
import 'package:window_manager/window_manager.dart';
import 'package:flutter_hbb/models/peer_model.dart';
import 'package:flutter_hbb/models/peer_tab_model.dart';

import '../../common.dart';
import '../../common/formatter/id_formatter.dart';
import '../../common/widgets/peer_tab_page.dart';
import '../../common/widgets/autocomplete.dart';
import '../../models/platform_model.dart';
import '../../desktop/widgets/material_mod_popup_menu.dart' as mod_menu;

class OnlineStatusWidget extends StatefulWidget {
  const OnlineStatusWidget(
      {Key? key, this.onSvcStatusChanged, this.dashboard = false})
      : super(key: key);

  final VoidCallback? onSvcStatusChanged;
  final bool dashboard;

  @override
  State<OnlineStatusWidget> createState() => _OnlineStatusWidgetState();
}

/// State for the connection page.
class _OnlineStatusWidgetState extends State<OnlineStatusWidget> {
  final _svcStopped = Get.find<RxBool>(tag: 'stop-service');
  Timer? _updateTimer;

  double get em => 14.0;
  double? get height => bind.isIncomingOnly() ? null : em * 3;

  @override
  void initState() {
    super.initState();
    _updateTimer = periodic_immediate(Duration(seconds: 1), () async {
      updateStatus();
    });
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.dashboard) {
      return SizedBox(
        height: 43,
        child: Obx(() {
          final stopped = _svcStopped.value;
          final status = stateGlobal.svcStatus.value;
          final ready = !stopped && status == SvcStatus.ready;
          final sessions = stateGlobal.videoConnCount.value;
          return Row(
            children: [
              Icon(Icons.circle,
                  size: 10,
                  color: ready
                      ? HomeDashboardTheme.green
                      : stopped || status == SvcStatus.connecting
                          ? kColorWarn
                          : const Color(0xFFF07888)),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  ready ? translate('Ready for connections') : _statusMessage,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (stopped)
                TextButton(
                  onPressed: () => start_service(true),
                  child: Text(translate('Start service')),
                )
              else if (sessions > 0)
                Text(
                  translate('{} video sessions')
                      .replaceAll('{}', sessions.toString()),
                  style: const TextStyle(color: HomeDashboardTheme.muted),
                ),
            ],
          );
        }),
      );
    }
    final isIncomingOnly = bind.isIncomingOnly();
    startServiceWidget() => Offstage(
          offstage: !_svcStopped.value,
          child: InkWell(
                  onTap: () async {
                    await start_service(true);
                  },
                  child: Text(translate("Start service"),
                      style: TextStyle(
                          decoration: TextDecoration.underline, fontSize: em)))
              .marginOnly(left: em),
        );

    basicWidget() => Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              height: 8,
              width: 8,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                color: _svcStopped.value ||
                        stateGlobal.svcStatus.value == SvcStatus.connecting
                    ? kColorWarn
                    : (stateGlobal.svcStatus.value == SvcStatus.ready
                        ? Color.fromARGB(255, 50, 190, 166)
                        : Color.fromARGB(255, 224, 79, 95)),
              ),
            ).marginSymmetric(horizontal: em),
            Container(
              width: isIncomingOnly ? 226 : null,
              child: _buildConnStatusMsg(),
            ),
            // stop
            if (!isIncomingOnly) startServiceWidget(),
          ],
        );

    return Container(
      height: height,
      child: Obx(() => isIncomingOnly
          ? Column(
              children: [
                basicWidget(),
                Align(
                        child: startServiceWidget(),
                        alignment: Alignment.centerLeft)
                    .marginOnly(top: 2.0, left: 22.0),
              ],
            )
          : basicWidget()),
    ).paddingOnly(right: isIncomingOnly ? 8 : 0);
  }

  String get _statusMessage => _svcStopped.value
      ? translate('Service is not running')
      : stateGlobal.svcStatus.value == SvcStatus.connecting
          ? translate('connecting_status')
          : stateGlobal.svcStatus.value == SvcStatus.notReady
              ? translate('not_ready_status')
              : translate('Ready');

  _buildConnStatusMsg() {
    widget.onSvcStatusChanged?.call();
    return Text(_statusMessage, style: TextStyle(fontSize: em));
  }

  updateStatus() async {
    final status =
        jsonDecode(await bind.mainGetConnectStatus()) as Map<String, dynamic>;
    final statusNum = status['status_num'] as int;
    if (statusNum == 0) {
      stateGlobal.svcStatus.value = SvcStatus.connecting;
    } else if (statusNum == -1) {
      stateGlobal.svcStatus.value = SvcStatus.notReady;
    } else if (statusNum == 1) {
      stateGlobal.svcStatus.value = SvcStatus.ready;
    } else {
      stateGlobal.svcStatus.value = SvcStatus.notReady;
    }
    try {
      stateGlobal.videoConnCount.value = status['video_conn_count'] as int;
    } catch (_) {}
  }
}

typedef ConnectionDashboardBuilder = Widget Function(
  HomeDashboardSection section,
  ValueChanged<HomeDashboardSection> onSection,
  Widget connection,
  Widget peers,
  Widget? status,
);

/// Connection page for connecting to a remote peer.
class ConnectionPage extends StatefulWidget {
  const ConnectionPage({Key? key, this.dashboardBuilder}) : super(key: key);

  final ConnectionDashboardBuilder? dashboardBuilder;

  @override
  State<ConnectionPage> createState() => _ConnectionPageState();
}

/// State for the connection page.
class _ConnectionPageState extends State<ConnectionPage>
    with SingleTickerProviderStateMixin, WindowListener {
  /// Controller for the id input bar.
  final _idController = IDTextEditingController();

  final RxBool _idInputFocused = false.obs;
  final FocusNode _idFocusNode = FocusNode();
  final TextEditingController _idEditingController = TextEditingController();

  final _peerTabs = GlobalKey<PeerTabPageState>();
  HomeDashboardSection _section = HomeDashboardSection.home;

  bool isWindowMinimized = false;

  final AllPeersLoader _allPeersLoader = AllPeersLoader();

  // https://github.com/flutter/flutter/issues/157244
  Iterable<Peer> _autocompleteOpts = [];

  final _menuOpen = false.obs;

  @override
  void initState() {
    super.initState();
    _allPeersLoader.init(setState);
    if (widget.dashboardBuilder != null) {
      final visibleTabs = gFFI.peerTabModel.visibleEnabledOrderedIndexs;
      final current = gFFI.peerTabModel.currentTab;
      if (current != PeerTabIndex.recent.index &&
          visibleTabs.contains(PeerTabIndex.recent.index)) {
        bind.mainLoadRecentPeers();
      }
      if (current != PeerTabIndex.fav.index &&
          visibleTabs.contains(PeerTabIndex.fav.index)) {
        bind.mainLoadFavPeers();
      }
      if (current != PeerTabIndex.lan.index &&
          visibleTabs.contains(PeerTabIndex.lan.index)) {
        bind.mainLoadLanPeers();
      }
    }
    _idFocusNode.addListener(onFocusChanged);
    if (_idController.text.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        final lastRemoteId = await bind.mainGetLastRemoteId();
        if (mounted && lastRemoteId != _idController.id) {
          setState(() {
            _idController.id = lastRemoteId;
          });
        }
      });
    }
    Get.put<TextEditingController>(_idEditingController);
    Get.put<IDTextEditingController>(_idController);
    windowManager.addListener(this);
  }

  @override
  void dispose() {
    _idController.dispose();
    windowManager.removeListener(this);
    _allPeersLoader.clear();
    _idFocusNode.removeListener(onFocusChanged);
    _idFocusNode.dispose();
    _idEditingController.dispose();
    if (Get.isRegistered<IDTextEditingController>()) {
      Get.delete<IDTextEditingController>();
    }
    if (Get.isRegistered<TextEditingController>()) {
      Get.delete<TextEditingController>();
    }
    super.dispose();
  }

  @override
  void onWindowEvent(String eventName) {
    super.onWindowEvent(eventName);
    if (eventName == 'minimize') {
      isWindowMinimized = true;
    } else if (eventName == 'maximize' || eventName == 'restore') {
      if (isWindowMinimized && isWindows) {
        // windows can't update when minimized.
        Get.forceAppUpdate();
      }
      isWindowMinimized = false;
    }
  }

  @override
  void onWindowEnterFullScreen() {
    // Remove edge border by setting the value to zero.
    stateGlobal.resizeEdgeSize.value = 0;
  }

  @override
  void onWindowLeaveFullScreen() {
    // Restore edge border to default edge size.
    stateGlobal.resizeEdgeSize.value = stateGlobal.isMaximized.isTrue
        ? kMaximizeEdgeSize
        : windowResizeEdgeSize;
  }

  @override
  void onWindowClose() {
    super.onWindowClose();
    bind.mainOnMainWindowClose();
  }

  void onFocusChanged() {
    _idInputFocused.value = _idFocusNode.hasFocus;
    if (_idFocusNode.hasFocus) {
      if (_allPeersLoader.needLoad) {
        _allPeersLoader.getAllPeers();
      }

      final textLength = _idEditingController.value.text.length;
      // Select all to facilitate removing text, just following the behavior of address input of chrome.
      _idEditingController.selection =
          TextSelection(baseOffset: 0, extentOffset: textLength);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOutgoingOnly = bind.isOutgoingOnly();
    final dashboardBuilder = widget.dashboardBuilder;
    if (dashboardBuilder != null) {
      return dashboardBuilder(
        _section,
        _selectSection,
        Builder(builder: (context) => _buildRemoteIDTextField(context)),
        PeerTabPage(key: _peerTabs, onTabSelected: _onPeerTabSelected),
        isOutgoingOnly ? null : const OnlineStatusWidget(dashboard: true),
      );
    }
    return Column(
      children: [
        Expanded(
            child: Column(
          children: [
            Row(
              children: [
                Flexible(child: _buildRemoteIDTextField(context)),
              ],
            ).marginOnly(top: 22),
            SizedBox(height: 12),
            Divider().paddingOnly(right: 12),
            Expanded(child: PeerTabPage()),
          ],
        ).paddingOnly(left: 12.0)),
        if (!isOutgoingOnly) const Divider(height: 1),
        if (!isOutgoingOnly) OnlineStatusWidget()
      ],
    );
  }

  void _selectSection(HomeDashboardSection section) {
    if (section == HomeDashboardSection.settings) {
      DesktopSettingPage.switch2page(DesktopSettingPage.tabKeys.first);
      return;
    }
    final tab = section.peerTab;
    if (tab != null && _peerTabs.currentState?.selectTab(tab.index) != true) {
      return;
    }
    setState(() => _section = section);
    if (section == HomeDashboardSection.transfer) {
      _idFocusNode.requestFocus();
      final input = _idFocusNode.context;
      if (input != null) Scrollable.ensureVisible(input);
    }
  }

  void _onPeerTabSelected(int index) {
    if (_section.peerTab != null && _section.peerTab!.index != index) {
      setState(() => _section = HomeDashboardSection.home);
    }
  }

  void _submitRemoteId() =>
      onConnect(isFileTransfer: _section == HomeDashboardSection.transfer);

  /// Callback for the connect button.
  /// Connects to the selected peer.
  void onConnect(
      {bool isFileTransfer = false,
      bool isViewCamera = false,
      bool isTerminal = false,
      bool isTcpTunneling = false}) {
    var id = _idController.id;
    connect(context, id,
        isFileTransfer: isFileTransfer,
        isViewCamera: isViewCamera,
        isTerminal: isTerminal,
        isTcpTunneling: isTcpTunneling);
  }

  MenuEntrySubMenu<String> _requestApprovalMenu(BuildContext context) {
    MenuEntryButton<String> action(String title,
            {bool isFileTransfer = false,
            bool isViewCamera = false,
            bool isTerminal = false,
            bool isTcpTunneling = false}) =>
        MenuEntryButton<String>(
          childBuilder: (style) => Text(translate(title), style: style),
          proc: () => connect(context, _idController.id,
              loginMethod: 'request-approval',
              isFileTransfer: isFileTransfer,
              isViewCamera: isViewCamera,
              isTerminal: isTerminal,
              isTcpTunneling: isTcpTunneling),
          padding: EdgeInsets.symmetric(horizontal: kDesktopMenuPadding.left),
          dismissOnClicked: true,
        );

    return MenuEntrySubMenu<String>(
      text: translate('Request approval'),
      dismissParentOnCanceled: true,
      padding: EdgeInsets.symmetric(horizontal: kDesktopMenuPadding.left),
      arrowScale: MenuConfig.iconScale,
      entries: [
        action('Connect'),
        action('Transfer file', isFileTransfer: true),
        action('View camera', isViewCamera: true),
        action('${translate('Terminal')} (beta)', isTerminal: true),
        if (isDesktop) action('TCP tunneling', isTcpTunneling: true),
      ],
    );
  }

  /// UI for the remote ID TextField.
  /// Search for a peer.
  Widget _buildRemoteIDTextField(BuildContext context) {
    final dashboard = HomeDashboardTheme.of(context);
    final input = RawAutocomplete<Peer>(
      optionsBuilder: (TextEditingValue textEditingValue) {
        if (textEditingValue.text == '') {
          _autocompleteOpts = const Iterable<Peer>.empty();
        } else if (_allPeersLoader.peers.isEmpty &&
            !_allPeersLoader.isPeersLoaded) {
          Peer emptyPeer = Peer(
            id: '',
            username: '',
            hostname: '',
            alias: '',
            platform: '',
            tags: [],
            hash: '',
            password: '',
            forceAlwaysRelay: false,
            rdpPort: '',
            rdpUsername: '',
            loginName: '',
            device_group_name: '',
            note: '',
          );
          _autocompleteOpts = [emptyPeer];
        } else {
          String textWithoutSpaces = textEditingValue.text.replaceAll(" ", "");
          if (int.tryParse(textWithoutSpaces) != null) {
            textEditingValue = TextEditingValue(
              text: textWithoutSpaces,
              selection: textEditingValue.selection,
            );
          }
          String textToFind = textEditingValue.text.toLowerCase();
          _autocompleteOpts = _allPeersLoader.peers
              .where((peer) =>
                  peer.id.toLowerCase().contains(textToFind) ||
                  peer.username.toLowerCase().contains(textToFind) ||
                  peer.hostname.toLowerCase().contains(textToFind) ||
                  peer.alias.toLowerCase().contains(textToFind))
              .toList();
          _allPeersLoader.queryOnlines(_autocompleteOpts);
        }
        return _autocompleteOpts;
      },
      focusNode: _idFocusNode,
      textEditingController: _idEditingController,
      fieldViewBuilder: (
        BuildContext context,
        TextEditingController fieldTextEditingController,
        FocusNode fieldFocusNode,
        VoidCallback onFieldSubmitted,
      ) {
        updateTextAndPreserveSelection(
            fieldTextEditingController, _idController.text);
        return Obx(() => TextField(
              autocorrect: false,
              enableSuggestions: false,
              keyboardType: TextInputType.visiblePassword,
              focusNode: fieldFocusNode,
              style: TextStyle(
                fontFamily: 'WorkSans',
                fontSize: dashboard ? 17 : 22,
                height: 1.4,
              ),
              maxLines: 1,
              cursorColor: Theme.of(context).textTheme.titleLarge?.color,
              decoration: InputDecoration(
                  filled: false,
                  counterText: '',
                  prefixIcon: dashboard
                      ? const Icon(Icons.person_search_outlined)
                      : null,
                  border: dashboard
                      ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        )
                      : null,
                  hintText: _idInputFocused.value
                      ? null
                      : translate('Enter Remote ID'),
                  isDense: dashboard ? true : null,
                  contentPadding: EdgeInsets.symmetric(
                      horizontal: 15, vertical: dashboard ? 10 : 13)),
              controller: fieldTextEditingController,
              inputFormatters: [IDTextInputFormatter()],
              onChanged: (v) {
                _idController.id = v;
              },
              onSubmitted: (_) => _submitRemoteId(),
            ).workaroundFreezeLinuxMint());
      },
      onSelected: (option) {
        setState(() {
          _idController.id = option.id;
          FocusScope.of(context).unfocus();
        });
      },
      optionsViewBuilder: (BuildContext context,
          AutocompleteOnSelected<Peer> onSelected, Iterable<Peer> options) {
        options = _autocompleteOpts;
        double maxHeight = options.length * 50;
        if (options.length == 1) {
          maxHeight = 52;
        } else if (options.length == 3) {
          maxHeight = 146;
        } else if (options.length == 4) {
          maxHeight = 193;
        }
        maxHeight = maxHeight.clamp(0, 200);

        return Align(
          alignment: Alignment.topLeft,
          child: Container(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 5,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: ClipRRect(
                  borderRadius: BorderRadius.circular(5),
                  child: Material(
                    elevation: 4,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: maxHeight,
                        maxWidth: 319,
                      ),
                      child: _allPeersLoader.peers.isEmpty &&
                              !_allPeersLoader.isPeersLoaded
                          ? Container(
                              height: 80,
                              child: Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ))
                          : Padding(
                              padding: const EdgeInsets.only(top: 5),
                              child: ListView(
                                children: options
                                    .map((peer) => AutocompletePeerTile(
                                        onSelect: () => onSelected(peer),
                                        peer: peer))
                                    .toList(),
                              ),
                            ),
                    ),
                  ))),
        );
      },
    );
    final isTransfer = _section == HomeDashboardSection.transfer;
    final button = ElevatedButton(
      onPressed: _submitRemoteId,
      style: dashboard
          ? ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7630E4),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            )
          : null,
      child: dashboard
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.swap_horiz_rounded, size: 21),
                const SizedBox(width: 7),
                Text(translate(isTransfer ? 'Transfer file' : 'Connect')),
              ],
            )
          : Text(translate('Connect')),
    );
    final menu = Builder(builder: (context) {
      if (!dashboard) {
        return OutlinedButton(
          onPressed: () => _showConnectionMenu(context),
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Obx(() => Transform.rotate(
                angle: _menuOpen.value ? pi : 0,
                child: const Icon(IconFont.more, size: 14),
              )),
        );
      }
      return IconButton(
        tooltip: translate('More'),
        constraints: const BoxConstraints(),
        padding: EdgeInsets.zero,
        onPressed: () => _showConnectionMenu(context),
        icon: Obx(() => Transform.rotate(
              angle: _menuOpen.value ? pi : 0,
              child: const Icon(Icons.expand_more_rounded),
            )),
      );
    });

    Widget actions(double height) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(height: height, child: button),
            const SizedBox(width: 8),
            SizedBox.square(
              dimension: height,
              child: dashboard
                  ? DecoratedBox(
                      decoration: BoxDecoration(
                        border: Border.all(color: HomeDashboardTheme.border),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: menu,
                    )
                  : menu,
            ),
          ],
        );

    if (dashboard) {
      return DecoratedBox(
        decoration: HomeDashboardTheme.panel,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.desktop_windows_outlined, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      translate(isTransfer
                          ? 'Transfer file'
                          : 'Control Remote Desktop'),
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 9),
              LayoutBuilder(
                builder: (context, constraints) => constraints.maxWidth >= 420
                    ? Row(
                        children: [
                          Expanded(child: input),
                          const SizedBox(width: 12),
                          actions(44),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          input,
                          const SizedBox(height: 8),
                          actions(40),
                        ],
                      ),
              ),
            ],
          ),
        ),
      );
    }
    return Container(
      width: 360,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: Theme.of(context).scaffoldBackgroundColor),
      ),
      child: Ink(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            getConnectionPageTitle(context, false),
            const SizedBox(height: 15),
            input,
            const SizedBox(height: 13),
            actions(28),
          ],
        ),
      ),
    );
  }

  Future<void> _showConnectionMenu(BuildContext context) async {
    final anchor = context.findRenderObject()! as RenderBox;
    final overlay =
        Overlay.of(context).context.findRenderObject()! as RenderBox;
    final position = RelativeRect.fromSize(
      anchor.localToGlobal(Offset.zero, ancestor: overlay) & anchor.size,
      overlay.size,
    );
    _menuOpen.value = true;
    try {
      await mod_menu.showMenu(
        context: context,
        position: position,
        items: [
          ('Transfer file', () => onConnect(isFileTransfer: true)),
          ('View camera', () => onConnect(isViewCamera: true)),
          (
            '${translate('Terminal')} (beta)',
            () => onConnect(isTerminal: true)
          ),
          if (isDesktop)
            ('TCP tunneling', () => onConnect(isTcpTunneling: true)),
        ]
            .map<MenuEntryBase<String>>(
              (action) => MenuEntryButton<String>(
                childBuilder: (style) =>
                    Text(translate(action.$1), style: style),
                proc: action.$2,
                padding:
                    EdgeInsets.symmetric(horizontal: kDesktopMenuPadding.left),
                dismissOnClicked: true,
              ),
            )
            .followedBy([
              MenuEntryDivider<String>(),
              _requestApprovalMenu(context),
            ])
            .expand((entry) => entry.build(
                  context,
                  const MenuConfig(
                    commonColor: CustomPopupMenuTheme.commonColor,
                    height: CustomPopupMenuTheme.height,
                    dividerHeight: CustomPopupMenuTheme.dividerHeight,
                  ),
                ))
            .toList(),
        elevation: 8,
      );
    } finally {
      _menuOpen.value = false;
    }
  }
}
