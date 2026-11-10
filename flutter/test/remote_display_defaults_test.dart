import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/consts.dart';
import 'package:flutter_hbb/utils/remote_display_defaults.dart';

void main() {
  test('migrates legacy display settings only', () {
    expect(migratedRemoteViewStyle(kRemoteViewStyleOriginal),
        kRemoteViewStyleAdaptive);
    expect(migratedRemoteScrollStyle(kRemoteScrollStyleAuto),
        kRemoteScrollStyleBar);
  });

  test('preserves customized display settings', () {
    expect(migratedRemoteViewStyle(kRemoteViewStyleAdaptive), isNull);
    expect(migratedRemoteViewStyle(kRemoteViewStyleCustom), isNull);
    expect(migratedRemoteScrollStyle(kRemoteScrollStyleBar), isNull);
    expect(migratedRemoteScrollStyle(kRemoteScrollStyleEdge), isNull);
  });

  test('does not migrate missing settings', () {
    expect(migratedRemoteViewStyle(null), isNull);
    expect(migratedRemoteScrollStyle(null), isNull);
  });
}
