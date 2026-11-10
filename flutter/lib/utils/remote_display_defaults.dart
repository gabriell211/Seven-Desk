import 'package:flutter_hbb/consts.dart';

// Increase the version when migrating previously saved display settings again.
const String kSevenDeskDisplayDefaultsMigrationKey =
    'seven-desk-display-defaults-v1';

String? migratedRemoteViewStyle(String? current) =>
    current == kRemoteViewStyleOriginal ? kRemoteViewStyleAdaptive : null;

String? migratedRemoteScrollStyle(String? current) =>
    current == kRemoteScrollStyleAuto ? kRemoteScrollStyleBar : null;
