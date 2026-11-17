import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/utils/seven_access_policy.dart';

void main() {
  test('interactive access selection reflects the actual local policy', () {
    expect(
        sevenDeskInteractiveMode(
            approveMode: 'click', onlyWhenWindowOpen: false),
        0);
    expect(
        sevenDeskInteractiveMode(
            approveMode: 'both', onlyWhenWindowOpen: true),
        1);
    expect(
        sevenDeskInteractiveMode(
            approveMode: 'password', onlyWhenWindowOpen: true),
        2);
  });

  test('unattended access is disabled unless password and mode permit it', () {
    for (final mode in ['click', 'password', 'both']) {
      for (final method in [
        'use-temporary-password', 'use-permanent-password', 'use-both-passwords'
      ]) {
        expect(
          sevenDeskUnattendedEnabled(
            passwordConfigured: false,
            approveMode: mode,
            verificationMethod: method,
          ),
          isFalse,
        );
      }
    }
    expect(
        sevenDeskUnattendedEnabled(
            passwordConfigured: true,
            approveMode: 'click',
            verificationMethod: 'use-permanent-password'),
        isFalse);
    expect(
        sevenDeskUnattendedEnabled(
            passwordConfigured: true,
            approveMode: 'password',
            verificationMethod: 'use-permanent-password'),
        isTrue);
    expect(
        sevenDeskUnattendedEnabled(
            passwordConfigured: true,
            approveMode: 'both',
            verificationMethod: 'use-temporary-password'),
        isFalse);
  });
}
