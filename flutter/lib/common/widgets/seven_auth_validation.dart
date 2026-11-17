import 'dart:convert';

import 'package:http/http.dart' as http;

final _activationPattern = RegExp(r'^sd_[A-Za-z0-9_-]{43}$');

bool isSevenDeskActivationCode(String token) =>
    _activationPattern.hasMatch(token);

/// The activation is issued to a verified account after signing in on the site.
/// Never fall back to a cached result when the VPS is unavailable.
Future<bool> sevenDeskHasValidAccount(String token, {http.Client? client}) async {
  if (!isSevenDeskActivationCode(token)) return false;
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
    return false;
  }
}
