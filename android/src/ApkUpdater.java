package com.fravier3.calendarfam.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ApkUpdater {
    private static final String REPOSITORY = "https://raw.githubusercontent.com/Fravier3/calendarFam/refs/heads/main/";
    private static final int SOURCES_REQUEST = 201;
    private static final int MAX_APK_BYTES = 65 * 1024 * 1024;
    private static final long CHECK_INTERVAL = 30 * 60 * 1000L;

    private final Activity activity;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private long checkedAt = -CHECK_INTERVAL;
    private int offeredVersion;
    private Release awaitingPermission;
    private boolean installing;

    ApkUpdater(Activity activity) {
        this.activity = activity;
    }

    void check() {
        long now = SystemClock.elapsedRealtime();
        if (installing || now - checkedAt < CHECK_INTERVAL) return;
        checkedAt = now;
        worker.execute(() -> {
            try {
                Release release = fetchRelease();
                if (release.code > installedPackage().versionCode) {
                    activity.runOnUiThread(() -> offer(release));
                }
            } catch (Exception ignored) {
                // CalendarFam works normally while the update service is unreachable.
            }
        });
    }

    private void offer(Release release) {
        if (activity.isFinishing() || activity.isDestroyed() || offeredVersion == release.code) return;
        offeredVersion = release.code;
        new AlertDialog.Builder(activity)
            .setTitle("Actualización disponible")
            .setMessage("Ya puedes instalar CalendarFam TV " + release.version + ".")
            .setNegativeButton("Más tarde", (dialog, which) -> {})
            .setPositiveButton("Actualizar", (dialog, which) -> requestInstall(release))
            .show();
    }

    private void requestInstall(Release release) {
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            awaitingPermission = release;
            try {
                activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName())), SOURCES_REQUEST);
            } catch (RuntimeException unavailable) {
                awaitingPermission = null;
                toast("Activa «Instalar apps desconocidas» para CalendarFam en los ajustes de la TV.");
            }
            return;
        }
        install(release);
    }

    void activityResult(int requestCode) {
        if (requestCode != SOURCES_REQUEST || awaitingPermission == null) return;
        Release release = awaitingPermission;
        awaitingPermission = null;
        if (Build.VERSION.SDK_INT >= 26 && activity.getPackageManager().canRequestPackageInstalls()) {
            install(release);
        } else {
            offeredVersion = 0;
            checkedAt = -CHECK_INTERVAL;
        }
    }

    private void install(Release release) {
        if (installing) return;
        installing = true;
        toast("Descargando actualización…");
        worker.execute(() -> {
            File apk = null;
            try {
                apk = File.createTempFile("calendarfam-update-", ".apk", activity.getCacheDir());
                download(release, apk);
                verifyPackage(release, apk);
                commit(apk);
            } catch (Exception failure) {
                activity.runOnUiThread(() -> {
                    offeredVersion = 0;
                    checkedAt = -CHECK_INTERVAL;
                    toast("No se pudo preparar la actualización. Vuelve a abrir CalendarFam para intentar de nuevo.");
                });
            } finally {
                if (apk != null) apk.delete();
                activity.runOnUiThread(() -> installing = false);
            }
        });
    }

    private static Release fetchRelease() throws Exception {
        HttpURLConnection connection = open("android/tv-update.json");
        try (InputStream stream = connection.getInputStream();
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            copy(stream, bytes, 8192, null);
            JSONObject value = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            return new Release(value.getInt("versionCode"), value.getString("versionName"),
                value.getString("file"), value.getString("sha256"));
        } finally {
            connection.disconnect();
        }
    }

    private static HttpURLConnection open(String path) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(REPOSITORY + path).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(20000);
        connection.setUseCaches(false);
        connection.setInstanceFollowRedirects(false);
        if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
            connection.disconnect();
            throw new IOException("Update is not accessible");
        }
        return connection;
    }

    private static void copy(InputStream input, OutputStream output, int limit, MessageDigest digest)
            throws IOException {
        byte[] buffer = new byte[32768];
        int size = 0;
        for (int read; (read = input.read(buffer)) != -1;) {
            size += read;
            if (size > limit) throw new IOException("Update exceeds the download limit");
            output.write(buffer, 0, read);
            if (digest != null) digest.update(buffer, 0, read);
        }
    }

    private static void download(Release release, File apk) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        HttpURLConnection connection = open(release.file);
        try (InputStream stream = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
            copy(stream, output, MAX_APK_BYTES, digest);
        } finally {
            connection.disconnect();
        }
        StringBuilder hash = new StringBuilder();
        for (byte value : digest.digest()) {
            hash.append(Character.forDigit((value & 0xff) >>> 4, 16));
            hash.append(Character.forDigit(value & 15, 16));
        }
        if (!release.sha256.contentEquals(hash)) throw new IOException("APK checksum mismatch");
    }

    @SuppressWarnings("deprecation")
    private PackageInfo installedPackage() throws PackageManager.NameNotFoundException {
        return activity.getPackageManager().getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNATURES);
    }

    @SuppressWarnings("deprecation")
    private void verifyPackage(Release release, File apk) throws Exception {
        PackageInfo installed = installedPackage();
        PackageInfo update = activity.getPackageManager().getPackageArchiveInfo(
            apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        if (update == null || !installed.packageName.equals(update.packageName)
                || installed.signatures == null || installed.signatures.length == 0
                || !Arrays.equals(installed.signatures, update.signatures)
                || update.versionCode != release.code || update.versionCode <= installed.versionCode) {
            throw new IOException("APK does not match this CalendarFam installation");
        }
    }

    private void commit(File apk) throws Exception {
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
            PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        params.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= 31) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        }
        int id = installer.createSession(params);
        boolean committed = false;
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream input = new java.io.FileInputStream(apk);
                 OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
                copy(input, output, MAX_APK_BYTES, null);
                session.fsync(output);
            }
            Intent callback = new Intent(activity, InstallResult.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            session.commit(PendingIntent.getBroadcast(activity, id, callback, flags).getIntentSender());
            committed = true;
        } finally {
            if (!committed) installer.abandonSession(id);
        }
    }

    private void toast(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
    }

    void close() {
        worker.shutdown();
    }

    static final class Release {
        final int code;
        final String version;
        final String file;
        final String sha256;

        Release(int code, String version, String file, String sha256) throws IOException {
            if (code <= 0 || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")
                    || !file.matches("centro-vazquez-santiago-tv-v[0-9]+(?:\\.[0-9]+){1,2}\\.apk")
                    || !sha256.matches("[a-f0-9]{64}")) throw new IOException("Invalid release manifest");
            this.code = code;
            this.version = version;
            this.file = file;
            this.sha256 = sha256;
        }
    }

    public static final class InstallResult extends BroadcastReceiver {
        @Override public void onReceive(Context context, Intent response) {
            int status = response.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent installer = response.getParcelableExtra(Intent.EXTRA_INTENT);
                if (installer != null) {
                    try {
                        context.startActivity(installer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        return;
                    } catch (RuntimeException unavailable) {
                        // If the system cannot display the installer, the user can retry on restart.
                    }
                }
            } else if (status == PackageInstaller.STATUS_SUCCESS) {
                return;
            }
            Toast.makeText(context, "Actualización cancelada o incompleta.", Toast.LENGTH_LONG).show();
        }
    }
}
