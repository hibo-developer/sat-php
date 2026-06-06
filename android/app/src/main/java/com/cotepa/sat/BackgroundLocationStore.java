package com.cotepa.sat;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class BackgroundLocationStore {
    private static final String PREFS = "sat_bg_location";
    private static final String KEY_POINTS = "pending_points";
    private static final String KEY_RUNNING = "running";
    private static final String KEY_ORDEN_ID = "orden_id";
    private static final String KEY_TECNICO_ID = "tecnico_id";
    private static final String KEY_INTERVAL_MS = "interval_ms";
    private static final int MAX_POINTS = 2000;

    private final SharedPreferences prefs;

    public BackgroundLocationStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized void appendPoint(JSONObject point) throws JSONException {
        JSONArray arr = getPoints();
        arr.put(point);
        if (arr.length() > MAX_POINTS) {
            JSONArray trimmed = new JSONArray();
            int start = Math.max(0, arr.length() - MAX_POINTS);
            for (int i = start; i < arr.length(); i++) {
                trimmed.put(arr.get(i));
            }
            arr = trimmed;
        }
        prefs.edit().putString(KEY_POINTS, arr.toString()).apply();
    }

    public synchronized JSONArray getPoints() {
        String raw = prefs.getString(KEY_POINTS, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public synchronized void clear() {
        prefs.edit().putString(KEY_POINTS, "[]").apply();
    }

    public synchronized void setRunning(boolean running, String ordenId, String tecnicoId, long intervalMs) {
        prefs.edit()
                .putBoolean(KEY_RUNNING, running)
                .putString(KEY_ORDEN_ID, ordenId)
                .putString(KEY_TECNICO_ID, tecnicoId)
                .putLong(KEY_INTERVAL_MS, intervalMs)
                .apply();
    }

    public synchronized boolean isRunning() {
        return prefs.getBoolean(KEY_RUNNING, false);
    }

    public synchronized String getOrdenId() {
        return prefs.getString(KEY_ORDEN_ID, "");
    }

    public synchronized String getTecnicoId() {
        return prefs.getString(KEY_TECNICO_ID, "");
    }

    public synchronized long getIntervalMs() {
        return prefs.getLong(KEY_INTERVAL_MS, 0L);
    }
}
