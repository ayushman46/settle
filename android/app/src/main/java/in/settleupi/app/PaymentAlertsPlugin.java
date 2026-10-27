package in.settleupi.app;

import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONException;

/**
 * What the Settle web app asks the phone for Auto-settle (src/lib/nativeApp.ts):
 * status() — is notification access on, and are bank SMS alerts included;
 * openSettings() — the system page where you allow (or stop) it;
 * setOptions({ sms }) — include bank SMS alerts or not;
 * drain() — the "money received" alerts since last time (and forget them);
 * clear() — forget everything waiting.
 * An "alert" event fires when one arrives while Settle is open.
 */
@CapacitorPlugin(name = "PaymentAlerts")
public class PaymentAlertsPlugin extends Plugin {

    private static WeakReference<PaymentAlertsPlugin> open = new WeakReference<>(null);

    @Override
    public void load() {
        open = new WeakReference<>(this);
    }

    /** Called by the listener: Settle is open, so it can tick them off now. */
    static void tell(PaymentAlertsStore.Alert alert) {
        PaymentAlertsPlugin plugin = open.get();
        if (plugin == null) return;
        try {
            plugin.notifyListeners("alert", JSObject.fromJSONObject(alert.toJson()));
        } catch (JSONException ignored) {
            // The next drain() picks it up.
        }
    }

    private boolean granted() {
        return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", granted());
        result.put("sms", PaymentAlertsStore.readsSms(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Straight to Settle's own switch.
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            intent.putExtra(
                Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                new ComponentName(getContext(), PaymentAlertsListener.class).flattenToString()
            );
        } else {
            intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (RuntimeException e) {
            // Some phones lack the detail page: the list of apps instead.
            Intent list = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            list.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(list);
        }
        call.resolve();
    }

    @PluginMethod
    public void setOptions(PluginCall call) {
        Boolean sms = call.getBoolean("sms");
        if (sms != null) PaymentAlertsStore.setReadsSms(getContext(), sms);
        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        JSObject result = new JSObject();
        try {
            result.put("alerts", new JSArray(PaymentAlertsStore.drain(getContext()).toString()));
        } catch (JSONException e) {
            result.put("alerts", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        PaymentAlertsStore.clear(getContext());
        call.resolve();
    }
}
