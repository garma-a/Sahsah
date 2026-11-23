import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../game/ui/game_ui.dart';

/// The six-digit room code in what a QR holds: the host's join link
/// (`https://sa7sa7.cc/join/123456`) or the bare code. Null for anything
/// else.
String? joinCodeFrom(String raw) {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  final text = raw.trim().replaceAllMapped(
    RegExp('[٠-٩]'),
    (m) => '${arabic.indexOf(m[0]!)}',
  );
  if (RegExp(r'^\d{6}$').hasMatch(text)) return text;
  final uri = Uri.tryParse(text);
  if (uri == null || !uri.hasScheme) return null;
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  final at = segments.lastIndexOf('join');
  if (at < 0 || at + 1 >= segments.length) return null;
  final code = segments[at + 1];
  return RegExp(r'^\d{6}$').hasMatch(code) ? code : null;
}

/// How the join sheet scans: the phone's camera. Tests swap in an answer.
abstract final class JoinScanner {
  static Future<String?> Function(BuildContext context) scan = _camera;

  static Future<String?> _camera(BuildContext context) => Navigator.of(
    context,
  ).push<String>(MaterialPageRoute(builder: (_) => const ScanScreen()));
}

/// The camera on the host's QR: the first room code it reads pops as the
/// result.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _done = false;
  String? _wrong;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null) continue;
      final code = joinCodeFrom(raw);
      if (code != null) {
        _done = true;
        HapticFeedback.mediumImpact();
        Navigator.of(context).pop(code);
        return;
      }
      // A QR, but not a room's: say so, and keep looking.
      if (_wrong == null) {
        setState(() => _wrong = raw);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return GameScaffold(
      child: LayoutBuilder(
        builder: (context, box) {
          // The square the code is read in, centred.
          final side = (box.biggest.shortestSide * 0.62).clamp(180.0, 320.0);
          final window = Rect.fromCenter(
            center: box.biggest.center(Offset.zero),
            width: side,
            height: side,
          );
          return Stack(
            fit: StackFit.expand,
            children: [
              MobileScanner(
                controller: _controller,
                onDetect: _onDetect,
                scanWindow: window,
                errorBuilder: (context, error) => _CameraProblem(error: error),
              ),
              IgnorePointer(
                child: CustomPaint(painter: _WindowPainter(window)),
              ),
              Positioned(
                top: 12,
                left: 16,
                right: 16,
                child: Row(
                  children: [
                    RoundIconButton(
                      icon: lang.ar
                          ? LucideIcons.arrowRight
                          : LucideIcons.arrowLeft,
                      label: lang.t('رجوع', 'Rogoo3'),
                      onTap: () => Navigator.of(context).pop(),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        lang.t('امسح كود الغرفة', 'Emsa7 code el oda'),
                        style: AppText.display(26, height: 1.2),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 24,
                right: 24,
                bottom: 18,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.ink.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      _wrong == null
                          ? lang.t(
                              'وجّه الكاميرا على الكود اللي على شاشة المضيف',
                              'Wagge7 el camera 3al code elly 3ala shashet el host',
                            )
                          : lang.t(
                              'ده مش كود غرفة صحصح. جرّب كود المضيف.',
                              'Da mesh code oodet Sa7Sa7. Garrab code el host.',
                            ),
                      textAlign: TextAlign.center,
                      style: AppText.sans(
                        15,
                        weight: FontWeight.w700,
                        color: _wrong == null
                            ? AppColors.ivory
                            : AppColors.gold,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Dims everything but the reading window, and draws its corners.
class _WindowPainter extends CustomPainter {
  const _WindowPainter(this.window);

  final Rect window;

  @override
  void paint(Canvas canvas, Size size) {
    final frame = RRect.fromRectAndRadius(window, const Radius.circular(18));
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Offset.zero & size),
        Path()..addRRect(frame),
      ),
      Paint()..color = const Color(0x99000000),
    );
    final corner = Paint()
      ..color = AppColors.gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    const arm = 34.0;
    final r = window;
    for (final (p, dx, dy) in [
      (r.topLeft, 1.0, 1.0),
      (r.topRight, -1.0, 1.0),
      (r.bottomLeft, 1.0, -1.0),
      (r.bottomRight, -1.0, -1.0),
    ]) {
      canvas
        ..drawLine(p, p + Offset(arm * dx, 0), corner)
        ..drawLine(p, p + Offset(0, arm * dy), corner);
    }
  }

  @override
  bool shouldRepaint(_WindowPainter old) => old.window != window;
}

/// The camera can't be used: why, and the way around it.
class _CameraProblem extends StatelessWidget {
  const _CameraProblem({required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return ColoredBox(
      color: AppColors.deep,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.cameraOff,
                size: 40,
                color: AppColors.gold,
              ),
              const SizedBox(height: 12),
              Text(
                denied
                    ? lang.t(
                        'محتاجين الكاميرا عشان نمسح الكود. اسمح بيها من إعدادات الموبايل، أو ارجع واكتب الكود.',
                        'Me7tageen el camera 3ashan nemsa7 el code. Esma7 beha men e3dadat el mobile, aw erga3 w ekteb el code.',
                      )
                    : lang.t(
                        'الكاميرا مش شغالة دلوقتي. ارجع واكتب الكود بدل كده.',
                        'El camera mesh shaghala delwa2ty. Erga3 w ekteb el code badal keda.',
                      ),
                textAlign: TextAlign.center,
                style: AppText.sans(16, weight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
