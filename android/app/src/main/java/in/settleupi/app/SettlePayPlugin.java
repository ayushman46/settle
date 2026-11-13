package in.settleupi.app;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/**
 * Paying from the Settle web app (src/lib/nativeApp.ts), handed to the UPI app on this phone:
 * apps() — which of Google Pay, PhonePe, Paytm and BHIM are installed;
 * sendQr({ data, name, package }) — the payee's QR picture, straight to that app, which opens on
 * the payment with the UPI ID and amount filled in (UPI's "QR share & pay", up to ₹2,000 to a person);
 * open({ package }) — the app's home screen (after the UPI ID was copied, for bigger amounts).
 * Settle never moves money: the UPI app does, after its own PIN.
 */
@CapacitorPlugin(name = "SettlePay")
public class SettlePayPlugin extends Plugin {

    private static final String[][] APPS = {
        { "gpay", "com.google.android.apps.nbu.paisa.user" },
        { "phonepe", "com.phonepe.app" },
        { "paytm", "net.one97.paytm" },
        { "bhim", "in.org.npci.upiapp" },
    };

    private boolean known(String pkg) {
        if (pkg == null) return false;
        for (String[] app : APPS) if (app[1].equals(pkg)) return true;
        return false;
    }

    private boolean installed(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    @PluginMethod
    public void apps(PluginCall call) {
        JSArray list = new JSArray();
        for (String[] app : APPS) if (installed(app[1])) list.put(app[0]);
        JSObject out = new JSObject();
        out.put("apps", list);
        call.resolve(out);
    }

    @PluginMethod
    public void open(PluginCall call) {
        String pkg = call.getString("package");
        if (!known(pkg)) {
            call.reject("Unknown app");
            return;
        }
        Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
        if (launch == null) {
            call.reject("Not installed");
            return;
        }
        try {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(launch);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the app");
        }
    }

    @PluginMethod
    public void sendQr(PluginCall call) {
        String pkg = call.getString("package");
        String data = call.getString("data");
        if (!known(pkg) || data == null) {
            call.reject("Nothing to send");
            return;
        }
        if (!installed(pkg)) {
            call.reject("Not installed");
            return;
        }
        try {
            File dir = new File(getContext().getCacheDir(), "pay");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No cache folder");
            // One file, overwritten each time: nothing piles up on the phone.
            File file = new File(dir, "settle-qr.png");
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri("QR", uri));
            send.setPackage(pkg);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(send);
            call.resolve();
        } catch (Exception e) {
            // The app doesn't take a shared picture (or isn't there): the page falls back to the UPI ID.
            call.reject("Could not hand the QR to the app");
        }
    }
}
