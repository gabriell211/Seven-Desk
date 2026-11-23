import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/desktop/services/administrator_approval.dart';

void main() {
  test('administrator approval requests elevation before authorization', () {
    final calls = <String>[];

    acceptRemoteSessionAsAdministrator(
      requestElevation: () => calls.add('requestElevation'),
      authorizeConnection: () => calls.add('authorizeConnection'),
    );

    expect(calls, ['requestElevation', 'authorizeConnection']);
  });

  test('does not authorize if the elevation request fails synchronously', () {
    var authorized = false;
    expect(
      () => acceptRemoteSessionAsAdministrator(
        requestElevation: () => throw StateError('UAC unavailable'),
        authorizeConnection: () => authorized = true,
      ),
      throwsStateError,
    );
    expect(authorized, isFalse);
  });
}
