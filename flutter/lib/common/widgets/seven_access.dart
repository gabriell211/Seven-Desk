import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../models/platform_model.dart';
import 'seven_auth_validation.dart';

const _optionKey = 'seven-license-token';

final sevenDeskProfile = SevenDeskProfile()..refresh();

class SevenDeskProfile {
  final name = ''.obs;
  final image = ''.obs;
  final companyName = ''.obs;

  /// Refreshes exclusively from the authenticated profile on our site.
  /// Cached identity is cleared on failure to avoid showing a revoked profile.
  Future<bool> refresh() async {
    name.value = '';
    image.value = '';
    companyName.value = '';
    try {
      await bind.mainSetLocalOption(key: 'seven-site-profile', value: '');
      final token = bind.mainGetLocalOption(key: _optionKey);
      if (!isSevenDeskActivationCode(token)) return false;

      final response = await http.get(
        Uri.parse('https://www.sevendesk.tech/api/app-profile'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 8));
      if (bind.mainGetLocalOption(key: _optionKey) != token ||
          response.statusCode != 200) return false;

      final profile = jsonDecode(response.body);
      if (profile is! Map) return false;
      final displayName = profile['name'];
      final company = profile['companyName'];
      final imageUrl = profile['image'];
      if (displayName is! String || displayName.trim().length < 2 ||
          displayName.trim().length > 100) return false;
      var verifiedImage = '';
      if (imageUrl is String && imageUrl.isNotEmpty) {
        final uri = Uri.tryParse(imageUrl);
        final path = uri?.path ?? '';
        if (uri == null || uri.scheme != 'https' ||
            uri.host != 'www.sevendesk.tech' ||
            uri.userInfo.isNotEmpty || uri.hasPort ||
            uri.hasQuery || uri.hasFragment ||
            !RegExp(r'^/avatars/[0-9a-f-]{36}/(?:profile|technician-[1-9][0-9]{0,4})\.(?:jpg|png|webp)$').hasMatch(path)) {
          return false;
        }
        verifiedImage = imageUrl;
        // The website may replace a picture at the same URL.
        await NetworkImage(verifiedImage).evict();
      }
      final cleanCompany = company is String && company.trim().length <= 100
          ? company.trim()
          : '';
      final operatorIdentity = jsonEncode({
        'name': displayName.trim(),
        'image': verifiedImage,
        'companyName': cleanCompany,
      });
      await bind.mainSetLocalOption(
        key: 'seven-site-profile',
        value: operatorIdentity,
      );
      name.value = displayName.trim();
      image.value = verifiedImage;
      companyName.value = cleanCompany;
      return true;
    } catch (_) {
      // No identity is shown as verified when the VPS cannot confirm it.
      return false;
    }
  }
}


Future<bool> ensureSevenDeskAuthenticated(BuildContext context) async {
  if (await sevenDeskProfile.refresh()) return true;
  if (!context.mounted) return false;

  await showSevenDeskActivationDialog(context);
  if (!context.mounted) return false;
  if (await sevenDeskProfile.refresh()) return true;
  if (!context.mounted) return false;

  ScaffoldMessenger.maybeOf(context)?.showSnackBar(
    const SnackBar(
      content: Text(
        'Entre na sua conta Seven Desk e ative este dispositivo para iniciar a conexão.',
      ),
    ),
  );
  return false;
}

Future<void> showSevenDeskActivationDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (_) => const _SevenDeskActivationDialog(),
  );
}

class _SevenDeskActivationDialog extends StatefulWidget {
  const _SevenDeskActivationDialog();

  @override
  State<_SevenDeskActivationDialog> createState() =>
      _SevenDeskActivationDialogState();
}

class _SevenDeskActivationDialogState
    extends State<_SevenDeskActivationDialog> {
  late final TextEditingController _controller;
  late final TextEditingController _technicianController;
  bool _showToken = false;
  bool _saving = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _controller =
        TextEditingController(text: bind.mainGetLocalOption(key: _optionKey));
    _technicianController = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    _technicianController.dispose();
    super.dispose();
  }

  Future<void> _save(String token) async {
    if (token.isNotEmpty && !isSevenDeskActivationCode(token)) {
      setState(() => _error = 'Código inválido. Copie o código da sua conta.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      if (token.isNotEmpty && !await sevenDeskHasValidAccount(token) &&
          (!await claimSevenDeskTechnician(token, _technicianController.text.trim()) ||
              !await sevenDeskHasValidAccount(token))) {
        if (mounted) {
          setState(() {
            _saving = false;
            _error = 'Código não autorizado ou servidor indisponível.';
          });
        }
        return;
      }
      final previousToken = bind.mainGetLocalOption(key: _optionKey);
      await bind.mainSetLocalOption(key: _optionKey, value: token);
      final profileReady = await sevenDeskProfile.refresh();
      if (token.isNotEmpty && !profileReady) {
        // Never keep a failed activation on disk. The previously verified
        // device token remains available for an explicit retry.
        await bind.mainSetLocalOption(key: _optionKey, value: previousToken);
        if (mounted) {
          setState(() {
            _saving = false;
            _error = 'Não foi possível validar seu perfil no site.';
          });
        }
        return;
      }
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Não foi possível salvar o código.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ativar Seven Desk'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Na sua conta Seven Desk, copie o código de ativação sd_ '
                'do computador e o código tec_ do técnico. Ambos são necessários '
                'no primeiro vínculo. Quem recebe suporte não precisa entrar.'),
            const SizedBox(height: 14),
            TextField(
              controller: _controller,
              maxLength: 46,
              obscureText: !_showToken,
              autocorrect: false,
              enableSuggestions: false,
              decoration: InputDecoration(
                labelText: 'Código de ativação',
                suffixIcon: IconButton(
                  tooltip: _showToken ? 'Ocultar código' : 'Mostrar código',
                  onPressed: () => setState(() => _showToken = !_showToken),
                  icon: Icon(_showToken ? Icons.visibility_off : Icons.visibility),
                ),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _technicianController,
              maxLength: 36,
              obscureText: !_showToken,
              autocorrect: false,
              enableSuggestions: false,
              decoration: const InputDecoration(
                labelText: 'Código do técnico (tec_)',
                helperText: 'Usado uma vez para vincular o técnico. Não fica salvo.',
              ),
            ),
            TextButton(
              onPressed: () => launchUrl(
                Uri.parse('https://www.sevendesk.tech/conta'),
                mode: LaunchMode.externalApplication,
              ),
              child: const Text('Abrir minha conta'),
            ),
            if (_error.isNotEmpty)
              Text(_error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        TextButton(
          onPressed: _saving ? null : () => _save(''),
          child: const Text('Remover'),
        ),
        FilledButton(
          onPressed: _saving ? null : () => _save(_controller.text.trim()),
          child: const Text('Salvar'),
        ),
      ],
    );
  }
}
