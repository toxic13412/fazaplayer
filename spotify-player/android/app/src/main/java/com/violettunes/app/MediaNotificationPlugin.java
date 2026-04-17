package com.violettunes.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaNotification")
public class MediaNotificationPlugin extends Plugin {

    @Override
    public void load() {
        // Регистрируем колбэк — когда нажимают кнопки в уведомлении
        MediaButtonReceiver.callback = action -> {
            JSObject data = new JSObject();
            data.put("action", action);
            notifyListeners("mediaAction", data);
        };
    }

    @PluginMethod
    public void updateNotification(PluginCall call) {
        String title   = call.getString("title",   "VioletTunes");
        String artist  = call.getString("artist",  "");
        String cover   = call.getString("cover",   "");
        boolean playing = call.getBoolean("playing", false);
        boolean liked   = call.getBoolean("liked",   false);

        Intent intent = new Intent(getContext(), MediaPlayerService.class);
        intent.setAction("UPDATE");
        intent.putExtra("title",   title);
        intent.putExtra("artist",  artist);
        intent.putExtra("cover",   cover);
        intent.putExtra("playing", playing);
        intent.putExtra("liked",   liked);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stopNotification(PluginCall call) {
        Intent intent = new Intent(getContext(), MediaPlayerService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        call.resolve();
    }
}
