import 'dart:convert';

import 'package:http/http.dart' as http;

final _activationPattern = RegExp(r'^sd(?:2)?_[A-Za-z0-9_-]{43}$');
final _technicianPattern = RegExp(r'^tec_[A-Za-z0-9_-]{32}$');

bool isSevenDeskActivationCode(String token) =>
    _activationPattern.hasMatch(token);

bool isSevenDeskTechnicianCode(String code) =>
    _technicianPattern.hasMatch(code);

enum SevenDeskValidationStatus {
  verified,
  rejected,
  invalidCode,
  serverUnavailable,
  networkFailure,
  unexpectedResponse,
}

/// Recheck current remote activation. Never cache revoked or offline accounts.
Future<SevenDeskValidationStatus> checkSevenDeskAccount(String token,
    {http.Client? client}) async {
  if (!isSevenDeskActivationCode(token)) {
    return SevenDeskValidationStatus.invalidCode;
  }
  try {
    final uri = Uri.parse('https://www.sevendesk.tech/api/app-profile');
    final headers = <String, String>{'Authorization': 'Bearer $token'};
    final response = await (client == null
            ? http.get(uri, headers: headers)
            : client.get(uri, headers: headers))
        .timeout(const Duration(seconds: 8));
    if (response.statusCode == 401 || response.statusCode == 403) {
      return SevenDeskValidationStatus.rejected;
    }
    if (response.statusCode >= 500) {
      return SevenDeskValidationStatus.serverUnavailable;
    }
    if (response.statusCode != 200) {
      return SevenDeskValidationStatus.unexpectedResponse;
    }
    final profile = jsonDecode(response.body);
    return profile is Map &&
            profile['name'] is String &&
            (profile['name'] as String).trim().length >= 2 &&
            profile['image'] is String
        ? SevenDeskValidationStatus.verified
        : SevenDeskValidationStatus.unexpectedResponse;
  } on FormatException {
    return SevenDeskValidationStatus.unexpectedResponse;
  } catch (_) {
    return SevenDeskValidationStatus.networkFailure;
  }
}

Future<bool> sevenDeskHasValidAccount(String token,
        {http.Client? client}) async =>
    await checkSevenDeskAccount(token, client: client) ==
    SevenDeskValidationStatus.verified;

/// Pair the technician and device codes once, then never persist the tec_ code.
Future<SevenDeskValidationStatus> checkSevenDeskTechnicianClaim(
    String token, String technicianCode,
    {http.Client? client}) async {
  if (!isSevenDeskActivationCode(token) ||
      !isSevenDeskTechnicianCode(technicianCode)) {
    return SevenDeskValidationStatus.invalidCode;
  }
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
    if (response.statusCode == 400) {
      return SevenDeskValidationStatus.invalidCode;
    }
    if (response.statusCode == 401 || response.statusCode == 403) {
      return SevenDeskValidationStatus.rejected;
    }
    if (response.statusCode >= 500) {
      return SevenDeskValidationStatus.serverUnavailable;
    }
    if (response.statusCode != 200) {
      return SevenDeskValidationStatus.unexpectedResponse;
    }
    final result = jsonDecode(response.body);
    return result is Map && result['verified'] == true
        ? SevenDeskValidationStatus.verified
        : SevenDeskValidationStatus.unexpectedResponse;
  } on FormatException {
    return SevenDeskValidationStatus.unexpectedResponse;
  } catch (_) {
    return SevenDeskValidationStatus.networkFailure;
  }
}

Future<bool> claimSevenDeskTechnician(String token, String technicianCode,
        {http.Client? client}) async =>
    await checkSevenDeskTechnicianClaim(token, technicianCode,
        client: client) ==
    SevenDeskValidationStatus.verified;
