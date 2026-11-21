import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'package:window_size/window_size.dart' as window_size;

Future<void> setWindowsCmWindowBounds(Size size, {
  bool bottomRight = false,
  bool centered = false,
}) async {
  window_size.PlatformWindow? window;
  try {
    window = await window_size.getWindowInfo();
  } catch (e) {
    debugPrint('Failed to get the CM window screen: $e');
  }
  final screen = window?.screen;
  if (window == null || screen == null) {
    await windowManager.setSizeAlignment(
      size,
      centered
          ? Alignment.center
          : bottomRight
              ? Alignment.bottomRight
              : Alignment.topRight,
    );
    return;
  }

  // Window bounds and screen frame use physical pixels on Windows.
  final scaledSize = size * window.scaleFactor;
  final width = scaledSize.width.clamp(1.0, screen.visibleFrame.width).toDouble();
  final height = scaledSize.height.clamp(1.0, screen.visibleFrame.height).toDouble();
  final x = centered
      ? screen.visibleFrame.left + (screen.visibleFrame.width - width) / 2
      : screen.visibleFrame.right - width;
  final y = centered
      ? screen.visibleFrame.top + (screen.visibleFrame.height - height) / 2
      : bottomRight
          ? screen.visibleFrame.bottom - height - 12
          : screen.visibleFrame.top;

  await windowManager.setBounds(
    Rect.fromLTWH(x, y, width, height),
    ignoreDevicePixelRatio: true,
  );
}
