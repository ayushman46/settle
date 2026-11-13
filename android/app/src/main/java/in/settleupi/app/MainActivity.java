package in.settleupi.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Settle in an Android shell: the web app, plus Auto-settle's payment alerts and paying through the UPI app on the phone. */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PaymentAlertsPlugin.class);
        registerPlugin(SettlePayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
