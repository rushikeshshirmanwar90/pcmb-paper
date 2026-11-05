package expo.modules.examsecurity

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Two exam-only Android calls that React Native doesn't expose. Both are
 * switched on when a test starts and off when it ends (see exam-guard.ts).
 * The window flag dies with the activity, so there is nothing to clean up here.
 */
class ExamSecurityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExamSecurity")

    // Activity.isInMultiWindowMode: split-screen, freeform window or picture-in-picture.
    Function("isInMultiWindow") {
      appContext.currentActivity?.isInMultiWindowMode ?: false
    }

    // Window.setHideOverlayWindows (Android 12+): while our window is visible, other apps'
    // TYPE_APPLICATION_OVERLAY windows (floating bubbles, draw-over-apps) are hidden.
    // Returns false where it can't be done (older Android, no activity, permission missing).
    Function("setOverlayProtection") { on: Boolean ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function false
      val activity = appContext.currentActivity ?: return@Function false
      try {
        activity.runOnUiThread { activity.window.setHideOverlayWindows(on) }
        true
      } catch (_: SecurityException) {
        false
      }
    }
  }
}
