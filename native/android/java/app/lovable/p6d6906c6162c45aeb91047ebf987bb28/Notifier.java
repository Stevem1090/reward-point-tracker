package app.lovable.p6d6906c6162c45aeb91047ebf987bb28;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Iterator;
import java.util.Map;
import org.json.JSONObject;

/** Builds every Family Hub notification and manages the on-phone backup reminders. */
public final class Notifier {
    public static final String APP_ORIGIN = "https://reward-point-tracker.lovable.app";
    public static final String EXTRA_URL = "familyhub_url";
    /** Backup fires this long after the due time, giving the normal notification first go. */
    public static final long BACKUP_DELAY_MS = 2 * 60 * 1000;
    private static final String PREFS = "familyhub_backup";
    private static final String KEY_BACKUPS = "backups";
    private static final String KEY_DELIVERED = "delivered";

    private Notifier() {}

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(channel("task_reminders", "Task reminders", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(channel("assigned_tasks", "Assigned tasks", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(channel("freezer_alerts", "Freezer alerts", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(channel("test", "Test notifications", NotificationManager.IMPORTANCE_DEFAULT));
    }

    private static NotificationChannel channel(String id, String name, int importance) {
        NotificationChannel c = new NotificationChannel(id, name, importance);
        c.enableVibration(true);
        c.setShowBadge(true);
        return c;
    }

    /** Same stable tag the server uses: "rem_" + base64url of the task UUID's 16 bytes. */
    public static String reminderTag(String taskId) {
        String hex = taskId.replace("-", "");
        if (hex.length() != 32) return "rem_" + taskId;
        byte[] b = new byte[16];
        for (int i = 0; i < 16; i++) b[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return "rem_" + Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private static PendingIntent openIntent(Context ctx, String url, int requestCode) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra(EXTRA_URL, url == null ? "/" : url);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void show(Context ctx, Map<String, String> d) {
        ensureChannels(ctx);
        String tag = nz(d.get("tag"), "fh");
        int id = tag.hashCode();
        String channel = nz(d.get("channel"), "task_reminders");
        String url = nz(d.get("url"), "/");
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_stat_family_hub)
            .setContentTitle(nz(d.get("title"), "Family Hub"))
            .setContentText(d.get("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(d.get("body")))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(openIntent(ctx, url, id));
        String taskId = d.get("taskId");
        String token = d.get("actionToken");
        String actionUrl = d.get("actionUrl");
        if (taskId != null && token != null && actionUrl != null) {
            Intent done = new Intent(ctx, MarkDoneReceiver.class);
            done.putExtra("taskId", taskId).putExtra("token", token).putExtra("actionUrl", actionUrl)
                .putExtra("tag", tag).putExtra("url", url).putExtra("title", d.get("title"));
            PendingIntent donePi = PendingIntent.getBroadcast(ctx, id, done, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.addAction(0, "Mark done", donePi);
        }
        if (taskId != null) b.addAction(0, "View task", openIntent(ctx, url, id + 1));
        try {
            NotificationManagerCompat.from(ctx).notify(tag, id, b.build());
        } catch (SecurityException e) {
            // Notification permission withdrawn; nothing we can show.
        }
    }

    public static void showSimple(Context ctx, String tag, String title, String body, String url) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, "task_reminders")
            .setSmallIcon(R.drawable.ic_stat_family_hub)
            .setContentTitle(title).setContentText(body)
            .setAutoCancel(true).setTimeoutAfter(url == null ? 4000 : 0)
            .setContentIntent(openIntent(ctx, url == null ? "/" : url, tag.hashCode()));
        try { NotificationManagerCompat.from(ctx).notify(tag, tag.hashCode(), b.build()); } catch (SecurityException ignored) {}
    }

    public static void dismiss(Context ctx, String tag) {
        if (tag == null || tag.isEmpty()) return;
        NotificationManagerCompat.from(ctx).cancel(tag, tag.hashCode());
    }

    // ---------- Backup reminders ----------

    private static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private static JSONObject read(Context ctx, String key) {
        try { return new JSONObject(prefs(ctx).getString(key, "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    private static void write(Context ctx, String key, JSONObject o) { prefs(ctx).edit().putString(key, o.toString()).apply(); }

    private static PendingIntent alarmIntent(Context ctx, String taskId, int flags) {
        Intent i = new Intent(ctx, ReminderAlarmReceiver.class).putExtra("taskId", taskId);
        return PendingIntent.getBroadcast(ctx, taskId.hashCode(), i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    public static boolean canExact(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    private static void setAlarm(Context ctx, String taskId, long dueAt) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        long at = dueAt + BACKUP_DELAY_MS;
        PendingIntent pi = alarmIntent(ctx, taskId, PendingIntent.FLAG_UPDATE_CURRENT);
        if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    public static synchronized void upsertBackup(Context ctx, String taskId, String title, String body, long dueAt, String url) {
        try {
            JSONObject all = read(ctx, KEY_BACKUPS);
            all.put(taskId, new JSONObject().put("title", title).put("body", body).put("dueAt", dueAt).put("url", url));
            write(ctx, KEY_BACKUPS, all);
            setAlarm(ctx, taskId, dueAt);
        } catch (Exception ignored) {}
    }

    public static synchronized void cancelBackup(Context ctx, String taskId) {
        JSONObject all = read(ctx, KEY_BACKUPS);
        all.remove(taskId);
        write(ctx, KEY_BACKUPS, all);
        PendingIntent pi = alarmIntent(ctx, taskId, PendingIntent.FLAG_NO_CREATE);
        if (pi != null) ((AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE)).cancel(pi);
    }

    /** Replaces every backup with the list from the app. */
    public static synchronized int replaceAll(Context ctx, org.json.JSONArray list) {
        JSONObject current = read(ctx, KEY_BACKUPS);
        Iterator<String> keys = current.keys();
        java.util.List<String> old = new java.util.ArrayList<>();
        while (keys.hasNext()) old.add(keys.next());
        for (String id : old) cancelBackup(ctx, id);
        int n = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONObject r = list.optJSONObject(i);
            if (r == null) continue;
            upsertBackup(ctx, r.optString("taskId"), r.optString("title"), r.optString("body"), r.optLong("dueAt"), r.optString("url", "/"));
            n++;
        }
        return n;
    }

    /** After a restart Android forgets alarms; put them back. */
    public static synchronized void rescheduleAll(Context ctx) {
        JSONObject all = read(ctx, KEY_BACKUPS);
        Iterator<String> keys = all.keys();
        while (keys.hasNext()) {
            String id = keys.next();
            JSONObject r = all.optJSONObject(id);
            if (r != null) setAlarm(ctx, id, r.optLong("dueAt"));
        }
    }

    /** The real notification arrived: remember it and drop the backup. */
    public static synchronized void markDelivered(Context ctx, String taskId, long dueAt) {
        try {
            JSONObject d = read(ctx, KEY_DELIVERED);
            d.put(taskId, dueAt);
            write(ctx, KEY_DELIVERED, d);
        } catch (Exception ignored) {}
        cancelBackup(ctx, taskId);
    }

    /** Called when a backup alarm fires. Shows it only if the real one never came. */
    public static synchronized void fireBackup(Context ctx, String taskId) {
        JSONObject r = read(ctx, KEY_BACKUPS).optJSONObject(taskId);
        if (r == null) return;
        long dueAt = r.optLong("dueAt");
        long delivered = read(ctx, KEY_DELIVERED).optLong(taskId, -1);
        cancelBackup(ctx, taskId);
        if (delivered == dueAt) return;
        java.util.HashMap<String, String> d = new java.util.HashMap<>();
        d.put("tag", reminderTag(taskId));
        d.put("channel", "task_reminders");
        d.put("title", r.optString("title"));
        d.put("body", r.optString("body"));
        d.put("url", r.optString("url", "/"));
        d.put("taskId", taskId);
        show(ctx, d);
    }

    private static String nz(String v, String fallback) { return v == null || v.isEmpty() ? fallback : v; }
}
