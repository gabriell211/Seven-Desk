import 'dart:convert';

import 'package:http/http.dart' as http;

final _activationPattern = RegExp(r'^sd_[A-Za-z0-9_-]{43}

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
);
final _technicianPattern = RegExp(r'^tec_[A-Za-z0-9_-]{32}

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
);

bool isSevenDeskTechnicianCode(String code) => _technicianPattern.hasMatch(code);

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

\n/// Pair the company's device activation with this technician only once.
/// The technician code is not stored by the executable after successful pairing.
Future<bool> claimSevenDeskTechnician(String token, String technicianCode,
    {http.Client? client}) async {
  if (!isSevenDeskActivationCode(token) ||
      !isSevenDeskTechnicianCode(technicianCode)) return false;
  try {
    final uri = Uri.parse('https://www.sevendesk.tech/api/technician-claim');
    final headers = <String, String>{'Content-Type': 'application/json'};
    final body = jsonEncode({
      'activationToken': token,
      'technicianCode': technicianCode,
    });
    final response = await (client == null
            ? http.post(uri, headers: headers, body: body)
            : client.post(uri, headers: headers, body: body))
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) return false;
    final result = jsonDecode(response.body);
    return result is Map && result['verified'] == true;
  } catch (_) {
    return false;
  }
}
