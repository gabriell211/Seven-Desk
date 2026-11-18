import 'package:flutter/material.dart';

import '../../common.dart';
import 'incoming_support_identity.dart';

/// Receives a connection request in the receiving machine's local CM window.
/// The requested elevation is performed by the existing Windows/UAC pathway.
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

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final fallback = CircleAvatar(
      radius: 27,
      backgroundColor: colors.secondaryContainer,
      child: Icon(
        Icons.person_outline_rounded,
        color: colors.onSecondaryContainer,
        size: 29,
      ),
    );

    final avatar = buildAvatarWidget(
          avatar: identity.avatarUrl,
          size: 54,
          fallback: fallback,
        ) ??
        fallback;
    final adminAvailable = onAcceptAsAdministrator != null;
    return Semantics(
      container: true,
      liveRegion: true,
      explicitChildNodes: true,
      child: Card(
        elevation: 6,
        margin: const EdgeInsets.fromLTRB(4, 5, 4, 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: colors.primary.withOpacity(0.45)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.notifications_active_outlined,
                      size: 19, color: colors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Solicitação de acesso remoto',
                      style: Theme.of(context).textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  avatar,
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          identity.technician,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          identity.company,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Text(
                          'ID: $requesterId',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Identificação informada pelo solicitante. '
                'Confirme quem está pedindo acesso antes de aceitar.',
                maxLines: 2,
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: 10),
              Tooltip(
                message: adminAvailable
                    ? 'O Windows poderá pedir aprovação UAC neste computador.'
                    : 'Elevação não disponível nesta conexão ou bloqueada pela política local.',
                child: SizedBox(
                  height: 40,
                  child: FilledButton.icon(
                    onPressed: onAcceptAsAdministrator,
                    icon: const Icon(Icons.admin_panel_settings_outlined,
                        size: 18),
                    label: const Text('Aceitar como administrador'),
                  ),
                ),
              ),
              const SizedBox(height: 7),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: FilledButton.tonal(
                        onPressed: onAccept,
                        child: const Text('Aceitar'),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: OutlinedButton(
                        onPressed: onReject,
                        child: const Text('Recusar'),
                      ),
                    ),
                  ),
                ],
              ),
              if (acceptanceDisabledReason != null) ...[
                const SizedBox(height: 7),
                Text(
                  acceptanceDisabledReason!,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
