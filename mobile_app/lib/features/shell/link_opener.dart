import 'package:url_launcher/url_launcher.dart';

/// Opens an external link (socials) in the system browser or app.
Future<void> openExternal(String url) async {
  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
}
