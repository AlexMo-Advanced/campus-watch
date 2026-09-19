package expo.modules.livenotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LiveNotificationsModule : Module() {
  private val NOTIFICATION_ID = 1001
  private val CHANNEL_ID = "live_notifications_channel"

  override fun definition() = ModuleDefinition {
    Name("LiveNotifications")

    Function("startLiveNotification") { title: String, content: String, data: Map<String, Any>? ->
      val context = appContext.reactContext ?: return@Function null
      createNotificationChannel(context)

      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        // Add extras based on data, e.g. target screen
        data?.let {
          if (it.containsKey("screen")) {
            putExtra("screen", it["screen"] as String)
          }
        }
      }
      
      val pendingIntent: PendingIntent = PendingIntent.getActivity(
        context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(content)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setOngoing(true)
        .setContentIntent(pendingIntent)

      // Emulate Android 16 Now Bar / Promoted Ongoing Notification
      // Since Android 15/16 promoted APIs are very new, we set standard Ongoing flags
      // and standard category which behaves closely in the system UI.
      builder.setCategory(NotificationCompat.CATEGORY_STATUS)

      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.notify(NOTIFICATION_ID, builder.build())
      null
    }

    Function("updateLiveNotification") { content: String, data: Map<String, Any>? ->
      val context = appContext.reactContext ?: return@Function null
      
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        data?.let {
          if (it.containsKey("screen")) {
            putExtra("screen", it["screen"] as String)
          }
        }
      }
      
      val pendingIntent: PendingIntent = PendingIntent.getActivity(
        context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle("CampusWatch Update") // Can optionally pass title
        .setContentText(content)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setOngoing(true)
        .setContentIntent(pendingIntent)
        .setCategory(NotificationCompat.CATEGORY_STATUS)

      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.notify(NOTIFICATION_ID, builder.build())
      null
    }

    Function("endLiveNotification") {
      val context = appContext.reactContext ?: return@Function null
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.cancel(NOTIFICATION_ID)
      null
    }
  }

  private fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val name = "Live Updates"
      val descriptionText = "Ongoing updates for CampusWatch"
      val importance = NotificationManager.IMPORTANCE_HIGH
      val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
        description = descriptionText
        // Minimize sound for ongoing updates if desired
        setSound(null, null)
      }
      val notificationManager: NotificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }
}
