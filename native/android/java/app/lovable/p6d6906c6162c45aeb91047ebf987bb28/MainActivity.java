package app.lovable.p6d6906c6162c45aeb91047ebf987bb28;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FamilyHubPlugin.class);
        super.onCreate(savedInstanceState);
        Notifier.ensureChannels(this);
        String url = urlFrom(getIntent());
        if (url != null && savedInstanceState == null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(Notifier.APP_ORIGIN + url));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String url = urlFrom(intent);
        if (url != null) {
            String js = "window.dispatchEvent(new CustomEvent('familyhub:open',{detail:" + JSONObject.quote(url) + "}))";
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
        }
    }

    private static String urlFrom(Intent intent) {
        if (intent == null) return null;
        String url = intent.getStringExtra(Notifier.EXTRA_URL);
        return url != null && url.startsWith("/") ? url : null;
    }
}
