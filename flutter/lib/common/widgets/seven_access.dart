import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/platform_model.dart';

const _optionKey = 'seven-license-token';
final _tokenPattern = RegExp(r'^sd_[A-Za-z0-9_-]{43}$');

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
      await bind.mainSetLocalOption(key: _optionKey, value: token);
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
            const Text('Gere o código na sua conta e cole aqui para iniciar suporte. '
                'Quem recebe suporte não precisa entrar na conta.'),
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
