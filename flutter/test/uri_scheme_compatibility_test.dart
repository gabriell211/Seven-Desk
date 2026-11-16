import 'package:flutter_hbb/models/model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('macOS accepts current and legacy support connection links', () {
    expect(
        acceptsConnectionUriScheme('sevendesk://123456789', 'sevendesk://',
            onMacOS: true),
        isTrue);
    expect(
        acceptsConnectionUriScheme('rustdesk://123456789', 'sevendesk://',
            onMacOS: true),
        isTrue);
  });

  test('legacy scheme is not added to other platforms or arbitrary URLs', () {
    expect(
        acceptsConnectionUriScheme('rustdesk://123456789', 'sevendesk://',
            onMacOS: false),
        isFalse);
    expect(
        acceptsConnectionUriScheme('rustdesk-fake://123456789', 'sevendesk://',
            onMacOS: true),
        isFalse);
    expect(
        acceptsConnectionUriScheme('https://example.com', 'sevendesk://',
            onMacOS: true),
        isFalse);
  });
}
