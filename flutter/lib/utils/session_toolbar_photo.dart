import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show compute;
import 'package:image/image.dart' as img;

const sessionToolbarPhotoDataUriPrefix = 'data:image/png;base64,';
const _maxFileBytes = 12 * 1024 * 1024;
const _maxPixels = 32000000;
const _photoSize = 96;

Future<String> loadSessionToolbarPhoto(String path) =>
    compute(_readSessionToolbarPhoto, path);

String _readSessionToolbarPhoto(String path) {
  final file = File(path).openSync();
  try {
    final length = file.lengthSync();
    if (length > _maxFileBytes) {
      throw const FormatException('Toolbar photo file is too large');
    }
    return encodeSessionToolbarPhoto(file.readSync(length));
  } finally {
    file.closeSync();
  }
}

String encodeSessionToolbarPhoto(Uint8List bytes) {
  if (bytes.length < 12 || bytes.length > _maxFileBytes) {
    throw const FormatException('Invalid toolbar photo file size');
  }
  img.Decoder? decoder;
  for (final candidate in [
    img.JpegDecoder(),
    img.PngDecoder(),
    img.WebPDecoder(),
  ]) {
    if (candidate.isValidFile(bytes)) {
      decoder = candidate;
      break;
    }
  }
  if (decoder == null) {
    throw const FormatException('Unsupported toolbar photo format');
  }
  final info = decoder.startDecode(bytes);
  if (info == null ||
      info.width <= 0 ||
      info.height <= 0 ||
      info.height > _maxPixels ~/ info.width) {
    throw const FormatException('Invalid toolbar photo dimensions');
  }
  final image = decoder.decodeFrame(0);
  if (image == null) {
    throw const FormatException('Invalid toolbar photo');
  }
  final side = math.min(image.width, image.height);
  final crop = image.width == image.height
      ? image
      : img.copyCrop(
          image,
          x: (image.width - side) ~/ 2,
          y: (image.height - side) ~/ 2,
          width: side,
          height: side,
        );
  final square = img.copyResize(
    crop,
    width: _photoSize,
    height: _photoSize,
    interpolation: img.Interpolation.average,
  );
  final pixels =
      square.convert(format: img.Format.uint8, numChannels: 4).getBytes();
  final photo = img.Image.fromBytes(
    width: _photoSize,
    height: _photoSize,
    bytes: pixels.buffer,
    bytesOffset: pixels.offsetInBytes,
    order: img.ChannelOrder.rgba,
  );
  return '$sessionToolbarPhotoDataUriPrefix${base64Encode(img.encodePng(photo))}';
}
