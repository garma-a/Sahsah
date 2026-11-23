import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../theme/app_theme.dart';
import 'surfaces.dart';

/// A QR code a phone can read from across the table: square, as big as its
/// box, dark ink on white with a quiet margin of four modules all round
/// (scanners need it) and medium error correction against glare. Null
/// [data] (still loading) draws the white card with a QR mark.
class ScanCode extends StatelessWidget {
  const ScanCode({
    super.key,
    required this.data,
    required this.semanticLabel,
    this.codeKey,
  });

  final String? data;
  final String semanticLabel;

  /// Keys the white card (tests measure it).
  final Key? codeKey;

  /// The white margin as a share of the code's side: four modules of a
  /// version 6–8 code (41–49 modules), the size a game link comes to.
  static const _quiet = 0.085;

  @override
  Widget build(BuildContext context) {
    final value = data;
    return Semantics(
      label: semanticLabel,
      excludeSemantics: true,
      child: Center(
        child: AspectRatio(
          aspectRatio: 1,
          child: LayoutBuilder(
            builder: (context, box) => Container(
              key: codeKey,
              padding: EdgeInsets.all(box.maxWidth * _quiet),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.ink, width: 3),
                boxShadow: [inkDrop(5)],
              ),
              child: value == null
                  ? const Center(
                      child: Icon(
                        LucideIcons.qrCode,
                        size: 40,
                        color: AppColors.inkMuted,
                      ),
                    )
                  : QrImageView(
                      data: value,
                      padding: EdgeInsets.zero,
                      backgroundColor: Colors.white,
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: AppColors.ink,
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: AppColors.ink,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
