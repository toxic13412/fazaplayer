package com.violettunes.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MediaButtonReceiver extends BroadcastReceiver {

    // Статический колбэк — JS регистрирует его через Capacitor плагин
    public static MediaActionCallback callback = null;

    public interface MediaActionCallback {
        void onAction(String action);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        switch (action) {
            case "com.violettunes.app.PLAY":
                notifyJS("play");
                break;
            case "com.violettunes.app.PAUSE":
                notifyJS("pause");
                break;
            case "com.violettunes.app.NEXT":
                notifyJS("next");
                break;
            case "com.violettunes.app.PREV":
                notifyJS("prev");
                break;
            case "com.violettunes.app.LIKE":
                notifyJS("like");
                break;
            case "com.violettunes.app.STOP":
                // Остановить сервис
                Intent stopService = new Intent(context, MediaPlayerService.class);
                stopService.setAction("STOP");
                context.startService(stopService);
                notifyJS("stop");
                break;
        }
    }

    private void notifyJS(String action) {
        if (callback != null) {
            callback.onAction(action);
        }
    }
}
