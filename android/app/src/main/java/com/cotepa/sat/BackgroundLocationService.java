package com.cotepa.sat;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class BackgroundLocationService extends Service {
    public static final String EXTRA_ORDEN_ID = "ordenId";
    public static final String EXTRA_TECNICO_ID = "tecnicoId";
    public static final String EXTRA_INTERVAL_MS = "intervalMs";

    private static final String CHANNEL_ID = "sat_tracking";
    private static final int NOTIF_ID = 2001;

    private LocationManager locationManager;
    private LocationListener listener;
    private BackgroundLocationStore store;

    private String ordenId;
    private String tecnicoId;
    private long intervalMs;
    private long lastSavedAtMs = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        store = new BackgroundLocationStore(this);
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        ensureNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            ordenId = intent.getStringExtra(EXTRA_ORDEN_ID);
            tecnicoId = intent.getStringExtra(EXTRA_TECNICO_ID);
            intervalMs = intent.getLongExtra(EXTRA_INTERVAL_MS, 5 * 60 * 1000L);
            if (intervalMs < 60_000L) intervalMs = 60_000L;
        }
        if (store != null) {
            store.setRunning(true, ordenId, tecnicoId, intervalMs);
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("SAT Movil COTEPA")
                .setContentText("Tracking GPS activo")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build();

        startForeground(NOTIF_ID, notification);
        startLocationUpdates();
        return START_STICKY;
    }

    private void startLocationUpdates() {
        if (locationManager == null) return;
        if (!hasLocationPermission()) return;

        stopLocationUpdates();

        listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (location == null) return;
                long now = System.currentTimeMillis();
                if (lastSavedAtMs > 0 && now - lastSavedAtMs < intervalMs) {
                    return;
                }
                lastSavedAtMs = now;
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("orden_id", ordenId);
                    obj.put("tecnico_id", tecnicoId);
                    obj.put("lat", location.getLatitude());
                    obj.put("lng", location.getLongitude());
                    obj.put("accuracy_m", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
                    obj.put("recorded_at", iso8601(location.getTime()));
                    obj.put("tipo", "tracking");
                    obj.put("source", "bg");
                    store.appendPoint(obj);
                } catch (Exception ignored) {
                }
            }
        };

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 10_000L, 0f, listener);
            }
        } catch (Exception ignored) {}

        try {
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 10_000L, 0f, listener);
            }
        } catch (Exception ignored) {}
    }

    private void stopLocationUpdates() {
        if (locationManager != null && listener != null) {
            try {
                locationManager.removeUpdates(listener);
            } catch (Exception ignored) {
            }
        }
        listener = null;
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Tracking",
                NotificationManager.IMPORTANCE_LOW
        );
        nm.createNotificationChannel(channel);
    }

    private static String iso8601(long epochMs) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date(epochMs));
    }

    @Override
    public void onDestroy() {
        stopLocationUpdates();
        if (store != null) {
            store.setRunning(false, "", "", 0L);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
