import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/desktop/widgets/remote_toolbar.dart';

void main() {
  test('native desktop always uses the Seven Desk session bubble', () {
    expect(
      shouldRenderSevenDeskSessionBubble(nativeDesktop: true, web: false),
      isTrue,
    );
  });

  test('web retains its existing controls until feature parity', () {
    expect(
      shouldRenderSevenDeskSessionBubble(nativeDesktop: true, web: true),
      isFalse,
    );
  });

  test('mobile does not render desktop session controls', () {
    expect(
      shouldRenderSevenDeskSessionBubble(nativeDesktop: false, web: false),
      isFalse,
    );
  });
}
