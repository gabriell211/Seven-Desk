import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'package:window_size/window_size.dart' as window_size;

Future<void> setWindowsCmWindowBounds(Size size, {bool bottomRight = false}) async {
  window_size.PlatformWindow? window;
  try {
    window = await window_size.getWindowInfo();
  } catch (e) {
    debugPrint('Failed to get the CM window screen: $e');
  }
  final screen = window?.screen;
  if (window == null || screen == null) {
    await windowManager.setSizeAlignment(
        size, bottomRight ? Alignment.bottomRight : Alignment.topRight);
    return;
  }

  // Keep monitor coordinates and window dimensions in physical pixels.
  final scaledSize = size * window.scaleFactor;
  await windowManager.setBounds(
    Rect.fromLTWH(
      screen.visibleFrame.right - scaledSize.width,
      bottomRight
          ? screen.visibleFrame.bottom - scaledSize.height - 12
          : screen.visibleFrame.top,
      scaledSize.width,
      scaledSize.height,
    ),
    ignoreDevicePixelRatio: true,
  );
}
