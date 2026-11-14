package com.bifrost.sender;

import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.media.projection.*;
import android.hardware.display.*;
import android.util.DisplayMetrics;
import android.view.*;
import java.nio.*;
import java.util.concurrent.TimeUnit;
import okhttp3.*;
import okio.ByteString;
import org.json.JSONObject;

public final class CaptureService extends Service {
    public static volatile boolean running;
    public static volatile String receiverName="";
    private HandlerThread thread;
    private Handler worker;
    private MediaProjection projection;
    private MediaCodec encoder;
    private Surface surface;
    private VirtualDisplay display;
    private WebSocket socket;
    private OkHttpClient client;
    private int width,height,density;
    private boolean finishing,awaitingKey;
    private long lastKeyRequest;
    private final DisplayManager.DisplayListener displayChanges = new DisplayManager.DisplayListener(){
        public void onDisplayAdded(int id){} public void onDisplayRemoved(int id){}
        public void onDisplayChanged(int id){if(Build.VERSION.SDK_INT>=34||id!=Display.DEFAULT_DISPLAY||display==null)return;DisplayMetrics metrics=new DisplayMetrics();((WindowManager)getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(metrics);resize(metrics.widthPixels,metrics.heightPixels);}
    };
    private final MediaProjection.Callback callback=new MediaProjection.Callback(){
        @Override public void onStop(){if(worker!=null)worker.post(()->finish("Screen sharing stopped"));}
        @Override public void onCapturedContentResize(int w,int h){if(worker!=null)worker.post(()->resize(w,h));}
    };
    private void status(String text){sendBroadcast(new Intent("com.bifrost.sender.STATUS").setPackage(getPackageName()).putExtra("status",text));}
    @Override public void onCreate(){super.onCreate();thread=new HandlerThread("Bifrost encoder");thread.start();worker=new Handler(thread.getLooper());}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null||"stop".equals(intent.getAction())){worker.post(()->finish("Not sharing"));return START_NOT_STICKY;}
        if(running)return START_NOT_STICKY;
        running=true;receiverName=intent.getStringExtra("name");
        NotificationManager notifications=getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel("screen","Screen sharing",NotificationManager.IMPORTANCE_LOW));
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,CaptureService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent open=PendingIntent.getActivity(this,2,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification=new Notification.Builder(this,"screen").setSmallIcon(com.bifrost.sender.R.drawable.ic_bolt).setContentTitle("Sharing your screen").setContentText(receiverName).setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Stop",stop).build()).build();
        if(Build.VERSION.SDK_INT>=29)startForeground(10,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);else startForeground(10,notification);
        Intent capture=intent.getParcelableExtra("capture");int result=intent.getIntExtra("result",Activity.RESULT_CANCELED);
        worker.post(()->{
            try{
                MediaProjectionManager manager=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);
                projection=manager.getMediaProjection(result,capture);projection.registerCallback(callback,worker);((DisplayManager)getSystemService(DISPLAY_SERVICE)).registerDisplayListener(displayChanges,worker);
                client=new OkHttpClient.Builder().pingInterval(10,TimeUnit.SECONDS).connectTimeout(10,TimeUnit.SECONDS).readTimeout(0,TimeUnit.MILLISECONDS).build();
                String host=intent.getStringExtra("host");if(host.contains(":"))host="["+host+"]";
                Request request=new Request.Builder().url("ws://"+host+":"+intent.getIntExtra("port",0)+"/stream").header("Sec-WebSocket-Protocol","bifrost.h264.v1").build();
                socket=client.newWebSocket(request,new WebSocketListener(){
                    @Override public void onOpen(WebSocket ws,Response response){try{ws.send(new JSONObject().put("type","hello").put("protocol",1).put("name",Build.MANUFACTURER+" "+Build.MODEL).toString());}catch(Exception e){worker.post(()->finish("Connection failed"));}}
                    @Override public void onMessage(WebSocket ws,String message){worker.post(()->{try{String type=new JSONObject(message).getString("type");if("ready".equals(type)){DisplayMetrics metrics=new DisplayMetrics();((WindowManager)getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(metrics);density=metrics.densityDpi;startEncoder(metrics.widthPixels,metrics.heightPixels);status("Connected to "+receiverName);}else if("keyframe".equals(type))requestKey();}catch(Exception e){finish("Unable to start screen sharing: "+e.getMessage());}});}
                    @Override public void onClosing(WebSocket ws,int code,String reason){ws.close(code,reason);worker.post(()->finish("Disconnected"));}
                    @Override public void onFailure(WebSocket ws,Throwable error,Response response){worker.post(()->finish(response!=null&&response.code()==409?"Receiver is already in use":"Connection failed: "+error.getMessage()));}
                });
            }catch(Exception error){finish("Unable to share: "+error.getMessage());}
        });return START_NOT_STICKY;
    }
    private void startEncoder(int w,int h)throws Exception{
        if(finishing)return;
        double scale=Math.min(1.0,2560.0/Math.max(w,h));width=Math.max(2,(int)(w*scale)/2*2);height=Math.max(2,(int)(h*scale)/2*2);
        MediaFormat format=MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC,width,height);
        format.setInteger(MediaFormat.KEY_COLOR_FORMAT,MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
        format.setInteger(MediaFormat.KEY_BIT_RATE,Math.min(24000000,Math.max(8000000,width*height*7)));
        format.setInteger(MediaFormat.KEY_FRAME_RATE,60);format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL,1);
        format.setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER,100000);
        if(Build.VERSION.SDK_INT>=29)format.setInteger(MediaFormat.KEY_MAX_B_FRAMES,0);
        MediaCodec next=MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);encoder=next;
        next.setCallback(new MediaCodec.Callback(){
            @Override public void onInputBufferAvailable(MediaCodec codec,int index){}
            @Override public void onOutputFormatChanged(MediaCodec codec,MediaFormat output){
                if(codec!=encoder)return;
                ByteBuffer sps=output.getByteBuffer("csd-0"),pps=output.getByteBuffer("csd-1");
                if(sps!=null){int length=sps.remaining()+(pps==null?0:pps.remaining());ByteBuffer config=ByteBuffer.allocate(length);config.put(sps.duplicate());if(pps!=null)config.put(pps.duplicate());send(config.array(),0,1);}
            }
            @Override public void onError(MediaCodec codec,MediaCodec.CodecException error){if(codec==encoder)finish("Encoder stopped: "+error.getDiagnosticInfo());}
            @Override public void onOutputBufferAvailable(MediaCodec codec,int index,MediaCodec.BufferInfo info){
                try{
                    if(codec!=encoder||finishing)return;
                    ByteBuffer buffer=codec.getOutputBuffer(index);if(buffer==null||info.size==0)return;
                    boolean key=(info.flags&MediaCodec.BUFFER_FLAG_KEY_FRAME)!=0,config=(info.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)!=0;
                    if(socket.queueSize()>2*1024*1024){awaitingKey=true;requestKey();return;}
                    if(awaitingKey&&!config){if(!key||socket.queueSize()>256*1024)return;awaitingKey=false;}
                    buffer.position(info.offset);buffer.limit(info.offset+info.size);byte[] bytes=new byte[info.size];buffer.get(bytes);send(bytes,info.presentationTimeUs,(config?1:0)|(key?2:0));
                }catch(Exception error){finish("Screen sharing failed: "+error.getMessage());}
                finally{try{codec.releaseOutputBuffer(index,false);}catch(Exception ignored){}}
            }
        },worker);
        next.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);surface=next.createInputSurface();next.start();
        if(display==null)display=projection.createVirtualDisplay("Bifrost screen",width,height,density,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,surface,null,worker);
        else{display.resize(width,height,density);display.setSurface(surface);}
        awaitingKey=false;
    }
    private void send(byte[] data,long timestamp,int flags){if(socket==null||finishing)return;ByteBuffer packet=ByteBuffer.allocate(9+data.length).order(ByteOrder.BIG_ENDIAN);packet.put((byte)flags).putLong(Math.max(0,timestamp)).put(data);if(!socket.send(ByteString.of(packet.array())))finish("Connection closed");}
    private void requestKey(){if(encoder==null||finishing)return;long now=SystemClock.elapsedRealtime();if(now-lastKeyRequest<300)return;lastKeyRequest=now;try{Bundle options=new Bundle();options.putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME,0);encoder.setParameters(options);}catch(Exception ignored){}}
    private void resize(int w,int h){if(finishing||encoder==null)return;double scale=Math.min(1.0,2560.0/Math.max(w,h));if((int)(w*scale)/2*2==width&&(int)(h*scale)/2*2==height)return;try{releaseEncoder();startEncoder(w,h);}catch(Exception error){finish("Screen resize failed: "+error.getMessage());}}
    private void releaseEncoder(){if(display!=null)display.setSurface(null);MediaCodec previous=encoder;encoder=null;if(previous!=null){try{previous.stop();}catch(Exception ignored){}previous.release();}if(surface!=null){surface.release();surface=null;}}
    private void finish(String message){if(finishing)return;finishing=true;running=false;((DisplayManager)getSystemService(DISPLAY_SERVICE)).unregisterDisplayListener(displayChanges);status(message);if(socket!=null)socket.close(1000,"Stopped");if(display!=null){display.release();display=null;}releaseEncoder();if(projection!=null){projection.unregisterCallback(callback);projection.stop();projection=null;}if(client!=null){client.dispatcher().executorService().shutdown();client.connectionPool().evictAll();}stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onDestroy(){if(!finishing)worker.post(()->finish("Screen sharing stopped"));thread.quitSafely();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
