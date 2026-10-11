package app.lovable.p6d6906c6162c45aeb91047ebf987bb28;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(
    name = "FamilyHub",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class FamilyHubPlugin extends Plugin {
    private static FamilyHubPlugin instance;

    @Override
    public void load() {
        instance = this;
        Notifier.ensureChannels(getContext());
    }

    static void onNewToken(String token) {
        if (instance != null) {
            JSObject d = new JSObject();
            d.put("token", token);
            instance.notifyListeners("tokenRefresh", d, true);
        }
    }

    private boolean notificationsOn() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                JSObject r = new JSObject();
                r.put("token", task.getResult());
                call.resolve(r);
            } else {
                call.reject(task.getException() != null ? task.getException().getMessage() : "No token");
            }
        });
    }

    @PluginMethod
    public void deleteToken(PluginCall call) {
        FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(t -> call.resolve());
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !notificationsOn()) {
            requestPermissionForAlias("notifications", call, "permissionResult");
            return;
        }
        resolveGranted(call);
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) { resolveGranted(call); }

    private void resolveGranted(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", notificationsOn());
        call.resolve(r);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("notificationsGranted", notificationsOn());
        r.put("batteryUnrestricted", pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        r.put("exactAlarms", Notifier.canExact(ctx));
        r.put("manufacturer", Build.MANUFACTURER);
        call.resolve(r);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context ctx = getContext();
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
        try { getActivity().startActivity(i); }
        catch (Exception e) { getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context ctx = getContext();
        Intent i;
        if (Build.VERSION.SDK_INT >= 31 && !Notifier.canExact(ctx)) {
            i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.getPackageName()));
        } else {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        }
        getActivity().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void syncReminders(PluginCall call) {
        JSArray list = call.getArray("reminders", new JSArray());
        int n = Notifier.replaceAll(getContext(), list);
        JSObject r = new JSObject();
        r.put("scheduled", n);
        call.resolve(r);
    }
}
