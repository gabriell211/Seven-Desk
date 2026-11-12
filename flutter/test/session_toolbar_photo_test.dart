import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_hbb/utils/session_toolbar_photo.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

void main() {
  test('saves a centered, square avatar with transparency', () {
    final source = img.Image(width: 144, height: 96, numChannels: 4);
    for (var y = 0; y < source.height; y++) {
      for (var x = 0; x < source.width; x++) {
        final inside = x >= 24 && x < 120;
        source.setPixelRgba(x, y, inside ? 0 : 255, 0, inside ? 255 : 0, 128);
      }
    }

    final encoded = encodeSessionToolbarPhoto(img.encodePng(source));
    expect(encoded, startsWith(sessionToolbarPhotoDataUriPrefix));
    final photo = img.decodePng(
      base64Decode(encoded.substring(sessionToolbarPhotoDataUriPrefix.length)),
    )!;

    expect((photo.width, photo.height), (96, 96));
    final corner = photo.getPixel(0, 0);
    expect((corner.r, corner.b, corner.a), (0, 255, 128));
  });

  test('rejects non-image input', () {
    expect(
      () => encodeSessionToolbarPhoto(Uint8List.fromList([1, 2, 3, 4])),
      throwsFormatException,
    );
  });
}
