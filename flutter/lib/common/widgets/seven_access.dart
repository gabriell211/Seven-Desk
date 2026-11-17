import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../../models/platform_model.dart';

const _optionKey = 'seven-license-token';
final _tokenPattern = RegExp(r'^sd_[A-Za-z0-9_-]{43}$');

final sevenDeskProfile = SevenDeskProfile()..refresh();

class SevenDeskProfile {
  final name = ''.obs;
  final image = ''.obs;

  Future<void> refresh() async {
    name.value = '';
    image.value = '';
    final token = bind.mainGetLocalOption(key: _optionKey);
    if (!_tokenPattern.hasMatch(token)) return;
    try {
      final response = await http.get(
        Uri.parse('https://www.sevendesk.tech/api/app-profile'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 8));
      if (bind.mainGetLocalOption(key: _optionKey) != token) return;
      if (response.statusCode != 200) return;
      final profile = jsonDecode(response.body);
      if (profile is! Map) return;
      final profileName = profile['name'];
      final profileImage = profile['image'];
      if (profileName is String) name.value = profileName;
      if (profileImage is String) {
        final uri = Uri.tryParse(profileImage);
        if (uri?.scheme == 'https') image.value = profileImage;
      }
    } catch (_) {
      // An offline receiver can still accept support without a profile.
    }
  }
}


/// Every outbound session must be associated with a verified Seven Desk account.
/// The installed app receives a device activation after the owner signs in on the site.
/// Incoming support never invokes this guard.
Future<bool> sevenDeskHasValidAccount(String token, {http.Client? client}) async {
  if (!_tokenPattern.hasMatch(token)) return false;
  try {
    final uri = Uri.parse('https://www.sevendesk.tech/api/app-profile');
    final headers = <String, String>{'Authorization': 'Bearer $token'};
    final response = await (client == null
            ? http.get(uri, headers: headers)
            : client.get(uri, headers: headers))
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) return false;
    final profile = jsonDecode(response.body);
    return profile is Map &&
        profile['name'] is String &&
        profile['image'] is String;
  } catch (_) {
    // Never start an outgoing connection when account validation is unavailable.
    return false;
  }
}

Future<bool> ensureSevenDeskAuthenticated(BuildContext context) async {
  var token = bind.mainGetLocalOption(key: _optionKey);
  if (await sevenDeskHasValidAccount(token)) return true;
  if (!context.mounted) return false;

  await showSevenDeskActivationDialog(context);
  if (!context.mounted) return false;
  token = bind.mainGetLocalOption(key: _optionKey);
  if (await sevenDeskHasValidAccount(token)) return true;
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
  bool _showToken = false;
  bool _saving = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _controller =
        TextEditingController(text: bind.mainGetLocalOption(key: _optionKey));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save(String token) async {
    if (token.isNotEmpty && !_tokenPattern.hasMatch(token)) {
      setState(() => _error = 'Código inválido. Copie o código da sua conta.');
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      if (token.isNotEmpty && !await sevenDeskHasValidAccount(token)) {
        if (mounted) {
          setState(() {
            _saving = false;
            _error = 'Código não autorizado ou servidor indisponível.';
          });
        }
        return;
      }
      await bind.mainSetLocalOption(key: _optionKey, value: token);
      await sevenDeskProfile.refresh();
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
            const Text('Entre na sua conta Seven Desk, gere o código do dispositivo '
                'e cole aqui para iniciar suporte. Quem recebe suporte não precisa entrar.'),
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
