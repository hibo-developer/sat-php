package com.cotepa.sat;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(
        name = "BackgroundLocation",
        permissions = {
                @Permission(alias = "location", strings = {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                }),
                @Permission(alias = "backgroundLocation", strings = {
                        Manifest.permission.ACCESS_BACKGROUND_LOCATION
                }),
                @Permission(alias = "notifications", strings = {
                        Manifest.permission.POST_NOTIFICATIONS
                })
        }
)
public class BackgroundLocationPlugin extends Plugin {
    private BackgroundLocationStore store;

    @Override
    public void load() {
        store = new BackgroundLocationStore(getContext());
    }

    @PluginMethod
    public void start(PluginCall call) {
        String ordenId = call.getString("ordenId", "");
        String tecnicoId = call.getString("tecnicoId", "");
        int intervalMinutes = call.getInt("intervalMinutes", 5);
        long intervalMs = Math.max(60_000L, intervalMinutes * 60_000L);

        if (ordenId == null || ordenId.trim().isEmpty()) {
            call.reject("ordenId requerido");
            return;
        }

        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("backgroundLocation") != PermissionState.GRANTED) {
            requestPermissionForAlias("backgroundLocation", call, "locationPermsCallback");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "locationPermsCallback");
            return;
        }

        Intent intent = new Intent(getContext(), BackgroundLocationService.class);
        intent.putExtra(BackgroundLocationService.EXTRA_ORDEN_ID, ordenId);
        intent.putExtra(BackgroundLocationService.EXTRA_TECNICO_ID, tecnicoId);
        intent.putExtra(BackgroundLocationService.EXTRA_INTERVAL_MS, intervalMs);

        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), BackgroundLocationService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSONArray arr = store.getPoints();
        JSArray out = new JSArray();
        try {
            for (int i = 0; i < arr.length(); i++) {
                out.put(new JSObject(arr.getJSONObject(i).toString()));
            }
        } catch (JSONException ignored) {}
        JSObject rsp = new JSObject();
        rsp.put("items", out);
        call.resolve(rsp);
    }

    @PluginMethod
    public void clearPending(PluginCall call) {
        store.clear();
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject rsp = new JSObject();
        rsp.put("running", store.isRunning());
        rsp.put("ordenId", store.getOrdenId());
        rsp.put("tecnicoId", store.getTecnicoId());
        rsp.put("intervalMs", store.getIntervalMs());
        call.resolve(rsp);
    }

    @SuppressWarnings("unused")
    private void locationPermsCallback(PluginCall call) {
        start(call);
    }
}
