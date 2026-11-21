import 'dart:async';

import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

import '../../common.dart';
import '../../common/widgets/incoming_support_identity.dart';

enum ReceiverPanelView { none, chat, transfers, controls }

/// Receiver-side status surface. Session actions continue to use the
/// existing authorization and disconnect callbacks.
class ReceiverSessionPanel extends StatefulWidget {
  const ReceiverSessionPanel({
    super.key,
    required this.identity,
    required this.peerId,
    required this.minimized,
    required this.view,
    required this.onMinimize,
    required this.onRestore,
    required this.onChat,
    required this.onTransfers,
    required this.onNextMonitor,
    required this.onControls,
    required this.onCloseDetails,
    required this.onDisconnect,
    this.onToggleFullScreen,
    this.details,
    this.unreadMessages = 0,
    this.canChangeMonitor = true,
    this.onNextSession,
  });

  final IncomingSupportIdentity identity;
  final String peerId;
  final bool minimized;
  final ReceiverPanelView view;
  final int unreadMessages;
  final bool canChangeMonitor;
  final VoidCallback onMinimize;
  final VoidCallback onRestore;
  final VoidCallback onChat;
  final VoidCallback onTransfers;
  final VoidCallback onNextMonitor;
  final VoidCallback onControls;
  final VoidCallback onCloseDetails;
  final VoidCallback onDisconnect;
  final VoidCallback? onNextSession;
  final VoidCallback? onToggleFullScreen;
  final Widget? details;

  @override
  State<ReceiverSessionPanel> createState() => _ReceiverSessionPanelState();
}

class _ReceiverSessionPanelState extends State<ReceiverSessionPanel> {
  static const _purple = Color(0xFFA51CFA);
  static const _background = Color(0xFF140F27);
  static const _panel = Color(0xFF211A37);
  static const _border = Color(0xFF53416C);
  static const _muted = Color(0xFFC8C0D7);
  static const _green = Color(0xFF25DB6D);
  DateTime _visibleSince = DateTime.now();
  final ValueNotifier<Duration> _elapsed = ValueNotifier(Duration.zero);
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && !widget.minimized) {
        _elapsed.value = DateTime.now().difference(_visibleSince);
      }
    });
  }

  @override
  void didUpdateWidget(covariant ReceiverSessionPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.peerId != widget.peerId) {
      _visibleSince = DateTime.now();
    }
  }

  @override
  void dispose() {
    _clock?.cancel();
    _elapsed.dispose();
    super.dispose();
  }

  String _timeLabel(Duration elapsed) {
    final seconds = elapsed.inSeconds;
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final remainder = seconds % 60;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final avatarSize = widget.minimized ? 38.0 : 66.0;
    final fallback = CircleAvatar(
      radius: avatarSize / 2,
      backgroundColor: const Color(0xFF37224F),
      child: Icon(Icons.person_outline_rounded,
          size: avatarSize * .5, color: Colors.white),
    );
    final avatar = buildAvatarWidget(
          avatar: widget.identity.avatarUrl,
          size: avatarSize,
          fallback: fallback,
        ) ??
        fallback;
    return Material(
      color: Colors.transparent,
      child: Container(
        margin: const EdgeInsets.all(4),
        padding: EdgeInsets.all(widget.minimized ? 10 : 13),
        decoration: BoxDecoration(
          color: _background,
          borderRadius: BorderRadius.circular(23),
          border: Border.all(color: _purple, width: 1.6),
          boxShadow: const [
            BoxShadow(
                color: Color(0x62000000), blurRadius: 24,
                offset: Offset(0, 7)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _header(),
            if (widget.minimized) ...[
              const SizedBox(height: 7),
              Row(
                children: [
                  ClipOval(child: SizedBox(
                      height: avatarSize, width: avatarSize, child: avatar)),
                  const SizedBox(width: 9),
                  Expanded(child: Text(widget.identity.technician,
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white,
                        fontWeight: FontWeight.w700))),
                  IconButton(
                    tooltip: 'Restaurar painel',
                    onPressed: widget.onRestore,
                    icon: const Icon(Icons.open_in_full_rounded,
                        color: Colors.white),
                  ),
                ],
              ),
              const Spacer(),
              _disconnect(compact: true),
            ] else ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: _purple, width: 2),
                    ),
                    padding: const EdgeInsets.all(2),
                    child: ClipOval(child: SizedBox(
                        height: avatarSize, width: avatarSize, child: avatar)),
                  ),
                  const SizedBox(width: 11),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.identity.technician,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white,
                            fontSize: 17, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(widget.identity.company,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: _muted, fontSize: 12)),
                      const SizedBox(height: 3),
                      SelectableText('ID: ${widget.peerId}',
                        style: const TextStyle(color: _muted, fontSize: 12)),
                    ],
                  )),
                  Tooltip(
                    message: 'Tempo de exibição desta sessão',
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 7),
                      decoration: BoxDecoration(
                        color: _panel,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _border),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.schedule_rounded,
                            color: Colors.white, size: 17),
                        const SizedBox(width: 5),
                        ValueListenableBuilder<Duration>(
                          valueListenable: _elapsed,
                          builder: (context, elapsed, _) => Text(
                            _timeLabel(elapsed),
                            style: const TextStyle(
                                color: Colors.white, fontSize: 11),
                          ),
                        ),
                      ]),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(children: [
                _action('Chat', Icons.chat_bubble_outline_rounded,
                  widget.onChat,
                  selected: widget.view == ReceiverPanelView.chat,
                  unread: widget.unreadMessages),
                _action('Arquivos', Icons.folder_open_outlined,
                  widget.onTransfers,
                  tooltip: 'Transferências',
                  selected: widget.view == ReceiverPanelView.transfers),
                _action('Monitor', Icons.desktop_windows_outlined,
                  widget.canChangeMonitor ? widget.onNextMonitor : null,
                  tooltip: 'Trocar monitor'),
                _action('Tela cheia', Icons.fullscreen_rounded,
                  widget.onToggleFullScreen,
                  tooltip: 'Alternar tela cheia do painel'),
                _action('Opções', Icons.settings_outlined,
                  widget.onControls,
                  selected: widget.view == ReceiverPanelView.controls),
              ]),
              const SizedBox(height: 12),
              if (widget.view != ReceiverPanelView.none)
                Expanded(
                  child: Container(
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: _panel,
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: _border),
                    ),
                    child: Column(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 11, vertical: 5),
                        child: Row(children: [
                          const Icon(Icons.chat_outlined,
                              color: Colors.white, size: 18),
                          const SizedBox(width: 7),
                          Expanded(child: Text(
                            switch (widget.view) {
                              ReceiverPanelView.chat => 'Chat com o técnico',
                              ReceiverPanelView.transfers => 'Arquivos da sessão',
                              ReceiverPanelView.controls => 'Opções da sessão',
                              ReceiverPanelView.none => '',
                            },
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13, fontWeight: FontWeight.w700),
                          )),
                          if (widget.view == ReceiverPanelView.chat)
                            const Tooltip(
                              message: 'A segurança depende da sessão estabelecida',
                              child: Row(children: [
                                Icon(Icons.lock_outline_rounded,
                                    color: _green, size: 14),
                                SizedBox(width: 3),
                                Text('Sessão protegida',
                                  style: TextStyle(color: _green, fontSize: 10)),
                              ]),
                            ),
                          IconButton(
                            tooltip: 'Fechar detalhes',
                            onPressed: widget.onCloseDetails,
                            icon: const Icon(Icons.close_rounded,
                                color: _muted, size: 17),
                            constraints: const BoxConstraints.tightFor(
                                width: 29, height: 29),
                            padding: EdgeInsets.zero,
                          ),
                        ]),
                      ),
                      const Divider(height: 1, color: _border),
                      Expanded(
                        child: Theme(
                          data: ThemeData.dark().copyWith(
                            scaffoldBackgroundColor: _panel,
                            cardColor: _panel,
                            colorScheme: const ColorScheme.dark(
                              primary: _purple,
                              surface: _panel,
                              onSurface: Colors.white,
                            ),
                            inputDecorationTheme: InputDecorationTheme(
                              filled: true,
                              fillColor: const Color(0xFF2D2445),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(11)),
                            ),
                          ),
                          child: widget.details ?? const SizedBox.shrink(),
                        ),
                      ),
                    ]),
                  ),
                )
              else
                const Spacer(),
              const SizedBox(height: 12),
              _disconnect(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _header() => SizedBox(
    height: 48,
    child: Row(children: [
    GestureDetector(
      behavior: HitTestBehavior.opaque,
      onPanStart: (_) => windowManager.startDragging(),
      child: Row(children: [
        loadIcon(29),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
          Text('Seven Desk', style: TextStyle(
            color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
          Row(children: [
            Icon(Icons.circle, size: 9, color: _green),
            SizedBox(width: 6),
            Text('Conectado', style: TextStyle(color: _green, fontSize: 12)),
          ]),
        ]),
      ]),
    ),
    Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onPanStart: (_) => windowManager.startDragging(),
      ),
    ),
    if (widget.onNextSession != null)
      IconButton(
        tooltip: 'Alternar sessão conectada',
        onPressed: widget.onNextSession,
        icon: const Icon(Icons.swap_horiz_rounded),
        color: _muted,
        iconSize: 19,
      ),
    IconButton(
      tooltip: widget.minimized ? 'Restaurar painel' : 'Minimizar painel',
      onPressed: widget.minimized ? widget.onRestore : widget.onMinimize,
      icon: Icon(widget.minimized
          ? Icons.open_in_full_rounded : Icons.remove_rounded),
      color: _muted, iconSize: 20,
    ),
    ]),
  );

  Widget _action(String label, IconData icon, VoidCallback? callback, {
    bool selected = false,
    int unread = 0,
    String? tooltip,
  }) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Badge(
          isLabelVisible: unread > 0,
          label: Text(unread > 99 ? '99+' : '$unread'),
          child: Tooltip(
            message: tooltip ?? label,
            child: Material(
              color: selected ? const Color(0xFF5A177C) : _panel,
              borderRadius: BorderRadius.circular(13),
              child: InkWell(
                onTap: callback,
                borderRadius: BorderRadius.circular(13),
                child: Container(
                  height: 66,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                      color: selected ? _purple : _border,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, size: 24,
                        color: callback == null ? _muted : Colors.white),
                      const SizedBox(height: 4),
                      Text(label, maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 10,
                          color: callback == null ? _muted : Colors.white)),
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

  Widget _disconnect({bool compact = false}) => Tooltip(
    message: 'Desconectar sessão',
    child: SizedBox(
    height: compact ? 34 : 51,
    width: double.infinity,
    child: FilledButton.icon(
      onPressed: widget.onDisconnect,
      style: FilledButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFFEA294C),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12)),
      ),
      icon: Icon(Icons.link_off_rounded, size: compact ? 17 : 22),
      label: Text('Desconectar',
          style: TextStyle(
              fontSize: compact ? 13 : 17, fontWeight: FontWeight.w700)),
    ),
    ),
  );
}
