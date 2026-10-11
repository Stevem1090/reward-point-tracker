package app.lovable.p6d6906c6162c45aeb91047ebf987bb28;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ReminderAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String taskId = intent.getStringExtra("taskId");
        if (taskId != null) Notifier.fireBackup(ctx, taskId);
    }
}
