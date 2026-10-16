import cn.yozi.connector.ConnectorTransport;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** 仅供回环HTTP校验的CLI；生产模块不包含此协议或入口。 */
public final class ConnectorHarness {
    private static String decode(String v) { return new String(Base64.getDecoder().decode(v), StandardCharsets.UTF_8); }
    private static String encode(Object v) { return Base64.getEncoder().encodeToString(String.valueOf(v).getBytes(StandardCharsets.UTF_8)); }
    private static Object scalar(String v) {
        if(v.equals("true"))return Boolean.TRUE;if(v.equals("false"))return Boolean.FALSE;if(v.equals("null"))return null;
        if(v.startsWith("\"") && v.endsWith("\""))return v.substring(1,v.length()-1);
        return Double.valueOf(v);
    }
    private static synchronized void emit(Map<String,Object> v) {
        Object chunk=v.get("chunk");String data=chunk instanceof byte[]?Base64.getEncoder().encodeToString((byte[])chunk):"";
        System.out.println("result\t"+encode(v.get("id"))+"\t"+v.getOrDefault("code","-")+"\t"+v.getOrDefault("status",0)+"\t"+v.getOrDefault("receivedBytes",0)+"\t"+encode(v.getOrDefault("body",""))+"\t"+v.getOrDefault("kind","-")+"\t"+v.getOrDefault("sequence",0)+"\t"+encode(v.getOrDefault("contentType",""))+"\t"+data);
        System.out.flush();
    }
    public static void main(String[] args) throws Exception {
        Map<?,?> material=(Map<?,?>)ConnectorTransport.capabilities().get("materialParse");
        if(!"yozi-material-parse-v1".equals(material.get("contract")) || !Integer.valueOf(100000).equals(material.get("timeoutMs")))throw new AssertionError("material capability");
        ConnectorTransport transport=new ConnectorTransport();
        System.out.println("ready");System.out.flush();
        try(BufferedReader input=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8))) {
            String line;
            while((line=input.readLine())!=null) {
                String[] p=line.split("\t",-1);
                if(p[0].equals("cancel")){transport.cancel(decode(p[1]));continue;}
                if(p[0].equals("close")){transport.close();continue;}
                Map<String,Object> o=new HashMap<>();
                o.put("id",decode(p[1]));o.put("url",decode(p[2]));o.put("method",decode(p[3]));o.put("token",decode(p[4]));
                o.put("allowedOrigins",Arrays.asList(decode(p[5]).split("\n",-1)));
                if(!p[6].equals("-"))o.put("body",decode(p[6]));
                o.put("timeout",scalar(p[7]));o.put("limit",scalar(p[8]));o.put("consent",scalar(p[9]));
                if(p[0].equals("stream"))transport.stream(o,ConnectorHarness::emit);else transport.request(o,ConnectorHarness::emit);
            }
        } finally {transport.close();}
    }
}
