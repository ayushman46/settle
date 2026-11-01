package in.settleupi.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Settle's ears for money: alerts are kept on this phone until Settle reads them, and everything
 * else is looked at once, in memory, and dropped — nothing is stored or sent anywhere. Kept are:
 *
 * - From a UPI app, or (if you allowed it) your SMS app showing a bank alert: money arriving, for
 *   Auto-settle to tick off whoever paid; and a payment that failed, is pending, or came back
 *   (reversed, refunded), for Stuck money.
 * - From a UPI app: a payment that went through ("paid ₹500 to …", "payment successful"), only so
 *   Stuck money can clear one it was told was pending.
 * - From your SMS app (if you allowed it): money leaving your account, only so Stuck money can see
 *   that a failed payment really took it. Settle forgets these within two days.
 * - From the shops and travel apps below: refunds, for Stuck money. Nothing else from them.
 *
 * Only these apps are listened to. The package name of a notification is the app that really
 * posted it, so another app can't fake a "received" alert from Google Pay. OTPs, PINs and
 * passwords are never kept, whatever else they say.
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

    /** SMS apps, for banks' alerts — only when you turned that on in Settle. */
    static final Set<String> SMS_APPS = Set.of(
        "com.google.android.apps.messaging", // Google Messages
        "com.samsung.android.messaging", // Samsung Messages
        "com.android.mms", // Xiaomi, Realme, Oppo, Vivo and others
        "com.android.messaging", // AOSP
        "com.oneplus.mms", // OnePlus
        "com.truecaller" // Truecaller
    );

    /** Businesses' own apps, for their refund alerts only (package names as Google Play lists them). */
    static final Set<String> MERCHANT_APPS = Set.of(
        "com.flipkart.android", // Flipkart
        "in.swiggy.android", // Swiggy
        "com.application.zomato", // Zomato
        "com.myntra.android", // Myntra
        "com.grofers.customerapp", // Blinkit
        "com.zeptoconsumerapp", // Zepto
        "cris.org.in.prs.ima", // IRCTC Rail Connect
        "com.makemytrip", // MakeMyTrip
        "in.goindigo.android", // IndiGo
        "com.bets.airindia.ui" // Air India
    );

    /** An amount of money: ₹420, Rs.420, Rs 420.50, INR 420. */
    private static final Pattern MONEY = Pattern.compile("(?i)(₹|\\brs\\.?|\\binr)\\s?\\d");
    /** Money coming in. */
    private static final Pattern MONEY_IN = Pattern.compile("(?i)\\b(received|credited|deposited|paid you|sent you|added to)\\b|प्राप्त|जमा");
    /** A payment that failed, waits, or is coming back. */
    private static final Pattern STUCK = Pattern.compile("(?i)\\b(failed|failure|declined|unsuccessful|pending|processing|reversed|reversal|refunds?|refunded|credited back|will be refunded)\\b");
    /** Money going out of your account (bank SMS): only to pair with a failure. */
    private static final Pattern MONEY_OUT = Pattern.compile("(?i)\\b(debited|deducted|spent|sent|paid|withdrawn)\\b");
    /** A payment that went through (UPI apps): only to clear one that was pending. */
    private static final Pattern WENT_THROUGH = Pattern.compile("(?i)\\b(successful|successfully|paid|sent)\\b");
    /** A business's refund. */
    private static final Pattern REFUND = Pattern.compile("(?i)\\b(refunds?|refunded|reversed|reversal|credited back)\\b");
    /** Never kept, whatever else they say. */
    private static final Pattern SECRET = Pattern.compile("(?i)\\b(otp|one[- ]time password|verification code|passcode|cvv|pin)\\b");

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String app = sbn.getPackageName();
            boolean upi = UPI_APPS.contains(app);
            boolean sms = SMS_APPS.contains(app) && PaymentAlertsStore.readsSms(this);
            boolean merchant = MERCHANT_APPS.contains(app);
            if (!upi && !sms && !merchant) return;
            Notification notification = sbn.getNotification();
            if (notification == null || (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle extras = notification.extras;
            if (extras == null) return;
            String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
            String big = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String body = big.isEmpty() ? text(extras.getCharSequence(Notification.EXTRA_TEXT)) : big;
            String all = title + "\n" + body;
            if (!MONEY.matcher(all).find() || SECRET.matcher(all).find()) return;
            boolean keep = merchant
                ? REFUND.matcher(all).find()
                : MONEY_IN.matcher(all).find()
                    || STUCK.matcher(all).find()
                    || (sms && MONEY_OUT.matcher(all).find())
                    || (upi && WENT_THROUGH.matcher(all).find());
            if (!keep) return;
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
