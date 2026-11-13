import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../common.dart';
import '../../models/platform_model.dart';
import '../../utils/session_toolbar_photo.dart';

const sessionToolbarPhotoLabel = 'Session toolbar photo';
const _photoOption = 'remote-toolbar-avatar';
const _photoError =
    'Could not use this photo. Select a JPG, PNG or WebP up to 12 MB and 32 megapixels.';

String get sessionToolbarPhoto => bind.getLocalFlutterOption(k: _photoOption);

class SessionToolbarAvatar extends StatefulWidget {
  const SessionToolbarAvatar({
    super.key,
    required this.photo,
    required this.size,
  });

  final String photo;
  final double size;

  @override
  State<SessionToolbarAvatar> createState() => _SessionToolbarAvatarState();
}

class _SessionToolbarAvatarState extends State<SessionToolbarAvatar> {
  late Widget _image = _buildImage();

  Widget _buildImage() {
    final fallback = Icon(
      Icons.person_outline_rounded,
      size: widget.size * 0.65,
    );
    if (!widget.photo.startsWith(sessionToolbarPhotoDataUriPrefix)) {
      return fallback;
    }
    return buildAvatarWidget(
          avatar: widget.photo,
          size: widget.size,
          fallback: fallback,
        ) ??
        fallback;
  }

  @override
  void didUpdateWidget(covariant SessionToolbarAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.photo != widget.photo || oldWidget.size != widget.size) {
      _image = _buildImage();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      image: true,
      label: translate(sessionToolbarPhotoLabel),
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: widget.size,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: colors.secondaryContainer,
          ),
          child: Center(
            child: IconTheme.merge(
              data: IconThemeData(color: colors.onSecondaryContainer),
              child: _image,
            ),
          ),
        ),
      ),
    );
  }
}

class SessionToolbarAvatarSettings extends StatefulWidget {
  const SessionToolbarAvatarSettings({super.key});

  @override
  State<SessionToolbarAvatarSettings> createState() =>
      _SessionToolbarAvatarSettingsState();
}

class _SessionToolbarAvatarSettingsState
    extends State<SessionToolbarAvatarSettings> {
  bool _saving = false;
  bool _showError = false;

  Future<void> _save({required bool remove}) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _showError = false;
    });
    try {
      var photo = '';
      if (!remove) {
        final selection = await FilePicker.platform.pickFiles(
          dialogTitle: translate(sessionToolbarPhotoLabel),
          type: FileType.custom,
          allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
        );
        if (selection == null || !mounted) return;
        final path = selection.files.single.path;
        if (path == null) throw const FormatException('No toolbar photo path');
        photo = await loadSessionToolbarPhoto(path);
      }
      if (!mounted) return;
      await bind.setLocalFlutterOption(k: _photoOption, v: photo);
      await reloadAllWindows();
    } catch (_) {
      if (mounted) setState(() => _showError = true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final photo = sessionToolbarPhoto;
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SessionToolbarAvatar(photo: photo, size: 48),
              const SizedBox(width: 16),
              Flexible(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _saving ? null : () => _save(remove: false),
                      icon: _saving
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.photo_outlined, size: 18),
                      label: Text(translate(photo.isEmpty ? 'Select' : 'Change')),
                    ),
                    if (photo.isNotEmpty)
                      TextButton(
                        onPressed: _saving ? null : () => _save(remove: true),
                        child: Text(translate('Remove')),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (_showError)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  translate(_photoError),
                  style: TextStyle(color: colors.error),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
