# R8 rules for release builds. Flutter's Gradle plugin always adds this
# file to the release build's shrinking config (next to Android's
# optimised defaults and Flutter's own rules), so it must exist; a missing
# file fails `flutter build apk --release`.
#
# Plugins ship their own consumer rules. Add rules here only for code that
# R8 can't see is used (reflection, JNI) and the build or app proves it.
