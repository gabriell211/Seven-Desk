import 'package:flutter/material.dart';

import '../../common.dart';

/// Read-only profile avatar supplied by the Seven Desk website.
/// Photos are configured per technician in the account portal, never locally.
class SessionToolbarAvatar extends StatelessWidget {
  const SessionToolbarAvatar({
    super.key,
    required this.photo,
    required this.size,
  });

  final String photo;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final fallback = Icon(
      Icons.person_outline_rounded,
      size: size * 0.65,
      color: colors.onSecondaryContainer,
    );
    return Semantics(
      image: true,
      label: 'Foto do técnico Seven Desk',
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: colors.secondaryContainer,
          ),
          child: Center(
            child: buildAvatarWidget(
                  avatar: photo,
                  size: size,
                  fallback: fallback,
                ) ??
                fallback,
          ),
        ),
      ),
    );
  }
}
