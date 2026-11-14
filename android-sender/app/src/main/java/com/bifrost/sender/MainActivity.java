package com.bifrost.sender;

import android.app.*;
import android.os.*;
import android.content.*;
import android.media.projection.MediaProjectionManager;
import android.media.projection.MediaProjectionConfig;
import android.net.nsd.*;
import android.net.wifi.WifiManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.*;
import android.widget.*;
import java.net.*;
import java.util.*;

public final class MainActivity extends Activity {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final LinkedHashMap<String, String[]> receivers = new LinkedHashMap<>();
    private final Queue<NsdServiceInfo> pending = new ArrayDeque<>();
    private NsdManager nsd;
    private NsdManager.DiscoveryListener discovery;
    private WifiManager.MulticastLock multicast;
    private boolean resolving, destroyed;
    private LinearLayout devices;
    private TextView status;
    private String selectedHost, selectedName;
    private int selectedPort;
    private final BroadcastReceiver updates = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            String message = intent.getStringExtra("status");
            if(message != null) status.setText(message);
        }
    };
    private int dp(int value) { return (int)(getResources().getDisplayMetrics().density * value); }
    private TextView text(String value, int size, int color, boolean bold) { TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); if(bold)t.setTypeface(null, Typeface.BOLD); return t; }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.WHITE);
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(26),dp(30),dp(26),dp(28)); scroll.addView(root);
        if(Build.VERSION.SDK_INT>=30)root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(dp(26)+bars.left,dp(30)+bars.top,dp(26)+bars.right,dp(28)+bars.bottom);return insets;});
        TextView brand = text("Bifrost",32,0xff244253,true); root.addView(brand);
        TextView title = text("Your screen. Connected.",21,0xff2f90bb,true); title.setPadding(0,dp(12),0,dp(8)); root.addView(title);
        status = text(CaptureService.running ? "Connected to " + CaptureService.receiverName : "Looking for computers…",15,0xff617a8b,false); root.addView(status);
        TextView heading = text("AVAILABLE COMPUTERS",11,0xff718b9c,true); heading.setLetterSpacing(.12f); heading.setPadding(0,dp(34),0,dp(16)); root.addView(heading);
        devices = new LinearLayout(this); devices.setOrientation(LinearLayout.VERTICAL); root.addView(devices);
        Button address = new Button(this); address.setText("Connect by address"); address.setAllCaps(false); root.addView(address); address.setOnClickListener(v -> addressDialog());
        Button stop = new Button(this); stop.setText("Stop sharing"); stop.setAllCaps(false); root.addView(stop); stop.setOnClickListener(v -> { startService(new Intent(this,CaptureService.class).setAction("stop")); status.setText("Not sharing"); });
        setContentView(scroll);
        IntentFilter filter = new IntentFilter("com.bifrost.sender.STATUS");
        if(Build.VERSION.SDK_INT>=33) registerReceiver(updates,filter,Context.RECEIVER_NOT_EXPORTED); else registerReceiver(updates,filter);
        nsd = (NsdManager)getSystemService(NSD_SERVICE);
        WifiManager wifi = (WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
        multicast = wifi.createMulticastLock("Bifrost discovery"); multicast.setReferenceCounted(false); multicast.acquire();
        discovery = new NsdManager.DiscoveryListener() {
            public void onDiscoveryStarted(String type) {}
            public void onStartDiscoveryFailed(String type,int error) { ui.post(()->status.setText("Discovery unavailable")); }
            public void onStopDiscoveryFailed(String type,int error) {}
            public void onDiscoveryStopped(String type) {}
            public void onServiceFound(NsdServiceInfo info) { ui.post(()->{ pending.add(info); resolveNext(); }); }
            public void onServiceLost(NsdServiceInfo info) { ui.post(()->{ receivers.remove(info.getServiceName()); renderDevices(); }); }
        };
        try { nsd.discoverServices("_bifrost._tcp.",NsdManager.PROTOCOL_DNS_SD,discovery); } catch(Exception e) { status.setText("Discovery unavailable"); }
        renderDevices();
    }
    private void resolveNext() {
        if(destroyed || resolving || pending.isEmpty())return;
        resolving=true; NsdServiceInfo info=pending.remove();
        nsd.resolveService(info,new NsdManager.ResolveListener(){
            public void onResolveFailed(NsdServiceInfo service,int error){ ui.post(()->{resolving=false;resolveNext();}); }
            public void onServiceResolved(NsdServiceInfo service){ ui.post(()->{
                resolving=false; if(destroyed)return;
                InetAddress host=service.getHost();
                if(Build.VERSION.SDK_INT>=34)for(InetAddress candidate:service.getHostAddresses())if(candidate instanceof Inet4Address){host=candidate;break;}
                if(host!=null){receivers.put(service.getServiceName(),new String[]{service.getServiceName(),host.getHostAddress(),String.valueOf(service.getPort())});renderDevices();}
                resolveNext();
            }); }
        });
    }
    private void renderDevices() {
        if(destroyed)return; devices.removeAllViews();
        if(receivers.isEmpty()){TextView empty=text("No computers found yet",15,0xff728a9a,false);empty.setPadding(0,dp(10),0,dp(22));devices.addView(empty);}
        for(String[] receiver:receivers.values()) {
            Button button=new Button(this);button.setAllCaps(false);button.setText(receiver[0]);button.setTextSize(18);button.setTextColor(0xff227fa8);button.setPadding(dp(14),dp(14),dp(14),dp(14));devices.addView(button);
            button.setOnClickListener(v->connect(receiver[1],Integer.parseInt(receiver[2]),receiver[0]));
        }
    }
    private void addressDialog(){
        EditText input=new EditText(this);input.setSingleLine();input.setHint("192.168.1.10:12345");input.setPadding(dp(22),dp(14),dp(22),dp(14));
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Receiver address").setView(input).setNegativeButton("Cancel",null).setPositiveButton("Connect",null).create();
        dialog.setOnShowListener(ignored->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String value=input.getText().toString().trim();int split=value.lastIndexOf(':');try{String host=value.substring(0,split);int port=Integer.parseInt(value.substring(split+1));if(!host.matches("[a-zA-Z0-9.\\-]+")||port<1||port>65535)throw new Exception();dialog.dismiss();connect(host,port,host);}catch(Exception e){input.setError("Enter a valid host:port");}}));dialog.show();
    }
    private void connect(String host,int port,String name){
        if(CaptureService.running){status.setText("Stop the current stream first");return;}
        selectedHost=host;selectedPort=port;selectedName=name;
        MediaProjectionManager manager=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);
        startActivityForResult(Build.VERSION.SDK_INT>=34 ? manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay()) : manager.createScreenCaptureIntent(),100);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(request!=100)return;
        if(result!=RESULT_OK||data==null){status.setText("Screen sharing cancelled");return;}
        Intent intent=new Intent(this,CaptureService.class).putExtra("host",selectedHost).putExtra("port",selectedPort).putExtra("name",selectedName).putExtra("result",result).putExtra("capture",data);
        startForegroundService(intent);status.setText("Connecting to "+selectedName+"…");
    }
    @Override protected void onDestroy(){destroyed=true;try{nsd.stopServiceDiscovery(discovery);}catch(Exception ignored){}if(multicast!=null&&multicast.isHeld())multicast.release();unregisterReceiver(updates);super.onDestroy();}
}
