package cn.wenli.connector;
import android.content.ContentResolver;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import java.io.InputStream;

/** 只由系统选择结果创建；JS不传URI，不取持久权限或复制文件。 */
final class AndroidMaterialSource implements MaterialFiles.Source {
    private final ContentResolver resolver;
    private final Uri uri;
    private final CancellationSignal signal=new CancellationSignal();
    AndroidMaterialSource(ContentResolver resolver,Uri uri){if(uri==null || !"content".equals(uri.getScheme()))throw new IllegalArgumentException();this.resolver=resolver;this.uri=uri;}
    @Override public MaterialFiles.Metadata inspect() throws Exception {
        String[] columns={OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE,DocumentsContract.Document.COLUMN_LAST_MODIFIED};Cursor cursor;
        try{cursor=resolver.query(uri,columns,null,null,null,signal);}catch(IllegalArgumentException error){cursor=resolver.query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null,signal);}
        if(cursor==null)throw new IllegalArgumentException();
        try{if(!cursor.moveToFirst())throw new IllegalArgumentException();int name=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME),size=cursor.getColumnIndex(OpenableColumns.SIZE),modified=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
            if(name<0 || size<0 || cursor.isNull(name) || cursor.isNull(size))throw new IllegalArgumentException();return new MaterialFiles.Metadata(cursor.getString(name),cursor.getLong(size),modified>=0 && !cursor.isNull(modified)?cursor.getLong(modified):null);
        }finally{cursor.close();}
    }
    @Override public InputStream open() throws Exception {AssetFileDescriptor file=resolver.openAssetFileDescriptor(uri,"r",signal);if(file==null)throw new IllegalArgumentException();try{return file.createInputStream();}catch(Exception error){file.close();throw error;}}
    @Override public void cancel(){signal.cancel();}
}
