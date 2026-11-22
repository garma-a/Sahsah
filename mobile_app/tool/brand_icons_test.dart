// Draws the app icons and launch logos from the brand SVGs.
//
//   flutter test tool/brand_icons_test.dart
//
// It runs as a test only to borrow Flutter's renderer: the logo is drawn by
// flutter_svg, exactly as the app's own `Logo` draws it in the header. It
// sits in tool/, so a plain `flutter test` never runs it.
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

/// The website's theme colour (`layout.tsx`), the app's charcoal.
const charcoal = Color(0xFF2B3230);

/// The header's sticker tilt (`Logo` in `brand_art.dart`).
const tilt = -0.05;

const android = 'android/app/src/main/res';
const ios = 'ios/Runner/Assets.xcassets';

late PictureInfo logo; // the retro logo, in colour
late PictureInfo mark; // the website's one-colour mark

Future<PictureInfo> load(String path) =>
    vg.loadPicture(SvgStringLoader(File(path).readAsStringSync()), null);

/// Where [art] actually has ink, in its own units: the SVGs' view boxes
/// leave room around the lettering, which would put it off centre.
final _ink = <PictureInfo, Rect>{};
Future<Rect> inkOf(PictureInfo art) async {
  if (_ink[art] case final known?) return known;
  const probe = 512;
  final box = art.size;
  final k = probe / math.max(box.width, box.height);
  final recorder = ui.PictureRecorder();
  Canvas(recorder)
    ..scale(k)
    ..drawPicture(art.picture);
  final w = (box.width * k).ceil(), h = (box.height * k).ceil();
  final image = await recorder.endRecording().toImage(w, h);
  final px = (await image.toByteData())!; // RGBA
  var (l, t, r, b) = (w, h, 0, 0);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (px.getUint8((y * w + x) * 4 + 3) > 8) {
        (l, t) = (math.min(l, x), math.min(t, y));
        (r, b) = (math.max(r, x + 1), math.max(b, y + 1));
      }
    }
  }
  return _ink[art] = Rect.fromLTRB(l / k, t / k, r / k, b / k);
}

/// A [size]² image: optional [fill] (rounded by [radius], a fraction of the
/// side), then [art]'s ink centred, its longer side [scale] of the image,
/// tilted like a sticker.
Future<void> draw(
  String path,
  int size, {
  required PictureInfo art,
  required double scale,
  Color? fill,
  double radius = 0,
  ColorFilter? tint,
  double tiltBy = tilt,
  bool opaque = false,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final side = size.toDouble();
  if (fill != null) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Offset.zero & Size.square(side),
        Radius.circular(side * radius),
      ),
      Paint()..color = fill,
    );
  }
  final ink = await inkOf(art);
  final fit = side * scale / math.max(ink.width, ink.height);
  canvas
    ..save()
    ..translate(side / 2, side / 2)
    ..rotate(tiltBy)
    ..scale(fit)
    ..translate(-ink.center.dx, -ink.center.dy);
  if (tint != null) {
    canvas.saveLayer(Offset.zero & art.size, Paint()..colorFilter = tint);
  }
  canvas.drawPicture(art.picture);
  if (tint != null) canvas.restore();
  canvas.restore();

  final image = await recorder.endRecording().toImage(size, size);
  final List<int> bytes;
  if (opaque) {
    final rgba = (await image.toByteData())!.buffer.asUint8List();
    bytes = rgbPng(size, size, rgba);
  } else {
    final png = await image.toByteData(format: ui.ImageByteFormat.png);
    bytes = png!.buffer.asUint8List();
  }
  File(path)
    ..createSync(recursive: true)
    ..writeAsBytesSync(bytes);
}

/// A PNG with no alpha channel, which the App Store requires of app icons
/// (Flutter's encoder always writes one).
List<int> rgbPng(int width, int height, Uint8List rgba) {
  final rows = BytesBuilder();
  for (var y = 0; y < height; y++) {
    rows.addByte(0); // no filter
    for (var x = 0; x < width; x++) {
      final i = (y * width + x) * 4;
      rows.add(rgba.sublist(i, i + 3));
    }
  }
  List<int> chunk(String type, List<int> data) {
    final body = [...type.codeUnits, ...data];
    return [..._u32(data.length), ...body, ..._u32(_crc(body))];
  }

  final header = [..._u32(width), ..._u32(height), 8, 2, 0, 0, 0]; // RGB
  return [
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, //
    ...chunk('IHDR', header),
    ...chunk('IDAT', zlib.encode(rows.takeBytes())),
    ...chunk('IEND', []),
  ];
}

List<int> _u32(int v) => [v >> 24 & 255, v >> 16 & 255, v >> 8 & 255, v & 255];

int _crc(List<int> bytes) {
  var c = 0xFFFFFFFF;
  for (final b in bytes) {
    c ^= b;
    for (var k = 0; k < 8; k++) {
      c = c & 1 != 0 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return c ^ 0xFFFFFFFF;
}

void main() {
  testWidgets('draw the brand icons', (tester) async {
    await tester.runAsync(() async {
      logo = await load('assets/logo/logo-retro.svg');
      mark = await load('../web_app/frontend/src/app/icon.svg');

      // Android densities: the 48dp legacy icon and the 108dp adaptive layers.
      const dpi = {
        'mdpi': 1.0,
        'hdpi': 1.5,
        'xhdpi': 2.0,
        'xxhdpi': 3.0,
        'xxxhdpi': 4.0,
      };
      for (final MapEntry(key: name, value: x) in dpi.entries) {
        final dir = '$android/mipmap-$name';
        // Before Android 8: a rounded charcoal tile.
        await draw(
          '$dir/ic_launcher.png',
          (48 * x).round(),
          art: logo,
          scale: 0.7,
          fill: charcoal,
          radius: 0.22,
        );
        // Android 8+: the logo on its own layer, inside the 66dp safe circle
        // every launcher mask keeps; the charcoal is a colour resource.
        await draw(
          '$dir/ic_launcher_foreground.png',
          (108 * x).round(),
          art: logo,
          scale: 0.52,
        );
        // Android 13 themed icons: the website's one-colour mark.
        await draw(
          '$dir/ic_launcher_monochrome.png',
          (108 * x).round(),
          art: mark,
          scale: 0.46,
          tint: const ColorFilter.mode(Color(0xFFFFFFFF), BlendMode.srcIn),
        );
        // The launch screen before Android 12 (later ones show the icon).
        await draw(
          '$android/drawable-$name/launch_logo.png',
          (160 * x).round(),
          art: logo,
          scale: 0.9,
        );
      }

      // iOS: opaque squares (iOS rounds the corners itself).
      const iosIcons = {
        '20x20@1x': 20, '20x20@2x': 40, '20x20@3x': 60, //
        '29x29@1x': 29, '29x29@2x': 58, '29x29@3x': 87,
        '40x40@1x': 40, '40x40@2x': 80, '40x40@3x': 120,
        '60x60@2x': 120, '60x60@3x': 180,
        '76x76@1x': 76, '76x76@2x': 152, '83.5x83.5@2x': 167,
        '1024x1024@1x': 1024,
      };
      for (final MapEntry(key: name, value: size) in iosIcons.entries) {
        await draw(
          '$ios/AppIcon.appiconset/Icon-App-$name.png',
          size,
          art: logo,
          scale: 0.7,
          fill: charcoal,
          opaque: true,
        );
      }
      for (final (suffix, x) in [('', 1), ('@2x', 2), ('@3x', 3)]) {
        await draw(
          '$ios/LaunchImage.imageset/LaunchImage$suffix.png',
          160 * x,
          art: logo,
          scale: 0.9,
        );
      }
    });
  });
}
