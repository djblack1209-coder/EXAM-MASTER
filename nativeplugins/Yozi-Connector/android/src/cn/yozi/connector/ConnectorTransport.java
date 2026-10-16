package cn.yozi.connector;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** 受保护的原生传输内核；无DCloud/Android依赖，移动SDK适配保持薄封装。 */
public final class ConnectorTransport implements AutoCloseable {
    public static final String CONTRACT = "wenli-app-connector-v1";
    public static final String ORIGIN = "https://wenli-app.invalid";
    public static final String STREAM_CONTRACT = "wenli-app-stream-v1";
    public interface Callback { void complete(Map<String, Object> result); }
    private final Map<String, Job> active = new HashMap<>();
    private final ScheduledExecutorService timers = Executors.newScheduledThreadPool(2, daemon());
    private final ExecutorService workers = new ThreadPoolExecutor(4, 4, 0L, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(4), daemon());
    private volatile boolean closed;
    private static ThreadFactory daemon() { return r -> { Thread t = new Thread(r, "yozi-connector"); t.setDaemon(true); return t; }; }
    public static Map<String,Object> capabilities() {
        Map<String,Object> v = new HashMap<>(); v.put("contract", CONTRACT); v.put("redirect", "reject");
        v.put("responseLimit", "bytes"); v.put("utf8", "strict"); v.put("tls", "system"); v.put("cancel", true);
        Map<String,Object> material=new HashMap<>();material.put("contract","yozi-material-parse-v1");material.put("timeoutMs",100000);v.put("materialParse",material);
        Map<String,Object> stream=new HashMap<>();stream.put("contract",STREAM_CONTRACT);stream.put("chunks","base64");stream.put("sequence",true);stream.put("maxBytes",2097152);stream.put("maxChunks",256);stream.put("timeoutMs",45000);v.put("stream",stream);return v;
    }
    private static int integer(Object v, int min, int max) {
        if (!(v instanceof Number)) throw new IllegalArgumentException();
        double n = ((Number)v).doubleValue(); if (n < min || n > max || n != Math.floor(n)) throw new IllegalArgumentException(); return (int)n;
    }
    private static String text(Object v) { if (!(v instanceof String)) throw new IllegalArgumentException(); return (String)v; }
    private static Map<String,Object> failure(String id, String code) {
        Map<String,Object> v=new HashMap<>();v.put("id",id);v.put("code",code);return v;
    }
    private final class Job {
        final String id; final Callback callback; final boolean streaming; final AtomicBoolean done = new AtomicBoolean();
        int sequence, chunks;
        volatile HttpURLConnection connection; volatile ScheduledFuture<?> deadline;
        Job(String id, Callback callback, boolean streaming) { this.id=id; this.callback=callback; this.streaming=streaming; }
        synchronized boolean event(Map<String,Object> value) {
            if(done.get())return false;
            value.put("id",id);value.put("sequence",++sequence);callback.complete(value);return !done.get();
        }
        synchronized void finish(Map<String,Object> value) {
            if (!done.compareAndSet(false,true)) return;
            if(streaming && !value.containsKey("code")){value.put("kind","complete");value.put("sequence",++sequence);}
            synchronized(active) { active.remove(id); }
            if (deadline != null) deadline.cancel(false);
            try { callback.complete(value); } finally { if(connection!=null)connection.disconnect(); }
        }
        void fail(String code) { finish(failure(id,code)); }
    }
    public void request(Map<String,Object> options, Callback callback) {
        request(options,callback,false);
    }
    public void stream(Map<String,Object> options, Callback callback) {
        request(options,callback,true);
    }
    private void request(Map<String,Object> options, Callback callback, boolean streaming) {
        if(callback==null)return;
        String id=""; URI uri; String method,token,body; int timeout,limit; byte[] bytes;
        try {
            id=text(options.get("id")); if(!id.matches("[A-Za-z0-9_-]{1,128}")){id="";throw new IllegalArgumentException();}
            if(!Boolean.TRUE.equals(options.get("consent")))throw new IllegalArgumentException();
            String address=text(options.get("url")); if(address.length()>4096)throw new IllegalArgumentException();
            uri=new URI(address); method=text(options.get("method")); token=text(options.get("token"));
            boolean route=streaming ? "/proxy-ai-stream".equals(uri.getRawPath()) && "POST".equals(method) : Arrays.asList("/health","/chat","/parse","/delete").contains(uri.getRawPath()) && Arrays.asList("GET","POST").contains(method);
            if(!Arrays.asList("http","https").contains(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getRawQuery()!=null || uri.getRawFragment()!=null || !route || !token.matches("[\\x21-\\x7e]{32,4096}"))throw new IllegalArgumentException();
            Object origins=options.get("allowedOrigins"); if(!(origins instanceof List) || ((List<?>)origins).size()>16 || !((List<?>)origins).contains(origin(uri)))throw new IllegalArgumentException();
            boolean materialParse=!streaming && "/parse".equals(uri.getRawPath()) && "POST".equals(method);
            timeout=integer(options.get("timeout"),1,streaming?45000:materialParse?100000:35000);limit=integer(options.get("limit"),1,streaming?2097152:2000000);
            body=options.get("body")==null?null:text(options.get("body")); if(body!=null && !method.equals("POST"))throw new IllegalArgumentException();
            if(streaming && body==null)throw new IllegalArgumentException();
            if(body!=null && body.length()>15*1024*1024)throw new IllegalArgumentException();
            if(body==null)bytes=null;else {ByteBuffer encoded=StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).encode(java.nio.CharBuffer.wrap(body));bytes=new byte[encoded.remaining()];encoded.get(bytes);}
            if(bytes!=null && bytes.length>15*1024*1024)throw new IllegalArgumentException();
        } catch(Exception error) { callback.complete(failure(id,"INVALID_REQUEST"));return; }
        final Job job=new Job(id,callback,streaming); final URI target=uri; final String verb=method,auth=token; final int budget=timeout,max=limit; final byte[] payload=bytes;
        String rejected=null;
        synchronized(active) {
            if(closed)rejected="CANCELLED";
            else if(active.containsKey(id))rejected="REQUEST_CONFLICT";
            else if(active.size()>=4)rejected="RATE_LIMIT";
            else {active.put(id,job);job.deadline=timers.schedule(()->job.fail("TIMEOUT"),budget,TimeUnit.MILLISECONDS);}
        }
        if(rejected!=null){callback.complete(failure(id,rejected));return;}
        try { workers.execute(()->{
            try {
                if(job.done.get())return;
                HttpURLConnection c=(HttpURLConnection)target.toURL().openConnection(); job.connection=c;
                if(job.done.get()){c.disconnect();return;}
                c.setInstanceFollowRedirects(false);c.setUseCaches(false);c.setConnectTimeout(budget);c.setReadTimeout(budget);c.setRequestMethod(verb);
                c.setRequestProperty("Authorization","Bearer "+auth);c.setRequestProperty("Origin",ORIGIN);c.setRequestProperty("Accept-Encoding","identity");
                if(streaming)c.setRequestProperty("Accept","text/event-stream");
                if(payload!=null){c.setRequestProperty("Content-Type","application/json");c.setDoOutput(true);c.setFixedLengthStreamingMode(payload.length);try(java.io.OutputStream stream=c.getOutputStream()){stream.write(payload);}}
                int status=c.getResponseCode();
                if(status<100 || status>=600){job.fail("INVALID_RESPONSE");return;}
                if((status>=300 && status<400) || c.getHeaderField("Location")!=null){job.fail("REDIRECT_FORBIDDEN");return;}
                String size=c.getHeaderField("Content-Length");
                if(size!=null && (!size.matches("[0-9]{1,10}") || Long.parseLong(size)>max)){job.fail("RESPONSE_LIMIT");return;}
                if(streaming){String type=c.getHeaderField("Content-Type");if(type==null)type="";if(type.length()>200){job.fail("INVALID_RESPONSE");return;}Map<String,Object> headers=new HashMap<>();headers.put("kind","headers");headers.put("status",status);headers.put("contentType",type);headers.put("receivedBytes",0);if(!job.event(headers))return;}
                ByteArrayOutputStream buffer=new ByteArrayOutputStream(Math.min(max,8192)); byte[] chunk=new byte[8192];
                InputStream stream=status>=400?c.getErrorStream():c.getInputStream();
                if(stream!=null)try(InputStream input=stream){int n;while(!job.done.get() && (n=input.read(chunk))!=-1){if(buffer.size()+n>max){job.fail("RESPONSE_LIMIT");return;}buffer.write(chunk,0,n);if(streaming){if(++job.chunks>256){job.fail("RESPONSE_LIMIT");return;}Map<String,Object> part=new HashMap<>();part.put("kind","chunk");part.put("chunk",Arrays.copyOf(chunk,n));part.put("receivedBytes",buffer.size());if(!job.event(part))return;}}}
                if(job.done.get())return;
                String value=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(buffer.toByteArray())).toString();
                Map<String,Object> result=new HashMap<>();result.put("id",job.id);result.put("receivedBytes",buffer.size());if(!streaming){result.put("status",status);result.put("body",value);}job.finish(result);
            } catch(java.nio.charset.CharacterCodingException error){job.fail("INVALID_ENCODING");}
              catch(java.net.SocketTimeoutException error){job.fail("TIMEOUT");}
              catch(Exception error){job.fail("CONNECTION_FAILED");}
        }); } catch(RejectedExecutionException error) { job.fail(closed ? "CANCELLED" : "RATE_LIMIT"); }
    }
    private static String origin(URI u) { int p=u.getPort();return u.getScheme()+"://"+u.getHost()+((p==-1 || (p==80 && u.getScheme().equals("http")) || (p==443 && u.getScheme().equals("https")))?"":":"+p); }
    public void cancel(String id){Job job;synchronized(active){job=active.get(id);}if(job!=null)job.fail("CANCELLED");}
    @Override public void close(){List<Job> jobs;synchronized(active){closed=true;jobs=new ArrayList<>(active.values());}for(Job job:jobs)job.fail("CANCELLED");workers.shutdownNow();timers.shutdownNow();}
}
