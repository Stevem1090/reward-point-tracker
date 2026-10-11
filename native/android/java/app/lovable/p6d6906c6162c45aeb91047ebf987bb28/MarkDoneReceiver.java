package app.lovable.p6d6906c6162c45aeb91047ebf987bb28;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** "Mark done" button: completes the task in the background without opening the app. */
public class MarkDoneReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        final PendingResult pending = goAsync();
        final String taskId = intent.getStringExtra("taskId");
        final String token = intent.getStringExtra("token");
        final String actionUrl = intent.getStringExtra("actionUrl");
        final String tag = intent.getStringExtra("tag");
        final String url = intent.getStringExtra("url");
        final String title = intent.getStringExtra("title");
        new Thread(() -> {
            boolean ok = false;
            for (int attempt = 0; attempt < 3 && !ok; attempt++) {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(actionUrl).openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(8000);
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/json");
                    byte[] body = new JSONObject().put("taskId", taskId).put("token", token).toString().getBytes(StandardCharsets.UTF_8);
                    try (OutputStream os = c.getOutputStream()) { os.write(body); }
                    int code = c.getResponseCode();
                    ok = code >= 200 && code < 300;
                    c.disconnect();
                    if (code == 401) break; // expired action, retrying won't help
                } catch (Exception e) {
                    try { Thread.sleep(1500); } catch (InterruptedException ignored) {}
                }
            }
            try {
                if (ok) {
                    Notifier.dismiss(ctx, tag);
                    Notifier.cancelBackup(ctx, taskId);
                    Notifier.showSimple(ctx, "done_" + taskId, "Done ✓", title == null ? "Task completed" : title, null);
                } else {
                    Notifier.dismiss(ctx, tag);
                    Notifier.showSimple(ctx, tag, "Couldn't mark done – tap to open", title == null ? "" : title, url);
                }
            } finally {
                pending.finish();
            }
        }).start();
    }
}
