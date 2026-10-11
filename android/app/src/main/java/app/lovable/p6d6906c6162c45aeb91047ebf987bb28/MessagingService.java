package app.lovable.p6d6906c6162c45aeb91047ebf987bb28;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Receives every push (app open, closed or dozing) and decides what to show. */
public class MessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> d = message.getData();
        String type = d.get("type");
        String taskId = d.get("taskId");
        if ("sync".equals(type) && taskId != null) {
            long dueAt = parse(d.get("dueAt"));
            if (dueAt > System.currentTimeMillis()) Notifier.upsertBackup(this, taskId, d.get("title"), d.get("body"), dueAt, d.get("url"));
            else Notifier.cancelBackup(this, taskId);
        } else if ("cancel".equals(type) && taskId != null) {
            Notifier.cancelBackup(this, taskId);
            Notifier.dismiss(this, d.get("tag"));
        } else {
            if (taskId != null && "taskReminder".equals(d.get("kind"))) Notifier.markDelivered(this, taskId, parse(d.get("dueAt")));
            Notifier.show(this, d);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        FamilyHubPlugin.onNewToken(token);
    }

    private static long parse(String v) {
        try { return v == null || v.isEmpty() ? 0 : Long.parseLong(v); } catch (NumberFormatException e) { return 0; }
    }
}
