import cn.yozi.connector.MaterialFiles;
import cn.yozi.connector.ConnectorTransport;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** 真实合成临时文件和有界管道；不模拟移动SDK、不接触用户文件。 */
public final class MaterialHarness {
    static Path root;static int serial;
    static void require(boolean ok){if(!ok)throw new AssertionError("native material assertion");}
    static void check(String name){System.out.println("check\t"+name);}
    static final class Reply implements ConnectorTransport.Callback{
        final CompletableFuture<Map<String,Object>> future=new CompletableFuture<>();final AtomicInteger count=new AtomicInteger();
        public void complete(Map<String,Object> value){count.incrementAndGet();future.complete(value);}
        Map<String,Object> get() throws Exception{return future.get(12,TimeUnit.SECONDS);}
    }
    static class FileSource implements MaterialFiles.Source{
        final Path path;final AtomicInteger opens=new AtomicInteger();volatile InputStream stream;
        FileSource(Path path){this.path=path;}
        public MaterialFiles.Metadata inspect() throws Exception{return new MaterialFiles.Metadata(path.getFileName().toString(),Files.size(path),Files.getLastModifiedTime(path).toMillis());}
        public InputStream open() throws Exception{opens.incrementAndGet();return stream=new FileInputStream(path.toFile());}
        public void cancel(){try{if(stream!=null)stream.close();}catch(IOException ignored){}}
    }
    static Path file(String suffix,byte[] bytes) throws Exception {Path p=root.resolve("synthetic_"+(++serial)+suffix);Files.write(p,bytes);return p;}
    @SuppressWarnings("unchecked")
    static Map<String,Object> select(MaterialFiles core,MaterialFiles.Source source) throws Exception{
        Reply r=new Reply();core.select("s_"+(++serial),source,r);Map<String,Object> value=r.get();require(!value.containsKey("code"));require(r.count.get()==1);return (Map<String,Object>)value.get("file");
    }
    static Map<String,Object> read(MaterialFiles core,String handle,boolean consent) throws Exception{
        Reply r=new Reply();core.read("r_"+(++serial),handle,consent,r);Map<String,Object> value=r.get();require(r.count.get()==1);return value;
    }
    static void code(Map<String,Object> value,String expected){require(expected.equals(value.get("code")));require(!value.containsKey("contentBase64"));require(!value.containsKey("url"));}
    static void rejection(String name,MaterialFiles.Source source,String expected) throws Exception{
        try(MaterialFiles core=new MaterialFiles()){Reply r=new Reply();core.select("reject",source,r);code(r.get(),expected);check(name);}
    }
    static FileSource stalled(Path p,CountDownLatch opened,boolean slowCleanup) throws Exception{
        final PipedOutputStream writer=new PipedOutputStream();final PipedInputStream pipe=new PipedInputStream(writer);
        return new FileSource(p){
            public InputStream open(){opens.incrementAndGet();stream=pipe;opened.countDown();return pipe;}
            public void cancel(){try{if(slowCleanup)Thread.sleep(500);writer.close();}catch(Exception ignored){}}
        };
    }
    public static void main(String[] args) throws Exception{
        root=Paths.get(args[0]);Files.createDirectories(root);
        require(MaterialFiles.capabilities().get("maxBytes").equals(10485760));check("capabilities");
        try(MaterialFiles core=new MaterialFiles()){
            FileSource source=new FileSource(file(".pdf",new byte[]{1,2,3,4}));Map<String,Object> picked=select(core,source);
            require(source.opens.get()==0);require(picked.keySet().equals(new HashSet<>(Arrays.asList("handle","name","size"))));check("metadata-only");
            String handle=(String)picked.get("handle");code(read(core,handle,false),"CONSENT_REQUIRED");require(source.opens.get()==0);check("no-consent-no-open");
            Map<String,Object> value=read(core,handle,true);require("AQIDBA==".equals(value.get("contentBase64")));require(source.opens.get()==1);check("approved-real-file");
            code(read(core,handle,true),"FILE_EXPIRED");check("consumed-handle");
        }
        for(int size:new int[]{1,2,3,255,256,8193}){
            byte[] bytes=new byte[size];for(int i=0;i<size;i++)bytes[i]=(byte)i;
            try(MaterialFiles core=new MaterialFiles()){String h=(String)select(core,new FileSource(file(".PNG",bytes))).get("handle");require(Base64.getEncoder().encodeToString(bytes).equals(read(core,h,true).get("contentBase64")));check("exact-base64-"+size);}
        }
        for(String suffix:new String[]{".exe","\u0085.pdf","\u202e.pdf","\u2066.pdf"}){
            FileSource s=new FileSource(file(suffix,new byte[]{1}));rejection("unsafe-name-"+(++serial),s,"FILE_TYPE");require(s.opens.get()==0);
        }
        rejection("empty",new FileSource(file(".pdf",new byte[0])),"FILE_LIMIT");
        Path huge=file(".pdf",new byte[]{1});try(RandomAccessFile f=new RandomAccessFile(huge.toFile(),"rw")){f.setLength(MaterialFiles.MAX_BYTES+1L);}rejection("oversize",new FileSource(huge),"FILE_LIMIT");
        try(MaterialFiles core=new MaterialFiles()){
            FileSource a=new FileSource(file(".pdf",new byte[]{1}));String h=(String)select(core,a).get("handle");select(core,new FileSource(file(".pdf",new byte[]{1})));
            FileSource b=new FileSource(file(".pdf",new byte[]{1}));Reply r=new Reply();core.select("third",b,r);code(r.get(),"FILE_LIMIT");require(b.opens.get()==0);check("two-handle-limit");
            core.release(h);code(read(core,h,true),"FILE_EXPIRED");check("release-handle");
        }
        try(MaterialFiles core=new MaterialFiles()){
            FileSource s=new FileSource(file(".pdf",new byte[]{1}));String h=(String)select(core,s).get("handle");Files.write(s.path,new byte[]{1,2});code(read(core,h,true),"FILE_CHANGED");require(s.opens.get()==0);check("changed-before-open");
        }
        for(final boolean grow:new boolean[]{true,false}){
            Path p=file(".pdf",new byte[]{1,2,3,4});
            FileSource s=new FileSource(p){
                public InputStream open() throws Exception{Files.write(path,grow?new byte[]{1,2,3,4,5,6}:new byte[]{1});return super.open();}
                public MaterialFiles.Metadata inspect() throws Exception{return new MaterialFiles.Metadata(path.getFileName().toString(),4,0L);}
            };
            try(MaterialFiles core=new MaterialFiles()){String h=(String)select(core,s).get("handle");code(read(core,h,true),"FILE_CHANGED");check(grow?"underreported-size-sentinel":"short-body");}
        }
        for(String mode:new String[]{"cancel","timeout","close","release"}){
            try(MaterialFiles core=new MaterialFiles()){
                CountDownLatch opened=new CountDownLatch(1);FileSource s=stalled(file(".pdf",new byte[4]),opened,mode.equals("cancel"));String h=(String)select(core,s).get("handle");Reply first=new Reply();core.read("pending",h,true,first);require(opened.await(2,TimeUnit.SECONDS));
                if(mode.equals("cancel")){
                    Reply duplicate=new Reply();core.read("pending",h,true,duplicate);code(duplicate.get(),"REQUEST_CONFLICT");check("duplicate-id");
                    Reply busy=new Reply();core.select("other",new FileSource(file(".pdf",new byte[]{1})),busy);code(busy.get(),"BUSY");check("busy");
                }
                long at=System.nanoTime();if(mode.equals("cancel"))core.cancel("pending");else if(mode.equals("close"))core.close();else if(mode.equals("release"))core.release(h);
                code(first.get(),mode.equals("timeout")?"TIMEOUT":"CANCELLED");if(!mode.equals("timeout"))require(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-at)<400);
                Thread.sleep(650);require(first.count.get()==1);code(read(core,h,true),"FILE_EXPIRED");check(mode+"-one-callback");
            }
        }
        try(MaterialFiles core=new MaterialFiles()){Reply r=new Reply();core.select("../invalid",new FileSource(file(".pdf",new byte[]{1})),r);code(r.get(),"INVALID_REQUEST");check("invalid-id");}
        System.out.println("ok");
    }
}
