package cn.wenli.connector;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** 系统选择源的临时能力句柄；选择只取元信息，明确同意后才打开正文。 */
public final class MaterialFiles implements AutoCloseable {
    public static final int MAX_BYTES = 10 * 1024 * 1024;
    public static final String CONTRACT = "wenli-app-file-v1";
    public interface Source {
        Metadata inspect() throws Exception;
        InputStream open() throws Exception;
        void cancel();
    }
    public static final class Metadata {
        public final String name;
        public final long size;
        public final Long modified;
        public Metadata(String name, long size, Long modified) { this.name=name;this.size=size;this.modified=modified; }
        boolean same(Metadata other) { return other!=null && name.equals(other.name) && size==other.size && Objects.equals(modified,other.modified); }
    }
    private static final class Entry {
        final Source source; final Metadata selected; final long created=System.nanoTime();
        Entry(Source source,Metadata selected){this.source=source;this.selected=selected;}
    }
    private final Map<String,Entry> files=new HashMap<>();
    private final Map<String,Job> jobs=new HashMap<>();
    private final ExecutorService worker=new ThreadPoolExecutor(1,1,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(1),daemon());
    private final ScheduledExecutorService timers=Executors.newScheduledThreadPool(1,daemon());
    private final ExecutorService cleanup=new ThreadPoolExecutor(2,2,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(4),daemon());
    private boolean closed;
    private static ThreadFactory daemon(){return r->{Thread t=new Thread(r,"wenli-material-file");t.setDaemon(true);return t;};}
    public static Map<String,Object> capabilities(){Map<String,Object> v=new HashMap<>();v.put("contract",CONTRACT);v.put("selection","system");v.put("read","after_consent");v.put("handles","ephemeral");v.put("maxBytes",MAX_BYTES);v.put("boundedRead",true);v.put("cancel",true);return v;}
    private static Map<String,Object> result(String id,String code){Map<String,Object> r=new HashMap<>();r.put("id",id);if(code!=null)r.put("code",code);return r;}
    private static boolean validId(String id){return id!=null && id.matches("[A-Za-z0-9_-]{1,128}");}
    private static boolean safeName(String name){
        if(name==null || name.length()>200 || !name.matches("(?i).+\\.(pdf|png|jpe?g)"))return false;
        for(int i=0;i<name.length();i++){char c=name.charAt(i);if(c=='/' || c=='\\' || c<=0x1f || (c>=0x7f && c<=0x9f) || (c>=0x2028 && c<=0x202e) || (c>=0x2066 && c<=0x2069))return false;}
        return true;
    }
    private static boolean valid(Metadata m){return m!=null && safeName(m.name) && m.size>0 && m.size<=MAX_BYTES && (m.modified==null || m.modified>=0);}
    private final class Job {
        final String id,handle;final Source source;final ConnectorTransport.Callback callback;
        final AtomicBoolean done=new AtomicBoolean();volatile InputStream stream;volatile ScheduledFuture<?> timer;
        Job(String id,String handle,Source source,ConnectorTransport.Callback callback){this.id=id;this.handle=handle;this.source=source;this.callback=callback;}
        boolean finish(Map<String,Object> r){
            if(!done.compareAndSet(false,true))return false;
            synchronized(MaterialFiles.this){jobs.remove(id);if(handle!=null)files.remove(handle);}
            if(timer!=null)timer.cancel(false);
            try{callback.complete(r);}finally{if(r.containsKey("code") || handle!=null)clean(source,stream);}
            return true;
        }
        void fail(String code){finish(result(id,code));}
    }
    private synchronized Job start(String id,String handle,Source source,ConnectorTransport.Callback callback){
        if(!validId(id)){callback.complete(result("","INVALID_REQUEST"));return null;}
        if(closed || jobs.containsKey(id) || !jobs.isEmpty()){callback.complete(result(id,closed?"CANCELLED":jobs.containsKey(id)?"REQUEST_CONFLICT":"BUSY"));return null;}
        Job j=new Job(id,handle,source,callback);jobs.put(id,j);j.timer=timers.schedule(()->j.fail("TIMEOUT"),10000,TimeUnit.MILLISECONDS);return j;
    }
    private void execute(Job job,Runnable action){try{worker.execute(action);}catch(RejectedExecutionException error){job.fail("BUSY");}}
    private void clean(Source source,InputStream stream){try{cleanup.execute(()->{try{source.cancel();}catch(Exception ignored){}try{if(stream!=null)stream.close();}catch(Exception ignored){}});}catch(RejectedExecutionException error){synchronized(this){closed=true;}}}
    public void select(String id,Source source,ConnectorTransport.Callback callback){
        if(callback==null || source==null)return;
        synchronized(this){expire();if(files.size()>=2){callback.complete(result(id,"FILE_LIMIT"));clean(source,null);return;}}
        final Job job=start(id,null,source,callback);if(job==null){clean(source,null);return;}
        execute(job,()->{
            String handle=null;
            try{
                if(job.done.get())return;Metadata m=source.inspect();
                if(!valid(m)){job.fail(m!=null && (m.size<=0 || m.size>MAX_BYTES)?"FILE_LIMIT":"FILE_TYPE");return;}
                handle="file_"+UUID.randomUUID();
                synchronized(this){if(job.done.get() || closed)return;files.put(handle,new Entry(source,m));}
                Map<String,Object> file=new HashMap<>();file.put("handle",handle);file.put("name",m.name);file.put("size",m.size);
                Map<String,Object> r=result(id,null);r.put("file",file);if(!job.finish(r)){synchronized(this){files.remove(handle);}clean(source,null);}
            }catch(Exception error){job.fail("FILE_READ_FAILED");}
            finally{try{if(job.stream!=null)job.stream.close();}catch(Exception ignored){}}
        });
    }
    public void read(String id,String handle,boolean consent,ConnectorTransport.Callback callback){
        if(callback==null)return;
        if(!validId(id) || handle==null){callback.complete(result(validId(id)?id:"","INVALID_REQUEST"));return;}
        if(!consent){callback.complete(result(id,"CONSENT_REQUIRED"));return;}
        Entry entry;synchronized(this){expire();entry=files.get(handle);}
        if(entry==null){callback.complete(result(id,"FILE_EXPIRED"));return;}
        final Job job=start(id,handle,entry.source,callback);if(job==null)return;
        execute(job,()->{
            try{
                if(job.done.get())return;Metadata before=entry.source.inspect();
                if(!entry.selected.same(before) || !valid(before)){job.fail("FILE_CHANGED");return;}
                InputStream input=entry.source.open();job.stream=input;if(job.done.get()){input.close();return;}
                ByteArrayOutputStream data=new ByteArrayOutputStream((int)Math.min(before.size,8192));byte[] part=new byte[8192];int n;
                while(!job.done.get() && (n=input.read(part,0,(int)Math.min(part.length,before.size-data.size()+1)))!=-1){
                    if(data.size()+n>before.size || data.size()+n>MAX_BYTES){job.fail("FILE_CHANGED");return;}data.write(part,0,n);
                }
                if(job.done.get())return;
                if(data.size()!=before.size || !before.same(entry.source.inspect())){job.fail("FILE_CHANGED");return;}
                Map<String,Object> r=result(id,null);r.put("handle",handle);r.put("name",before.name);r.put("size",before.size);r.put("contentBase64",base64(data.toByteArray()));job.finish(r);
            }catch(Exception error){job.fail("FILE_READ_FAILED");}
            finally{try{if(job.stream!=null)job.stream.close();}catch(Exception ignored){}}
        });
    }
    private static String base64(byte[] b){
        final char[] alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();StringBuilder s=new StringBuilder(4*((b.length+2)/3));
        for(int i=0;i<b.length;i+=3){int a=b[i]&255,c=i+1<b.length?b[i+1]&255:0,d=i+2<b.length?b[i+2]&255:0;s.append(alphabet[a>>2]).append(alphabet[((a&3)<<4)|(c>>4)]).append(i+1<b.length?alphabet[((c&15)<<2)|(d>>6)]:'=').append(i+2<b.length?alphabet[d&63]:'=');}return s.toString();
    }
    private synchronized void expire(){Iterator<Map.Entry<String,Entry>> i=files.entrySet().iterator();while(i.hasNext()){Entry e=i.next().getValue();if(System.nanoTime()-e.created>TimeUnit.MINUTES.toNanos(10)){i.remove();clean(e.source,null);}}}
    public void cancel(String id){Job job;synchronized(this){job=jobs.get(id);}if(job!=null)job.fail("CANCELLED");}
    public void release(String handle){Entry entry;List<Job> active=new ArrayList<>();synchronized(this){entry=files.remove(handle);for(Job j:jobs.values())if(Objects.equals(j.handle,handle))active.add(j);}for(Job j:active)j.fail("CANCELLED");if(entry!=null)clean(entry.source,null);}
    @Override public void close(){List<Job> active;List<Entry> entries;synchronized(this){closed=true;active=new ArrayList<>(jobs.values());entries=new ArrayList<>(files.values());files.clear();}for(Job j:active)j.fail("CANCELLED");for(Entry e:entries)clean(e.source,null);worker.shutdownNow();timers.shutdownNow();cleanup.shutdown();}
}
