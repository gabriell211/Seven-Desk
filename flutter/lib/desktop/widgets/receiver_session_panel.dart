import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

import '../../common.dart';
import '../../common/widgets/incoming_support_identity.dart';

enum ReceiverPanelView { none, chat, transfers, controls }

/// Always-visible receiver-side consent/status surface.
/// Changing modes never changes session authorization or disconnects the peer.
class ReceiverSessionPanel extends StatelessWidget {
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
    required this.onDisconnect,
    this.details,
    this.unreadMessages = 0,
    this.canChangeMonitor = true,
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
  final VoidCallback onDisconnect;
  final Widget? details;

  @override
  Widget build(BuildContext context) {
    const background = Color(0xFF171326);
    const border = Color(0xFF403752);
    const purple = Color(0xFFBA64FD);
    const green = Color(0xFF23E693);
    const muted = Color(0xFFC3BDD4);
    final fallback = CircleAvatar(
      radius: minimized ? 20 : 25,
      backgroundColor: const Color(0xFF312347),
      child: const Icon(Icons.person_outline_rounded, color: Colors.white),
    );
    final avatar = buildAvatarWidget(
          avatar: identity.avatarUrl,
          size: minimized ? 40 : 50,
          fallback: fallback,
        ) ??
        fallback;

    return Material(
      color: Colors.transparent,
      child: Container(
        margin: const EdgeInsets.all(4),
        padding: EdgeInsets.all(minimized ? 9 : 14),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: border),
          boxShadow: const [
            BoxShadow(color: Color(0x70000000), blurRadius: 14, offset: Offset(0, 4)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.max,
          children: [
            Row(
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onPanStart: (_) => windowManager.startDragging(),
                  child: Row(
                    children: [
                      avatar,
                      const SizedBox(width: 9),
                    ],
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onPanStart: (_) => windowManager.startDragging(),
                    onDoubleTap: minimized ? onRestore : onMinimize,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          identity.technician,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        if (!minimized)
                          Text(identity.company,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: muted)),
                        const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.circle, size: 8, color: green),
                            SizedBox(width: 6),
                            Text('Conectado',
                                style: TextStyle(fontSize: 11, color: green)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                IconButton(
                  tooltip: minimized ? 'Restaurar painel' : 'Minimizar painel',
                  onPressed: minimized ? onRestore : onMinimize,
                  icon: Icon(minimized
                      ? Icons.open_in_full_rounded
                      : Icons.remove_rounded),
                  color: muted,
                  iconSize: 19,
                  constraints: const BoxConstraints.tightFor(width: 32, height: 32),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            if (!minimized) ...[
              const SizedBox(height: 6),
              Text(
                'ID do solicitante: $peerId',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: muted, fontSize: 11),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _action(
                    'Chat',
                    Icons.chat_bubble_outline_rounded,
                    onChat,
                    selected: view == ReceiverPanelView.chat,
                    unread: unreadMessages,
                  ),
                  const SizedBox(width: 5),
                  _action(
                    'Transferências',
                    Icons.folder_copy_outlined,
                    onTransfers,
                    selected: view == ReceiverPanelView.transfers,
                  ),
                  const SizedBox(width: 5),
                  _action(
                    'Trocar monitor',
                    Icons.monitor_rounded,
                    canChangeMonitor ? onNextMonitor : null,
                    tooltip: canChangeMonitor
                        ? 'Compartilhar próximo monitor disponível'
                        : 'Troca de monitor não disponível nesta sessão',
                  ),
                  const SizedBox(width: 5),
                  _action(
                    'Mais controles',
                    Icons.tune_rounded,
                    onControls,
                    selected: view == ReceiverPanelView.controls,
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Desconectar sessão',
                    onPressed: onDisconnect,
                    icon: const Icon(Icons.link_off_rounded),
                    color: const Color(0xFFFF707B),
                    iconSize: 22,
                  ),
                ],
              ),
              if (view != ReceiverPanelView.none) ...[
                const Divider(color: border, height: 22),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        switch (view) {
                          ReceiverPanelView.chat => 'Chat com o técnico',
                          ReceiverPanelView.transfers => 'Transferências da sessão',
                          ReceiverPanelView.controls => 'Permissões da sessão',
                          ReceiverPanelView.none => '',
                        },
                        style: const TextStyle(color: Colors.white,
                            fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Fechar detalhes',
                      icon: const Icon(Icons.close_rounded, size: 19),
                      onPressed: onControls,
                      color: muted,
                    ),
                  ],
                ),
                Expanded(child: details ?? const SizedBox.shrink()),
              ],
            ] else
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onDisconnect,
                  icon: const Icon(Icons.link_off_rounded, size: 14),
                  label: const Text('Desconectar'),
                  style: TextButton.styleFrom(foregroundColor: const Color(0xFFFF707B)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _action(
    String label,
    IconData icon,
    VoidCallback? callback, {
    bool selected = false,
    int unread = 0,
    String? tooltip,
  }) {
    return Tooltip(
      message: tooltip ?? label,
      child: Semantics(
        label: label,
        button: true,
        child: Badge(
          isLabelVisible: unread > 0,
          label: Text(unread > 99 ? '99+' : '$unread'),
          child: IconButton(
            tooltip: label,
            onPressed: callback,
            style: IconButton.styleFrom(
              foregroundColor: selected ? const Color(0xFFBA64FD) : Colors.white,
              backgroundColor: selected ? const Color(0xFF342149) : Colors.transparent,
            ),
            icon: Icon(icon, size: 20),
          ),
        ),
      ),
    );
  }
}
