package com.soularab.localbackend;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

final class LocalBackendDatabase extends SQLiteOpenHelper {
    private static final String DB_NAME = "soularab_embedded_backend.db";
    private static final int DB_VERSION = 1;

    LocalBackendDatabase(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onConfigure(SQLiteDatabase db) {
        super.onConfigure(db);
        db.setForeignKeyConstraintsEnabled(true);
        db.enableWriteAheadLogging();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE node_tasks (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "node_id TEXT NOT NULL," +
            "task_type TEXT NOT NULL," +
            "payload TEXT NOT NULL," +
            "status TEXT NOT NULL DEFAULT 'queued'," +
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        db.execSQL("CREATE INDEX idx_node_tasks_node_status ON node_tasks(node_id, status)");
        db.execSQL("CREATE TABLE local_sections (" +
            "id TEXT PRIMARY KEY," +
            "section_name TEXT NOT NULL," +
            "content TEXT NOT NULL," +
            "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        db.execSQL("CREATE TABLE node_events (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "node_id TEXT NOT NULL," +
            "event TEXT NOT NULL," +
            "details TEXT NOT NULL DEFAULT '{}'," +
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Future schema changes must use additive, data-preserving migrations.
    }
}
