package in.settleupi.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * "Money received" alerts waiting for Settle to read them (it reads them, and empties this, each
 * time it opens). Kept in the app's private storage, never anywhere else: at most 100, none older
 * than 30 days, and the same alert re-posted by its app is kept once.
 */
final class PaymentAlertsStore {

    private static final String PREFS = "settle_payment_alerts";
    private static final String QUEUE = "queue";
    private static final String SMS = "sms";
    private static final int MAX_ALERTS = 100;
    private static final long MAX_AGE_MS = 30L * 24 * 60 * 60 * 1000;
    /** An app re-posting the same alert within this window is one alert. */
    private static final long REPOST_MS = 10L * 60 * 1000;

    private PaymentAlertsStore() {}

    static final class Alert {
        final String id;
        final String app;
        final String title;
        final String text;
        final long postedAt;

        Alert(String id, String app, String title, String text, long postedAt) {
            this.id = id;
            this.app = app;
            this.title = title;
            this.text = text;
            this.postedAt = postedAt;
        }

        JSONObject toJson() throws JSONException {
            JSONObject json = new JSONObject();
            json.put("id", id);
            json.put("app", app);
            json.put("title", title);
            json.put("text", text);
            json.put("postedAt", postedAt);
            return json;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray read(SharedPreferences prefs) {
        try {
            return new JSONArray(prefs.getString(QUEUE, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Keeps an alert; false when it was already kept (the app re-posted it). */
    static synchronized boolean add(Context context, Alert alert) {
        SharedPreferences prefs = prefs(context);
        JSONArray queue = read(prefs);
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        try {
            for (int i = 0; i < queue.length(); i++) {
                JSONObject old = queue.getJSONObject(i);
                if (now - old.optLong("postedAt") > MAX_AGE_MS) continue;
                boolean same = old.optString("app").equals(alert.app) && old.optString("title").equals(alert.title) && old.optString("text").equals(alert.text);
                if (same && Math.abs(old.optLong("postedAt") - alert.postedAt) < REPOST_MS) return false;
                kept.put(old);
            }
            kept.put(alert.toJson());
            JSONArray trimmed = new JSONArray();
            for (int i = Math.max(0, kept.length() - MAX_ALERTS); i < kept.length(); i++) trimmed.put(kept.get(i));
            prefs.edit().putString(QUEUE, trimmed.toString()).apply();
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    /** Every waiting alert, oldest first; the queue is emptied. */
    static synchronized JSONArray drain(Context context) {
        SharedPreferences prefs = prefs(context);
        JSONArray queue = read(prefs);
        prefs.edit().putString(QUEUE, "[]").apply();
        return queue;
    }

    static boolean readsSms(Context context) {
        return prefs(context).getBoolean(SMS, false);
    }

    static void setReadsSms(Context context, boolean on) {
        prefs(context).edit().putBoolean(SMS, on).apply();
    }

    /** Forgets everything waiting (Settle's "Turn off" or "Delete all data"). */
    static synchronized void clear(Context context) {
        prefs(context).edit().putString(QUEUE, "[]").apply();
    }
}
