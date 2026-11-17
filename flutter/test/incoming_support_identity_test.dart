import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/common/widgets/incoming_support_identity.dart';

void main() {
  const trusted =
      'https://www.sevendesk.tech/avatars/'
      'bbde939e-b2c5-45f5-9dc0-6645f59d78cf/technician-1.png';

  test('separates technician, company and official avatar for incoming bubble', () {
    final identity = incomingSupportIdentity(
      requesterName: 'Ana Oliveira · Seven Suporte',
      requesterAvatar: trusted,
    );
    expect(identity.technician, 'Ana Oliveira');
    expect(identity.company, 'Seven Suporte');
    expect(identity.avatarUrl, trusted);
  });

  test('falls back safely for older installers and malformed identities', () {
    final legacy = incomingSupportIdentity(
      requesterName: 'Estação local',
      requesterAvatar: '',
    );
    expect(legacy.technician, 'Estação local');
    expect(legacy.company, 'Empresa não informada');
    expect(legacy.avatarUrl, '');

    final invalid = incomingSupportIdentity(
      requesterName: 'Técnico\\nFake · Empresa',
      requesterAvatar: 'http://www.sevendesk.tech/picture.png',
    );
    expect(invalid.technician, 'Técnico não identificado');
    expect(invalid.avatarUrl, '');
  });

  test('never fetches arbitrary attacker-controlled avatar URLs', () {
    for (final url in [
      'https://evil.example/avatar.jpg',
      'https://www.sevendesk.tech.evil.example/avatars/a.jpg',
      'https://user@www.sevendesk.tech/avatars/a.jpg',
      'https://www.sevendesk.tech:8443/avatars/a.jpg',
      'https://www.sevendesk.tech/avatars/invalid/technician-1.png',
      '$trusted?token=secret',
      '$trusted#fragment',
      'data:image/png;base64,dGVzdA==',
    ]) {
      expect(
        incomingSupportIdentity(
          requesterName: 'Ana · Company',
          requesterAvatar: url,
        ).avatarUrl,
        isEmpty,
        reason: 'Untrusted image must not be requested: $url',
      );
    }
  });

  test('admin action requires explicit supported Windows elevation', () {
    const valid = {
      'isWindows': true,
      'canElevate': true,
      'showElevation': true,
      'isRemoteDesktop': true,
      'policyAllowsElevation': true,
      'clickApprovalAllowed': true,
    };
    expect(
      canAcceptRemoteAsAdministrator(
        isWindows: true,
        canElevate: true,
        showElevation: true,
        isRemoteDesktop: true,
        policyAllowsElevation: true,
        clickApprovalAllowed: true,
      ),
      isTrue,
    );
    for (final field in valid.keys) {
      final values = Map<String, bool>.of(valid)..[field] = false;
      expect(
        canAcceptRemoteAsAdministrator(
          isWindows: values['isWindows']!,
          canElevate: values['canElevate']!,
          showElevation: values['showElevation']!,
          isRemoteDesktop: values['isRemoteDesktop']!,
          policyAllowsElevation: values['policyAllowsElevation']!,
          clickApprovalAllowed: values['clickApprovalAllowed']!,
        ),
        isFalse,
        reason: '$field must be required',
      );
    }
  });
}
