package com.violettunes.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.support.v4.media.MediaMetadataCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import java.io.InputStream;
import java.net.URL;
import android.os.AsyncTask;

public class MediaPlayerService extends Service {

    public static final String CHANNEL_ID   = "VioletTunesPlayer";
    public static final int    NOTIF_ID     = 1;

    public static String  currentTitle  = "VioletTunes";
    public static String  currentArtist = "";
    public static String  currentCover  = "";
    public static boolean isPlaying     = false;
    public static boolean isLiked       = false;

    private MediaSessionCompat mediaSession;
    private NotificationManager notifManager;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        mediaSession = new MediaSessionCompat(this, "VioletTunes");
        mediaSession.setActive(true);
        
        // Инициализация WakeLock
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VioletTunes::MediaWakeLock");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (action != null) {
                switch (action) {
                    case "UPDATE":
                        currentTitle  = intent.getStringExtra("title");
                        currentArtist = intent.getStringExtra("artist");
                        currentCover  = intent.getStringExtra("cover");
                        isPlaying     = intent.getBooleanExtra("playing", false);
                        isLiked       = intent.getBooleanExtra("liked", false);
                        loadCoverAndNotify();
                        break;
                    case "STOP":
                        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
                        stopForeground(true);
                        stopSelf();
                        return START_NOT_STICKY;
                }
            }
        }
        return START_STICKY;
    }

    private void loadCoverAndNotify() {
        if (currentCover != null && !currentCover.isEmpty()) {
            new AsyncTask<String, Void, Bitmap>() {
                @Override
                protected Bitmap doInBackground(String... urls) {
                    try {
                        InputStream in = new URL(urls[0]).openStream();
                        return BitmapFactory.decodeStream(in);
                    } catch (Exception e) { return null; }
                }
                @Override
                protected void onPostExecute(Bitmap bmp) {
                    showNotification(bmp);
                }
            }.execute(currentCover);
        } else {
            showNotification(null);
        }
    }

    private void showNotification(Bitmap cover) {
        // Intent открыть приложение
        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(
            this, 0, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Кнопки управления
        PendingIntent prevIntent = buildAction("com.violettunes.app.PREV",  0);
        PendingIntent playIntent = buildAction(isPlaying ? "com.violettunes.app.PAUSE" : "com.violettunes.app.PLAY", 1);
        PendingIntent nextIntent = buildAction("com.violettunes.app.NEXT",  2);
        PendingIntent likeIntent = buildAction("com.violettunes.app.LIKE",  3);
        PendingIntent stopIntent = buildAction("com.violettunes.app.STOP",  4);

        // Обновить MediaSession метаданные
        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE,  currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist);
        if (cover != null) meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, cover);
        mediaSession.setMetadata(meta.build());

        PlaybackStateCompat.Builder state = new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
            .setState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                      PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f);
        mediaSession.setPlaybackState(state.build());

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setContentIntent(openIntent)
            .setDeleteIntent(stopIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            // Кнопки: ⏮ Prev | ⏸/▶ Play | ⏭ Next | ♥ Like
            .addAction(android.R.drawable.ic_media_previous, "Назад",    prevIntent)
            .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                       isPlaying ? "Пауза" : "Играть", playIntent)
            .addAction(android.R.drawable.ic_media_next,     "Вперёд",   nextIntent)
            .addAction(isLiked ? android.R.drawable.btn_star_big_on : android.R.drawable.btn_star_big_off,
                       "Лайк", likeIntent)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)); // prev, play, next в компактном виде

        if (cover != null) builder.setLargeIcon(cover);

        Notification notification = builder.build();
        
        // Acquire WakeLock перед startForeground
        if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        
        startForeground(NOTIF_ID, notification);
    }

    private PendingIntent buildAction(String action, int requestCode) {
        Intent intent = new Intent(this, MediaButtonReceiver.class);
        intent.setAction(action);
        return PendingIntent.getBroadcast(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "VioletTunes Player",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Управление воспроизведением");
            channel.setShowBadge(false);
            notifManager = getSystemService(NotificationManager.class);
            notifManager.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (mediaSession != null) mediaSession.release();
    }
}
