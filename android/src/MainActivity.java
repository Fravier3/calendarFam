package com.fravier3.calendarfam.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;

public final class MainActivity extends Activity {
    private static final String HOST = "calendar-fam.vercel.app";
    private static final String HOME = "https://" + HOST + "/?native=1";
    private WebView view;
    private ApkUpdater updater;
    private volatile boolean offline;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        view = new WebView(this);
        view.setBackgroundColor(0xff0b1521);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setBuiltInZoomControls(false);
        view.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true);
        view.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView web, WebResourceRequest request) {
                return !allowed(request.getUrl());
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView web, WebResourceRequest request) {
                if (!allowed(request.getUrl())) return null;
                String path = request.getUrl().getPath();
                if (path == null) return null;
                if (path.matches("/tv-assets/pr-[0-9]{1,2}\\.webp")) return local(path.substring(1), "image/webp");
                if (!offline) return null;
                if ("/".equals(path)) return local("web/index.html", "text/html");
                if (path.matches("/assets/[A-Za-z0-9_.-]+")) {
                    return local("web"+path, path.endsWith(".css")?"text/css":"application/javascript");
                }
                return null;
            }

            @Override public void onReceivedError(WebView web, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !offline) {
                    offline = true;
                    web.post(() -> web.loadUrl(HOME + "&offline=1"));
                }
            }
        });
        updater = new ApkUpdater(this);
        setContentView(view);
        view.requestFocus();
        view.loadUrl(HOME);
    }

    private static boolean allowed(android.net.Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost());
    }

    private WebResourceResponse local(String path, String type) {
        try {return new WebResourceResponse(type, type.startsWith("image/") ? null : "UTF-8", getAssets().open(path));}
        catch (IOException exception) {return null;}
    }

    @Override public void onBackPressed() {
        view.evaluateJavascript(
            "(function() {" +
            "  if (!document.querySelector('.main:not(.full)')) return true;" +
            "  window.dispatchEvent(new Event('calendar-native-back'));" +
            "  return false;" +
            "})()",
            result -> {
                if (!"false".equals(result) && !isFinishing()) finish();
            });
    }

    @Override protected void onResume() {
        super.onResume();
        if (updater != null) updater.check();
        if (view != null && offline) {
            offline = false;
            view.loadUrl(HOME);
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (updater != null) updater.activityResult(requestCode);
    }

    @Override protected void onDestroy() {
        if (updater != null) updater.close();
        super.onDestroy();
    }
}
