package in.settleupi.app;

import android.content.Intent;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Files out of the app, where a WebView can't do it alone (src/share/shareFile.ts, src/lib/nativeApp.ts):
 * share({ data, name, mime, text?, title? }) — the file (base64) through Android's share sheet
 * (save to Files or Drive, send on WhatsApp); print({ title? }) — the page through Android's print
 * service (or "Save as PDF"). Shared files live in the app's cache, in a folder emptied each time.
 */
@CapacitorPlugin(name = "SettleFiles")
public class SettleFilesPlugin extends Plugin {

    private static final String FOLDER = "shared-files";
    /** The most a shared file may be (a backup or a receipt image is far smaller). */
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void share(PluginCall call) {
        String data = call.getString("data");
        String name = safeName(call.getString("name", "settle"));
        String mime = call.getString("mime", "application/octet-stream");
        if (data == null) {
            call.reject("No file");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (bytes.length > MAX_BYTES) {
                call.reject("Too big");
                return;
            }
            File folder = new File(getContext().getCacheDir(), FOLDER);
            File[] old = folder.listFiles();
            if (old != null) for (File f : old) f.delete();
            if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("No folder");
            File file = new File(folder, name);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text");
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, call.getString("title", name));
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (IOException | IllegalArgumentException e) {
            call.reject("Couldn't share the file");
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        String title = call.getString("title", "Settle");
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager manager = (PrintManager) getActivity().getSystemService(android.content.Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(title);
                manager.print(title, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                call.resolve();
            } catch (RuntimeException e) {
                call.reject("Couldn't print");
            }
        });
    }

    /** A file name without folders or odd characters. */
    private static String safeName(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", "-").trim();
        return cleaned.isEmpty() ? "settle" : cleaned;
    }
}
