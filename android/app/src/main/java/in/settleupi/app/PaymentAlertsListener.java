package in.settleupi.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Auto-settle's ears: when a UPI app (or, if you allowed it, your SMS app showing a bank alert)
 * says money arrived, the alert is kept on this phone until Settle reads it and ticks off whoever
 * paid. Everything else is looked at once, in memory, and dropped — nothing is stored or sent.
 *
 * Only these apps are listened to. The package name of a notification is the app that really
 * posted it, so another app can't fake a "received" alert from Google Pay.
 */
public class PaymentAlertsListener extends NotificationListenerService {

    /** UPI apps that post "received ₹… from …" alerts (as the open-source UPI soundboxes list them). */
    static final Set<String> UPI_APPS = Set.of(
        "com.google.android.apps.nbu.paisa.user", // Google Pay
        "com.phonepe.app", // PhonePe
        "net.one97.paytm", // Paytm
        "in.org.npci.upiapp", // BHIM
        "in.amazon.mShop.android.shopping", // Amazon Pay
        "com.mobikwik_new", // MobiKwik
        "com.dreamplug.androidapp" // CRED
    );

    /** SMS apps, for banks' "credited" alerts — only when you turned that on in Settle. */
    static final Set<String> SMS_APPS = Set.of(
        "com.google.android.apps.messaging", // Google Messages
        "com.samsung.android.messaging", // Samsung Messages
        "com.android.mms", // Xiaomi, Realme, Oppo, Vivo and others
        "com.android.messaging", // AOSP
        "com.oneplus.mms", // OnePlus
        "com.truecaller" // Truecaller
    );

    /** An amount of money: ₹420, Rs.420, Rs 420.50, INR 420. */
    private static final Pattern MONEY = Pattern.compile("(?i)(₹|\\brs\\.?|\\binr)\\s?\\d");
    /** Money coming in. */
    private static final Pattern MONEY_IN = Pattern.compile("(?i)\\b(received|credited|deposited|paid you|sent you|added to)\\b|प्राप्त|जमा");
    /** Never kept, whatever else they say. */
    private static final Pattern SECRET = Pattern.compile("(?i)\\b(otp|one[- ]time password|verification code|passcode|cvv|pin)\\b");

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String app = sbn.getPackageName();
            boolean upi = UPI_APPS.contains(app);
            boolean sms = SMS_APPS.contains(app) && PaymentAlertsStore.readsSms(this);
            if (!upi && !sms) return;
            Notification notification = sbn.getNotification();
            if (notification == null || (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle extras = notification.extras;
            if (extras == null) return;
            String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
            String big = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String body = big.isEmpty() ? text(extras.getCharSequence(Notification.EXTRA_TEXT)) : big;
            String all = title + "\n" + body;
            if (!MONEY.matcher(all).find() || !MONEY_IN.matcher(all).find() || SECRET.matcher(all).find()) return;
            PaymentAlertsStore.Alert alert = new PaymentAlertsStore.Alert(sbn.getKey() + "@" + sbn.getPostTime(), app, title, body, sbn.getPostTime());
            if (PaymentAlertsStore.add(this, alert)) PaymentAlertsPlugin.tell(alert);
        } catch (RuntimeException ignored) {
            // A notification Settle can't read is one it doesn't need.
        }
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }
}
