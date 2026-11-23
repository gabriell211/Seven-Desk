import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/desktop/pages/desktop_setting_page.dart';

void main() {
  test('portable desktop never displays manual service start/stop', () {
    expect(
      shouldShowSevenDeskManualServiceControls(web: false, installed: false),
      isFalse,
    );
  });

  test('installed desktop retains manual service recovery controls', () {
    expect(
      shouldShowSevenDeskManualServiceControls(web: false, installed: true),
      isTrue,
    );
  });

  test('web never displays OS service management', () {
    expect(
      shouldShowSevenDeskManualServiceControls(web: true, installed: true),
      isFalse,
    );
  });
}
