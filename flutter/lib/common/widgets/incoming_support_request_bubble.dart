import 'package:flutter/material.dart';

import '../../common.dart';
import 'incoming_support_identity.dart';

/// The receiver must approve the request locally; administrator approval
/// remains governed by the existing Windows/UAC callback.
class IncomingSupportRequestBubble extends StatelessWidget {
  const IncomingSupportRequestBubble({
    super.key,
    required this.identity,
    required this.requesterId,
    required this.onAccept,
    required this.onAcceptAsAdministrator,
    required this.onReject,
    this.acceptanceDisabledReason,
  });

  final IncomingSupportIdentity identity;
  final String requesterId;
  final VoidCallback? onAccept;
  final VoidCallback? onAcceptAsAdministrator;
  final VoidCallback onReject;
  final String? acceptanceDisabledReason;

  static const _purple = Color(0xFFA51CFA);
  static const _muted = Color(0xFFC9C1D8);
  static const _background = Color(0xFF140D24);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final compact = constraints.maxWidth < 590;
      final avatarSize = compact ? 68.0 : 112.0;
      final fallback = CircleAvatar(
        radius: avatarSize / 2,
        backgroundColor: const Color(0xFF38224E),
        child: Icon(Icons.person_outline_rounded,
            size: avatarSize * .50, color: Colors.white),
      );
      final avatar = buildAvatarWidget(
            avatar: identity.avatarUrl,
            size: avatarSize,
            fallback: fallback,
          ) ??
          fallback;
      final accept = FilledButton.icon(
        onPressed: onAccept,
        icon: const Icon(Icons.desktop_windows_outlined, size: 20),
        label: const Text('Aceitar'),
        style: FilledButton.styleFrom(
          backgroundColor: _purple,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13)),
        ),
      );
      final admin = Tooltip(
        message: onAcceptAsAdministrator != null
            ? 'O Windows poderá solicitar aprovação UAC neste computador.'
            : 'A elevação administrativa não está disponível nesta conexão.',
        child: FilledButton.icon(
          onPressed: onAcceptAsAdministrator,
          icon: const Icon(Icons.admin_panel_settings_rounded, size: 22),
          label: const Text('Aceitar como administrador',
              textAlign: TextAlign.center, maxLines: 2),
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 48),
            foregroundColor: Colors.white,
            disabledForegroundColor: _muted,
            backgroundColor: const Color(0xFF292039),
            disabledBackgroundColor: const Color(0xFF292039),
            side: const BorderSide(color: _purple, width: 1.3),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(13)),
          ),
        ),
      );
      final reject = OutlinedButton.icon(
        onPressed: onReject,
        icon: const Icon(Icons.close_rounded,
            color: Color(0xFFFF5268), size: 23),
        label: const Text('Recusar'),
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 48),
          side: const BorderSide(color: Color(0xFF625372)),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13)),
        ),
      );

      return Semantics(
        container: true,
        liveRegion: true,
        explicitChildNodes: true,
        child: Container(
          width: double.infinity,
          margin: EdgeInsets.all(compact ? 4 : 12),
          padding: EdgeInsets.symmetric(
              horizontal: compact ? 16 : 28, vertical: compact ? 15 : 23),
          decoration: BoxDecoration(
            color: _background,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: _purple.withOpacity(.66), width: 1.5),
            boxShadow: const [
              BoxShadow(color: Color(0x44000000), blurRadius: 22,
                  offset: Offset(0, 7)),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: _purple, width: 3),
                    boxShadow: const [
                      BoxShadow(color: Color(0x668E11EF), blurRadius: 18),
                    ],
                  ),
                  child: ClipOval(
                    child: SizedBox(
                        width: avatarSize, height: avatarSize, child: avatar),
                  ),
                ),
              ),
              SizedBox(height: compact ? 12 : 19),
              Text(
                'Solicitação de acesso remoto',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: compact ? 20 : 27,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              SizedBox(height: compact ? 8 : 13),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 5,
                runSpacing: 2,
                children: [
                  Text(identity.technician,
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700,
                        fontSize: 15)),
                  Text(identity.company,
                    style: const TextStyle(color: _muted, fontSize: 14)),
                  const Text('deseja acessar este computador.',
                      style: TextStyle(color: _muted, fontSize: 14)),
                ],
              ),
              SizedBox(height: compact ? 13 : 20),
              Container(
                padding: EdgeInsets.all(compact ? 12 : 17),
                decoration: BoxDecoration(
                  color: const Color(0xFF211932),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF55406B)),
                ),
                child: compact
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _infoLine(Icons.badge_outlined,
                              'ID do solicitante', 'ID: $requesterId'),
                          const SizedBox(height: 10),
                          _infoLine(Icons.desktop_windows_outlined,
                              'Acesso solicitado',
                              'Visualizar e controlar este computador.'),
                        ],
                      )
                    : Row(
                        children: [
                          Expanded(child: _infoLine(Icons.badge_outlined,
                              'ID do solicitante', 'ID: $requesterId')),
                          const SizedBox(height: 38, child: VerticalDivider(
                              color: Color(0xFF55406B), width: 24)),
                          Expanded(child: _infoLine(
                              Icons.desktop_windows_outlined,
                              'Acesso solicitado',
                              'Visualizar e controlar este computador.')),
                        ],
                      ),
              ),
              SizedBox(height: compact ? 10 : 14),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: const Color(0xFF2C2040),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: _purple, size: 21),
                    SizedBox(width: 9),
                    Expanded(child: Text(
                      'Confirme a identidade do técnico antes de permitir o acesso.',
                      style: TextStyle(color: Colors.white, fontSize: 13),
                    )),
                  ],
                ),
              ),
              SizedBox(height: compact ? 13 : 21),
              if (compact) ...[
                SizedBox(width: double.infinity, child: accept),
                const SizedBox(height: 7),
                SizedBox(width: double.infinity, child: admin),
                const SizedBox(height: 7),
                SizedBox(width: double.infinity, child: reject),
              ] else
                Row(
                  children: [
                    Expanded(child: reject),
                    const SizedBox(width: 12),
                    Expanded(child: accept),
                    const SizedBox(width: 12),
                    Expanded(flex: 2, child: admin),
                  ],
                ),
              if (acceptanceDisabledReason != null) ...[
                const SizedBox(height: 9),
                Text(acceptanceDisabledReason!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: _muted, fontSize: 12)),
              ],
            ],
          ),
        ),
      );
    });
  }

  Widget _infoLine(IconData icon, String label, String value) => Row(
    children: [
      Icon(icon, size: 29, color: _purple),
      const SizedBox(width: 12),
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(
              color: Colors.white, fontSize: 13,
              fontWeight: FontWeight.w600)),
          const SizedBox(height: 3),
          Text(value, style: const TextStyle(
              color: _muted, fontSize: 13), maxLines: 2,
              overflow: TextOverflow.ellipsis),
        ],
      )),
    ],
  );
}
