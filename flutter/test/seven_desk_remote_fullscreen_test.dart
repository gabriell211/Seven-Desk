import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_hbb/desktop/pages/remote_page.dart';

void main() {
  test('does not enter fullscreen while client approval is pending', () {
    expect(
      shouldEnterSevenDeskRemoteFullscreen(
        nativeDesktop: true,
        firstFrameReady: false,
        alreadyEntered: false,
      ),
      isFalse,
    );
  });

  test('enters fullscreen once after the first frame arrives', () {
    expect(
      shouldEnterSevenDeskRemoteFullscreen(
        nativeDesktop: true,
        firstFrameReady: true,
        alreadyEntered: false,
      ),
      isTrue,
    );
    expect(
      shouldEnterSevenDeskRemoteFullscreen(
        nativeDesktop: true,
        firstFrameReady: true,
        alreadyEntered: true,
      ),
      isFalse,
    );
  });

  test('never forces fullscreen for web or mobile', () {
    expect(
      shouldEnterSevenDeskRemoteFullscreen(
        nativeDesktop: false,
        firstFrameReady: true,
        alreadyEntered: false,
      ),
      isFalse,
    );
  });
}
