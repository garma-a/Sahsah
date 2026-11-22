import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

/// An image decoded just big enough to cover a box of [width] × [height]
/// physical pixels, keeping its proportions: what [BoxFit.cover] then
/// shows, without decoding the full file. (Flutter's [ResizeImage] can fit
/// inside a box, not cover it.) Never scales up.
@immutable
class CoverImage extends ImageProvider<CoverImageKey> {
  const CoverImage(this.image, {required this.width, required this.height});

  final ImageProvider<Object> image;
  final int width;
  final int height;

  /// The decoded size for a source of [sourceWidth] × [sourceHeight].
  static ({int width, int height}) targetFor(
    int sourceWidth,
    int sourceHeight,
    int boxWidth,
    int boxHeight,
  ) {
    final scale = math.max(boxWidth / sourceWidth, boxHeight / sourceHeight);
    if (scale >= 1) return (width: sourceWidth, height: sourceHeight);
    return (
      width: (sourceWidth * scale).ceil(),
      height: (sourceHeight * scale).ceil(),
    );
  }

  @override
  Future<CoverImageKey> obtainKey(ImageConfiguration configuration) async =>
      CoverImageKey(await image.obtainKey(configuration), width, height);

  @override
  ImageStreamCompleter loadImage(
    CoverImageKey key,
    ImageDecoderCallback decode,
  ) {
    Future<ui.Codec> decodeToCover(
      ui.ImmutableBuffer buffer, {
      ui.TargetImageSizeCallback? getTargetSize,
    }) => decode(
      buffer,
      getTargetSize: (w, h) {
        final t = targetFor(w, h, width, height);
        return ui.TargetImageSize(width: t.width, height: t.height);
      },
    );
    return image.loadImage(key.inner, decodeToCover);
  }
}

@immutable
class CoverImageKey {
  const CoverImageKey(this.inner, this.width, this.height);

  final Object inner;
  final int width;
  final int height;

  @override
  bool operator ==(Object other) =>
      other is CoverImageKey &&
      other.inner == inner &&
      other.width == width &&
      other.height == height;

  @override
  int get hashCode => Object.hash(inner, width, height);
}

/// An asset shown with [BoxFit.cover], decoded at the size it's drawn
/// rather than the file's full size (a 1800px cover in a 40px thumbnail
/// otherwise takes 7MB of memory). Sizes round up to 64px steps, so
/// nearby boxes share one decoded copy.
class CoverAsset extends StatelessWidget {
  const CoverAsset(
    this.asset, {
    super.key,
    this.alignment = Alignment.center,
    this.width,
    this.height,
    this.errorBuilder,
  });

  final String asset;
  final AlignmentGeometry alignment;
  final double? width;
  final double? height;
  final ImageErrorWidgetBuilder? errorBuilder;

  static int _step(double px) => math.max(64, (px / 64).ceil() * 64);

  @override
  Widget build(BuildContext context) {
    final ratio = MediaQuery.devicePixelRatioOf(context);
    return SizedBox(
      width: width,
      height: height,
      child: LayoutBuilder(
        builder: (context, box) {
          final w = box.hasBoundedWidth ? box.maxWidth : (width ?? 512);
          final h = box.hasBoundedHeight ? box.maxHeight : (height ?? 512);
          return Image(
            image: CoverImage(
              AssetImage(asset),
              width: _step(w * ratio),
              height: _step(h * ratio),
            ),
            fit: BoxFit.cover,
            alignment: alignment,
            width: double.infinity,
            height: double.infinity,
            errorBuilder: errorBuilder,
          );
        },
      ),
    );
  }
}
